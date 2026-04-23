/**
 * Volatility filter using VolRatio
 * VolRatio = ATR14_4H / SMA(ATR14_4H, 30)
 * Valid range: 0.8 <= VolRatio <= 1.8
 */
import { calcSMA } from './indicators.js';

/**
 * Calculate and check volatility filter
 * @param {number[]} atrSeries - ATR 14 on 4H timeframe
 * @param {number} smaPeriod - SMA period for normalization (default 30)
 * @param {number} minRatio - Minimum VolRatio (default 0.8)
 * @param {number} maxRatio - Maximum VolRatio (default 1.8)
 * @returns {{volRatio: number, valid: boolean, sma: number, currentATR: number}}
 */
export function checkVolatility(atrSeries, smaPeriod = 30, minRatio = 0.8, maxRatio = 1.8) {
  const currentATR = atrSeries[atrSeries.length - 1];

  if (currentATR == null) {
    return { volRatio: 0, valid: false, sma: 0, currentATR: 0 };
  }

  const smaValues = calcSMA(atrSeries.filter(v => v != null), smaPeriod);
  const sma = smaValues[smaValues.length - 1];

  if (sma == null || sma === 0) {
    return { volRatio: 0, valid: false, sma: 0, currentATR };
  }

  const volRatio = currentATR / sma;
  const valid = volRatio >= minRatio && volRatio <= maxRatio;

  return { volRatio, valid, sma, currentATR };
}
