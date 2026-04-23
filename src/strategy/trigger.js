/**
 * Entry trigger / confirmation
 * Long: close > intermediate swing high (max between the two lows)
 * Short: close < intermediate swing low (min between the two highs)
 */

/**
 * Find intermediate swing high between two lows (for long trigger)
 * @param {Array<{index: number, value: number}>} priceLows - The two pivot lows
 * @param {number[]} highs - High price series
 * @returns {number|null}
 */
export function findIntermediateHigh(priceLows, highs) {
  if (priceLows.length < 2) return null;

  const idx1 = priceLows[priceLows.length - 2].index;
  const idx2 = priceLows[priceLows.length - 1].index;

  let maxHigh = -Infinity;
  for (let i = idx1 + 1; i < idx2; i++) {
    if (highs[i] > maxHigh) maxHigh = highs[i];
  }
  return maxHigh === -Infinity ? null : maxHigh;
}

/**
 * Find intermediate swing low between two highs (for short trigger)
 * @param {Array<{index: number, value: number}>} priceHighs - The two pivot highs
 * @param {number[]} lows - Low price series
 * @returns {number|null}
 */
export function findIntermediateLow(priceHighs, lows) {
  if (priceHighs.length < 2) return null;

  const idx1 = priceHighs[priceHighs.length - 2].index;
  const idx2 = priceHighs[priceHighs.length - 1].index;

  let minLow = Infinity;
  for (let i = idx1 + 1; i < idx2; i++) {
    if (lows[i] < minLow) minLow = lows[i];
  }
  return minLow === Infinity ? null : minLow;
}

/**
 * Check if the trigger is confirmed
 * @param {object} divergence - Detected divergence
 * @param {Array} priceLows - Price pivot lows
 * @param {Array} priceHighs - Price pivot highs
 * @param {number[]} highs - High price series (4H)
 * @param {number[]} lows - Low price series (4H)
 * @param {number[]} closes - Close price series (4H)
 * @param {number[]} ema20 - EMA20 on 4H
 * @returns {{triggered: boolean, triggerLevel: number|null, type: string}}
 */
export function checkTrigger(divergence, priceLows, priceHighs, highs, lows, closes, ema20) {
  const lastClose = closes[closes.length - 1];
  const lastEma20 = ema20[ema20.length - 1];

  if (divergence.direction === 'LONG') {
    const triggerLevel = findIntermediateHigh(priceLows, highs);
    if (triggerLevel == null) return { triggered: false, triggerLevel: null, type: 'LONG' };

    // For continuation: close above intermediate high
    // For reversal: close above intermediate high AND above EMA20
    let triggered = lastClose > triggerLevel;
    if (divergence.category === 'reversal') {
      triggered = triggered && lastEma20 != null && lastClose > lastEma20;
    }

    return { triggered, triggerLevel, type: 'LONG' };
  }

  if (divergence.direction === 'SHORT') {
    const triggerLevel = findIntermediateLow(priceHighs, lows);
    if (triggerLevel == null) return { triggered: false, triggerLevel: null, type: 'SHORT' };

    let triggered = lastClose < triggerLevel;
    if (divergence.category === 'reversal') {
      triggered = triggered && lastEma20 != null && lastClose < lastEma20;
    }

    return { triggered, triggerLevel, type: 'SHORT' };
  }

  return { triggered: false, triggerLevel: null, type: divergence.direction };
}
