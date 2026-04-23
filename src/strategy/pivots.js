/**
 * Pivot detection with confirmed pivots (left=5, right=5)
 * A pivot is only confirmed when `right` bars have closed after it
 */

/**
 * Find confirmed pivot highs and lows in a data series
 * @param {number[]} data - Price series
 * @param {number} left - Bars to the left
 * @param {number} right - Bars to the right (confirmation)
 * @returns {{highs: Array<{index: number, value: number}>, lows: Array<{index: number, value: number}>}}
 */
export function findPivots(data, left = 5, right = 5) {
  const highs = [];
  const lows = [];

  for (let i = left; i < data.length - right; i++) {
    // Check pivot high
    let isHigh = true;
    for (let j = 1; j <= left; j++) {
      if (data[i - j] >= data[i]) { isHigh = false; break; }
    }
    if (isHigh) {
      for (let j = 1; j <= right; j++) {
        if (data[i + j] >= data[i]) { isHigh = false; break; }
      }
    }
    if (isHigh) {
      highs.push({ index: i, value: data[i] });
    }

    // Check pivot low
    let isLow = true;
    for (let j = 1; j <= left; j++) {
      if (data[i - j] <= data[i]) { isLow = false; break; }
    }
    if (isLow) {
      for (let j = 1; j <= right; j++) {
        if (data[i + j] <= data[i]) { isLow = false; break; }
      }
    }
    if (isLow) {
      lows.push({ index: i, value: data[i] });
    }
  }

  return { highs, lows };
}

/**
 * Get the last N confirmed pivots
 */
export function getLastPivots(pivots, n = 2) {
  return pivots.slice(-n);
}
