/**
 * Risk management: stop loss, take profit, position sizing
 */

import config from '../config.js';
const S = config.strategy;

/**
 * Calculate stop loss price
 * @param {number} entry - Entry price
 * @param {object} pivot - Second pivot {value}
 * @param {number} atr - Current ATR
 * @param {string} direction - LONG or SHORT
 * @returns {number}
 */
export function calcStop(entry, pivot, atr, direction) {
  if (direction === 'LONG') {
    // Stop below structural low: min(pivotLow - 0.5*ATR, entry - 1.8*ATR)
    return Math.min(pivot.value - S.stopBuffer * atr, entry - S.stopMaxMultiplier * atr);
  }
  // Stop above structural high: max(pivotHigh + 0.5*ATR, entry + 1.8*ATR)
  return Math.max(pivot.value + S.stopBuffer * atr, entry + S.stopMaxMultiplier * atr);
}

/**
 * Calculate take profit levels
 * @param {number} entry - Entry price
 * @param {number} stop - Stop loss price
 * @returns {{tp1: number, tp2: number, risk: number}}
 */
export function calcTPs(entry, stop) {
  const risk = Math.abs(entry - stop);
  const direction = entry > stop ? 'LONG' : 'SHORT';

  let tp1, tp2;
  if (direction === 'LONG') {
    tp1 = entry + S.tp1Multiplier * risk;
    tp2 = entry + S.tp2Multiplier * risk;
  } else {
    tp1 = entry - S.tp1Multiplier * risk;
    tp2 = entry - S.tp2Multiplier * risk;
  }

  return { tp1, tp2, risk };
}

/**
 * Check if stop loss has been hit
 * @param {number} currentPrice - Current price
 * @param {number} stopPrice - Stop loss price
 * @param {string} direction - LONG or SHORT
 * @returns {boolean}
 */
export function isStopHit(currentPrice, stopPrice, direction) {
  if (direction === 'LONG') return currentPrice <= stopPrice;
  return currentPrice >= stopPrice;
}

/**
 * Check if TP1 has been hit
 */
export function isTP1Hit(currentPrice, tp1Price, direction) {
  if (direction === 'LONG') return currentPrice >= tp1Price;
  return currentPrice <= tp1Price;
}

/**
 * Check if TP2 has been hit
 */
export function isTP2Hit(currentPrice, tp2Price, direction) {
  if (direction === 'LONG') return currentPrice >= tp2Price;
  return currentPrice <= tp2Price;
}

/**
 * Check trailing exit conditions (post-TP1)
 * @param {number} close - Current 4H close
 * @param {number} ema20 - Current EMA20 value
 * @param {number} rsi - Current RSI value
 * @param {string} direction - LONG or SHORT
 * @param {boolean} tp1Hit - Whether TP1 has been hit
 * @returns {{exit: boolean, reason: string}}
 */
export function checkTrailingExit(close, ema20, rsi, direction, tp1Hit) {
  if (!tp1Hit) return { exit: false, reason: '' };

  if (direction === 'LONG') {
    if (ema20 != null && close < ema20) {
      return { exit: true, reason: 'Close below EMA20 (trailing)' };
    }
    if (rsi < 50) {
      return { exit: true, reason: 'RSI dropped below 50 (trailing)' };
    }
  }

  if (direction === 'SHORT') {
    if (ema20 != null && close > ema20) {
      return { exit: true, reason: 'Close above EMA20 (trailing)' };
    }
    if (rsi > 50) {
      return { exit: true, reason: 'RSI rose above 50 (trailing)' };
    }
  }

  return { exit: false, reason: '' };
}

/**
 * Calculate PnL
 */
export function calcPnL(entryPrice, exitPrice, direction) {
  const raw = direction === 'LONG'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;
  const pct = (raw / entryPrice) * 100;
  return { pnl: raw, pnlPct: pct };
}
