/**
 * Main scanner - runs on schedule, processes all monitored tokens
 */
import db from '../db/database.js';
import { fetchOHLCV, toSymbol } from '../services/marketData.js';
import { calcRSI, calcATR, calcEMA, calcSMA } from './indicators.js';
import { findPivots, getLastPivots } from './pivots.js';
import { detectDivergences, getSetupName } from './divergence.js';
import { getRegime, isRegimeValidForDivergence } from './regime.js';
import { checkVolatility } from './volatility.js';
import { checkTrigger } from './trigger.js';
import alertManager from '../services/alertManager.js';
import config from '../config.js';
import logger from '../logger.js';

const S = config.strategy;

/**
 * Scan a single token
 * @returns {object|null} Signal data if found
 */
export async function scanToken(symbol) {
  logger.info(`Scanning ${symbol}...`);

  // Fetch data
  const [dailyData, fourHourData] = await Promise.all([
    fetchOHLCV(symbol, S.htfTimeframe, S.candleLimit),
    fetchOHLCV(symbol, S.etfTimeframe, S.candleLimit),
  ]);

  if (dailyData.closes.length < 200 || fourHourData.closes.length < 60) {
    logger.warn(`Not enough data for ${symbol}`);
    return null;
  }

  // Calculate indicators on 1D
  const dailyEma50 = calcEMA(dailyData.closes, S.emaFast);
  const dailyEma200 = calcEMA(dailyData.closes, S.emaSlow);
  const regime = getRegime(dailyData.closes[dailyData.closes.length - 1], dailyEma50, dailyEma200);

  // Calculate indicators on 4H
  const rsi = calcRSI(fourHourData.closes, S.rsiPeriod);
  const atr = calcATR(fourHourData.highs, fourHourData.lows, fourHourData.closes, S.atrPeriod);
  const ema20_4h = calcEMA(fourHourData.closes, S.emaTrail);
  const ema50_4h = calcEMA(fourHourData.closes, S.emaFast);

  // Volatility filter
  const volatility = checkVolatility(atr, S.volRatioSmaPeriod, S.volRatioMin, S.volRatioMax);

  logger.info(`${symbol}: regime=${regime.regime} volRatio=${volatility.volRatio.toFixed(3)} valid=${volatility.valid}`);

  if (!volatility.valid) {
    return { symbol, regime, volatility, signal: null, reason: 'Volatility out of range' };
  }

  // Align RSI with price data — RSI has nulls for the first `period` values
  // Both arrays must share the same indices so pivots correspond to the same candles
  const rsiStart = rsi.findIndex(v => v != null);
  const alignedCloses = fourHourData.closes.slice(rsiStart);
  const alignedRsi = rsi.slice(rsiStart);

  // Find pivots on aligned data
  const pricePivots = findPivots(alignedCloses, S.pivotLeft, S.pivotRight);
  const rsiPivots = findPivots(alignedRsi, S.pivotLeft, S.pivotRight);

  logger.info(`${symbol}: price pivots — ${pricePivots.lows.length} lows, ${pricePivots.highs.length} highs | RSI pivots — ${rsiPivots.lows.length} lows, ${rsiPivots.highs.length} highs`);

  // Detect divergences
  const divergences = detectDivergences(
    pricePivots.lows, pricePivots.highs,
    rsiPivots.lows, rsiPivots.highs
  );

  logger.info(`${symbol}: ${divergences.length} raw divergence(s) detected`);

  if (divergences.length === 0) {
    return { symbol, regime, volatility, signal: null, reason: 'No divergence detected' };
  }

  // Filter by regime
  const validDivergences = divergences.filter(d => isRegimeValidForDivergence(regime.regime, d));

  if (validDivergences.length === 0) {
    logger.info(`${symbol}: All ${divergences.length} divergence(s) filtered by regime (${regime.regime})`);
    return { symbol, regime, volatility, divergences, signal: null, reason: 'Divergence not valid for current regime' };
  }

  // Process each valid divergence
  const signals = [];
  for (const divergence of validDivergences) {
    const setupName = getSetupName(divergence, regime);

    // Additional filters
    const lastRsi = rsi[rsi.length - 1];
    const pricePivotSecond = divergence.pricePivots.second;
    const lastEma50_4h = ema50_4h[ema50_4h.length - 1];
    const lastAtr = atr[atr.length - 1];

    // RSI filter for continuation setups
    if (divergence.category === 'continuation') {
      if (divergence.direction === 'LONG' && (lastRsi < S.rsiContinuationLongMin || lastRsi > S.rsiContinuationLongMax)) {
        logger.info(`${symbol}: ${divergence.type} filtered — RSI ${lastRsi.toFixed(1)} outside ${S.rsiContinuationLongMin}-${S.rsiContinuationLongMax}`);
        continue;
      }
      if (divergence.direction === 'SHORT' && (lastRsi < S.rsiContinuationShortMin || lastRsi > S.rsiContinuationShortMax)) {
        logger.info(`${symbol}: ${divergence.type} filtered — RSI ${lastRsi.toFixed(1)} outside ${S.rsiContinuationShortMin}-${S.rsiContinuationShortMax}`);
        continue;
      }
    }

    // RSI filter for reversal setups
    if (divergence.category === 'reversal') {
      if (divergence.direction === 'LONG' && lastRsi >= S.rsiReversalLongMax) {
        logger.info(`${symbol}: ${divergence.type} filtered — RSI ${lastRsi.toFixed(1)} >= ${S.rsiReversalLongMax}`);
        continue;
      }
      if (divergence.direction === 'SHORT' && lastRsi <= S.rsiReversalShortMin) {
        logger.info(`${symbol}: ${divergence.type} filtered — RSI ${lastRsi.toFixed(1)} <= ${S.rsiReversalShortMin}`);
        continue;
      }
    }

    // Distance to EMA50 check for continuation
    if (divergence.category === 'continuation' && lastEma50_4h != null && lastAtr != null) {
      const distance = Math.abs(pricePivotSecond.value - lastEma50_4h);
      if (distance > lastAtr) {
        logger.debug(`${symbol}: Pivot too far from EMA50 (distance=${distance.toFixed(2)}, ATR=${lastAtr.toFixed(2)})`);
        continue;
      }
    }

    // Check trigger (entry confirmation)
    const trigger = checkTrigger(
      divergence,
      pricePivots.lows, pricePivots.highs,
      fourHourData.highs, fourHourData.lows, fourHourData.closes,
      ema20_4h
    );

    const lastClose = fourHourData.closes[fourHourData.closes.length - 1];

    signals.push({
      type: trigger.triggered ? 'ENTRY' : 'WATCH',
      setup: setupName,
      direction: divergence.direction,
      category: divergence.category,
      divergence,
      regime,
      volatility,
      rsi: lastRsi,
      currentPrice: lastClose,
      triggerLevel: trigger.triggerLevel,
      triggerConfirmed: trigger.triggered,
      atr: lastAtr,
      ema20_4h: ema20_4h[ema20_4h.length - 1],
      ema50_4h: lastEma50_4h,
      pricePivots: { lows: getLastPivots(pricePivots.lows, 2), highs: getLastPivots(pricePivots.highs, 2) },
      rsiPivots: { lows: getLastPivots(rsiPivots.lows, 2), highs: getLastPivots(rsiPivots.highs, 2) },
    });
  }

  return { symbol, regime, volatility, signals };
}

