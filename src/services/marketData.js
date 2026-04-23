/**
 * Market data service using ccxt (Binance)
 * Fetches OHLCV candles for 1D and 4H timeframes
 */
import ccxt from 'ccxt';
import config from '../config.js';
import logger from '../logger.js';

const exchange = new ccxt.binance({
  apiKey: config.binanceApiKey,
  secret: config.binanceSecret,
  enableRateLimit: true,
  options: { defaultType: 'spot' },
});

/**
 * Fetch OHLCV candles
 * @param {string} symbol - e.g. 'BTC/USDT'
 * @param {string} timeframe - '1d', '4h', etc.
 * @param {number} limit - Number of candles
 * @returns {Promise<{timestamp: number[], opens: number[], highs: number[], lows: number[], closes: number[], volumes: number[]}>}
 */
export async function fetchOHLCV(symbol, timeframe, limit = 250) {
  try {
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return {
      timestamp: ohlcv.map(c => c[0]),
      opens: ohlcv.map(c => c[1]),
      highs: ohlcv.map(c => c[2]),
      lows: ohlcv.map(c => c[3]),
      closes: ohlcv.map(c => c[4]),
      volumes: ohlcv.map(c => c[5]),
    };
  } catch (err) {
    logger.error(`Failed to fetch ${symbol} ${timeframe}: ${err.message}`);
    throw err;
  }
}

/**
 * Fetch current price for a symbol
 * @param {string} symbol - e.g. 'BTC/USDT'
 * @returns {Promise<number>}
 */
export async function fetchCurrentPrice(symbol) {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    return ticker.last;
  } catch (err) {
    logger.error(`Failed to fetch price for ${symbol}: ${err.message}`);
    throw err;
  }
}

/**
 * Convert base asset (btc, eth) to Binance symbol (BTC/USDT)
 * @param {string} base - lowercase base asset
 * @returns {string}
 */
export function toSymbol(base) {
  return `${base.toUpperCase()}/USDT`;
}

/**
 * Validate that a symbol exists on Binance
 * @param {string} symbol - e.g. 'BTC/USDT'
 * @returns {Promise<boolean>}
 */
export async function validateSymbol(symbol) {
  try {
    await exchange.loadMarkets();
    return symbol in exchange.markets;
  } catch {
    return false;
  }
}

export default { fetchOHLCV, fetchCurrentPrice, toSymbol, validateSymbol };
