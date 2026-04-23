/**
 * Technical indicators: RSI, EMA, SMA, ATR
 * All functions are pure - take arrays, return arrays
 */

export function calcSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    result.push(sum / period);
  }
  return result;
}

export function calcEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);

  // First value is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    result.push(null);
    sum += data[i];
  }
  result[period - 1] = sum / period;

  // Rest is EMA
  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calcRSI(closes, period = 14) {
  const result = [];
  const gains = [];
  const losses = [];

  result.push(null);

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  if (gains.length < period) {
    return closes.map(() => null);
  }

  // First RSI - simple averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  // Subsequent RSIs - smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export function calcATR(highs, lows, closes, period = 14) {
  const trueRanges = [];
  trueRanges.push(highs[0] - lows[0]);

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  const result = [];
  for (let i = 0; i < period - 1; i++) {
    result.push(null);
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  result.push(sum / period);

  for (let i = period; i < trueRanges.length; i++) {
    const atr = (result[result.length - 1] * (period - 1) + trueRanges[i]) / period;
    result.push(atr);
  }

  return result;
}

/**
 * Calculate slope of a series over n periods
 */
export function calcSlope(data, n = 5) {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(null);
  }
  for (let i = n; i < data.length; i++) {
    if (data[i] == null || data[i - n] == null || data[i - n] === 0) {
      result.push(null);
    } else {
      result.push((data[i] - data[i - n]) / data[i - n]);
    }
  }
  return result;
}