/**
 * Scan all active tokens across all guilds
 * @param {Function} processSignal - Callback to handle signals in Discord
 */
export async function scanAll(processSignal) {
  logger.info('Starting scan cycle...');

  const tokens = await db.query(
    `SELECT mt.*, g.alerts_channel_id, g.pnl_channel_id, g.id as guild_id
     FROM monitored_tokens mt
     JOIN guilds g ON g.id = mt.guild_id
     WHERE mt.active = TRUE AND g.alerts_channel_id IS NOT NULL`
  );

  logger.info(`Scanning ${tokens.rows.length} tokens across guilds`);

  // Group by symbol to avoid duplicate API calls
  const symbolMap = {};
  for (const token of tokens.rows) {
    const sym = toSymbol(token.base_asset);
    if (!symbolMap[sym]) symbolMap[sym] = [];
    symbolMap[sym].push(token);
  }

  for (const [symbol, tokenEntries] of Object.entries(symbolMap)) {
    try {
      const result = await scanToken(symbol);

      if (!result || !result.signals || result.signals.length === 0) {
        // Invalidate any active alerts for tokens of this symbol
        for (const token of tokenEntries) {
          const activeEntry = await alertManager.getActiveEntryAlert(token.id);
          const activeWatch = await alertManager.getActiveWatch(token.id);
          if (activeEntry || activeWatch) {
            const messages = await alertManager.invalidateAlerts(token.id);
            await processSignal(token, { type: 'INVALIDATE', messages });
          }
        }
        continue;
      }

      for (const signal of result.signals) {
        for (const token of tokenEntries) {
          await processSignal(token, signal);
        }
      }
    } catch (err) {
      logger.error(`Error scanning ${symbol}: ${err.message}`);
    }
  }

  logger.info('Scan cycle completed');
}

export default { scanToken, scanAll };
