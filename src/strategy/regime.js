/**
 * Market regime detection on HTF (1D)
 * BULL: close > EMA200, EMA50 > EMA200, slope(EMA50,5) > 0
 * BEAR: close < EMA200, EMA50 < EMA200, slope(EMA50,5) < 0
 * NEUTRAL: everything else
 */
import { calcSlope } from './indicators.js';

/**
 * Determine the current market regime
 * @param {number} currentClose - Current daily close
 * @param {number[]} ema50 - EMA 50 series on daily
 * @param {number[]} ema200 - EMA 200 series on daily
 * @returns {{regime: string, slope: number, ema50: number, ema200: number}}
 */
export function getRegime(currentClose, ema50, ema200) {
  const lastEma50 = ema50[ema50.length - 1];
  const lastEma200 = ema200[ema200.length - 1];

  if (lastEma50 == null || lastEma200 == null) {
    return { regime: 'NEUTRAL', slope: 0, ema50: lastEma50, ema200: lastEma200 };
  }

  const slopes = calcSlope(ema50, 5);
  const currentSlope = slopes[slopes.length - 1] || 0;

  const isBull = currentClose > lastEma200
    && lastEma50 > lastEma200
    && currentSlope > 0;

  const isBear = currentClose < lastEma200
    && lastEma50 < lastEma200
    && currentSlope < 0;

  let regime = 'NEUTRAL';
  if (isBull) regime = 'BULL';
  else if (isBear) regime = 'BEAR';

  return { regime, slope: currentSlope, ema50: lastEma50, ema200: lastEma200 };
}

/**
 * Check if regime is valid for a given divergence type
 * @param {string} regime - BULL, BEAR, NEUTRAL
 * @param {object} divergence - Divergence object
 * @returns {boolean}
 */
export function isRegimeValidForDivergence(regime, divergence) {
  const { type, category } = divergence;

  if (category === 'continuation') {
    // Hidden bullish continuation needs bull regime
    if (type === 'HIDDEN_BULLISH') return regime === 'BULL';
    // Hidden bearish continuation needs bear regime
    if (type === 'HIDDEN_BEARISH') return regime === 'BEAR';
  }

  if (category === 'reversal') {
    // Regular bullish reversal needs neutral or weakening bear
    if (type === 'REGULAR_BULLISH') return regime === 'NEUTRAL' || regime === 'BEAR';
    // Regular bearish reversal needs neutral or weakening bull
    if (type === 'REGULAR_BEARISH') return regime === 'NEUTRAL' || regime === 'BULL';
  }

  return false;
}
