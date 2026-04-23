/**
 * Divergence detection: regular and hidden
 * Compares price pivots with RSI pivots
 */

/**
 * Detect all types of divergence
 * @param {Array<{index: number, value: number}>} priceLows - Price pivot lows
 * @param {Array<{index: number, value: number}>} priceHighs - Price pivot highs
 * @param {Array<{index: number, value: number}>} rsiLows - RSI pivot lows
 * @param {Array<{index: number, value: number}>} rsiHighs - RSI pivot highs
 * @returns {Array<{type: string, pricePivots: object, rsiPivots: object, direction: string}>}
 */
export function detectDivergences(priceLows, priceHighs, rsiLows, rsiHighs) {
  const results = [];

  // Need at least 2 pivots for divergence
  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const pLow1 = priceLows[priceLows.length - 2];
    const pLow2 = priceLows[priceLows.length - 1];
    const rLow1 = rsiLows[rsiLows.length - 2];
    const rLow2 = rsiLows[rsiLows.length - 1];

    // Regular bullish: price lower low + RSI higher low
    if (pLow2.value < pLow1.value && rLow2.value > rLow1.value) {
      results.push({
        type: 'REGULAR_BULLISH',
        direction: 'LONG',
        category: 'reversal',
        pricePivots: { first: pLow1, second: pLow2 },
        rsiPivots: { first: rLow1, second: rLow2 },
      });
    }

    // Hidden bullish: price higher low + RSI lower low
    if (pLow2.value > pLow1.value && rLow2.value < rLow1.value) {
      results.push({
        type: 'HIDDEN_BULLISH',
        direction: 'LONG',
        category: 'continuation',
        pricePivots: { first: pLow1, second: pLow2 },
        rsiPivots: { first: rLow1, second: rLow2 },
      });
    }
  }

  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const pHigh1 = priceHighs[priceHighs.length - 2];
    const pHigh2 = priceHighs[priceHighs.length - 1];
    const rHigh1 = rsiHighs[rsiHighs.length - 2];
    const rHigh2 = rsiHighs[rsiHighs.length - 1];

    // Regular bearish: price higher high + RSI lower high
    if (pHigh2.value > pHigh1.value && rHigh2.value < rHigh1.value) {
      results.push({
        type: 'REGULAR_BEARISH',
        direction: 'SHORT',
        category: 'reversal',
        pricePivots: { first: pHigh1, second: pHigh2 },
        rsiPivots: { first: rHigh1, second: rHigh2 },
      });
    }

    // Hidden bearish: price lower high + RSI higher high
    if (pHigh2.value < pHigh1.value && rHigh2.value > rHigh1.value) {
      results.push({
        type: 'HIDDEN_BEARISH',
        direction: 'SHORT',
        category: 'continuation',
        pricePivots: { first: pHigh1, second: pHigh2 },
        rsiPivots: { first: rHigh1, second: rHigh2 },
      });
    }
  }

  return results;
}

/**
 * Get setup name for alert
 */
export function getSetupName(divergence, regime) {
  const { type, category } = divergence;
  const isContinuation = category === 'continuation';
  const dir = type.includes('BULLISH') ? 'LONG' : 'SHORT';

  if (isContinuation) {
    return `${dir}_CONTINUATION`;
  }
  return `${dir}_REVERSAL`;
}
