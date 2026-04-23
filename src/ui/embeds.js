/**
 * Discord embed builders for alerts, positions, and PnL
 */
import { EmbedBuilder } from 'discord.js';

/**
 * Build WATCH alert embed
 */
export function buildWatchEmbed(signal) {
  const emoji = signal.direction === 'LONG' ? '🟢' : '🔴';
  const color = signal.direction === 'LONG' ? 0xFFD700 : 0xFFD700; // Yellow for watch

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`👁 WATCH: ${signal.symbol} — ${signal.direction} ${signal.category}`)
    .setDescription('Divergencia detectada. Pendiente de confirmación de entrada.')
    .addFields(
      { name: 'Setup', value: signal.setup.replace(/_/g, ' '), inline: true },
      { name: 'Dirección', value: `${emoji} ${signal.direction}`, inline: true },
      { name: 'Régimen 1D', value: signal.regime.regime, inline: true },
      { name: 'Precio actual', value: `$${signal.currentPrice.toLocaleString()}`, inline: true },
      { name: 'RSI (4H)', value: signal.rsi.toFixed(1), inline: true },
      { name: 'VolRatio', value: signal.volatility.volRatio.toFixed(3), inline: true },
      { name: 'Trigger Level', value: signal.triggerLevel ? `$${signal.triggerLevel.toLocaleString()}` : 'N/A', inline: true },
      { name: 'EMA50 (4H)', value: signal.ema50_4h ? `$${signal.ema50_4h.toLocaleString()}` : 'N/A', inline: true },
    )
    .setFooter({ text: 'RSI Divergence Bot — WATCH Signal' })
    .setTimestamp();
}

/**
 * Build ENTRY alert embed
 */
export function buildEntryEmbed(signal) {
  const emoji = signal.direction === 'LONG' ? '📈' : '📉';
  const color = signal.direction === 'LONG' ? 0x00FF00 : 0xFF0000;

  // Calculate stop and TPs using the signal data
  const pivot = signal.direction === 'LONG'
    ? signal.pricePivots.lows[signal.pricePivots.lows.length - 1]
    : signal.pricePivots.highs[signal.pricePivots.highs.length - 1];

  const direction = signal.direction === 'LONG' ? 'LONG' : 'SHORT';
  const isLong = direction === 'LONG';

  let stopPrice, tp1Price, tp2Price, risk;

  if (isLong) {
    stopPrice = Math.min(pivot.value - 0.5 * signal.atr, signal.currentPrice - 1.8 * signal.atr);
    risk = Math.abs(signal.currentPrice - stopPrice);
    tp1Price = signal.currentPrice + risk;
    tp2Price = signal.currentPrice + 2.5 * risk;
  } else {
    stopPrice = Math.max(pivot.value + 0.5 * signal.atr, signal.currentPrice + 1.8 * signal.atr);
    risk = Math.abs(signal.currentPrice - stopPrice);
    tp1Price = signal.currentPrice - risk;
    tp2Price = signal.currentPrice - 2.5 * risk;
  }

  const riskPct = ((risk / signal.currentPrice) * 100).toFixed(2);

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ENTRY: ${signal.symbol} — ${direction} ${signal.category}`)
    .setDescription('**Señal confirmada.** Ruptura estructural detectada.')
    .addFields(
      { name: 'Setup', value: signal.setup.replace(/_/g, ' '), inline: true },
      { name: 'Dirección', value: `${emoji} ${direction}`, inline: true },
      { name: 'Régimen 1D', value: signal.regime.regime, inline: true },
      { name: 'Entrada estimada', value: `$${signal.currentPrice.toLocaleString()}`, inline: true },
      { name: 'Stop Loss', value: `$${stopPrice.toLocaleString()}`, inline: true },
      { name: 'Riesgo (R)', value: `${riskPct}%`, inline: true },
      { name: 'TP1 (1R)', value: `$${tp1Price.toLocaleString()}`, inline: true },
      { name: 'TP2 (2.5R)', value: `$${tp2Price.toLocaleString()}`, inline: true },
      { name: 'VolRatio', value: signal.volatility.volRatio.toFixed(3), inline: true },
      { name: 'RSI (4H)', value: signal.rsi.toFixed(1), inline: true },
      { name: 'Trigger Level', value: signal.triggerLevel ? `$${signal.triggerLevel.toLocaleString()}` : 'N/A', inline: true },
    )
    .setFooter({ text: 'RSI Divergence Bot — ENTRY Signal' })
    .setTimestamp();
}

/**
 * Build position opened embed (after button press)
 */
export function buildPositionEmbed(position, symbol, currentPrice = null) {
  const emoji = position.direction === 'LONG' ? '📈' : '📉';
  const isLong = position.direction === 'LONG';
  const color = isLong ? 0x00FF00 : 0xFF0000;

  const entry = parseFloat(position.entry_price);
  const stop = parseFloat(position.stop_price);
  const tp1 = parseFloat(position.tp1_price);
  const tp2 = parseFloat(position.tp2_price);
  const risk = Math.abs(entry - stop);
  const statusEmoji = position.status === 'TP1_HIT' ? '✅ TP1 Hit' : position.status === 'OPEN' ? '🟢 Abierta' : position.status;

  const fields = [
    { name: 'Estado', value: statusEmoji, inline: true },
    { name: 'Entrada', value: `$${entry.toLocaleString()}`, inline: true },
    { name: 'Stop', value: `$${stop.toLocaleString()}`, inline: true },
    { name: 'TP1', value: `$${tp1.toLocaleString()}`, inline: true },
    { name: 'TP2', value: `$${tp2.toLocaleString()}`, inline: true },
    { name: 'Riesgo', value: `$${risk.toLocaleString()}`, inline: true },
  ];

  if (currentPrice) {
    const pnl = isLong ? currentPrice - entry : entry - currentPrice;
    const pnlPct = ((pnl / entry) * 100).toFixed(2);
    const pnlEmoji = pnl >= 0 ? '📈' : '📉';
    fields.push({ name: 'Precio actual', value: `$${currentPrice.toLocaleString()}`, inline: true });
    fields.push({ name: 'P&L', value: `${pnlEmoji} $${pnl.toFixed(2)} (${pnlPct}%)`, inline: true });
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} Posición ${position.direction}: ${symbol}`)
    .addFields(fields)
    .setFooter({ text: `ID: ${position.id} — RSI Divergence Bot` })
    .setTimestamp(new Date(position.opened_at));
}

/**
 * Build TP1 hit notification
 */
export function buildTP1Embed(symbol, direction) {
  const emoji = '🎯';
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`${emoji} TP1 Alcanzado: ${symbol} ${direction}`)
    .setDescription('Stop movido a breakeven. Posición permanece abierta.')
    .setFooter({ text: 'RSI Divergence Bot' })
    .setTimestamp();
}

/**
 * Build exit/sell alert embed
 */
export function buildExitEmbed(position, symbol, reason) {
  const isStop = reason === 'STOP';
  const color = isStop ? 0xFF0000 : 0x00FF00;
  const emoji = isStop ? '🛑' : '💰';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} Cerrar posición: ${symbol} ${position.direction}`)
    .setDescription(`**Razón: ${reason}**. Pulsa el botón para confirmar el cierre.`)
    .setFooter({ text: `Position ID: ${position.id} — RSI Divergence Bot` })
    .setTimestamp();
}

/**
 * Build trade closed embed
 */
export function buildTradeClosedEmbed(result) {
  const isWin = result.pnl >= 0;
  const emoji = isWin ? '💰' : '💔';
  const color = isWin ? 0x00FF00 : 0xFF0000;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} Operación cerrada: ${result.symbol} ${result.direction}`)
    .addFields(
      { name: 'Entrada', value: `$${result.entryPrice.toLocaleString()}`, inline: true },
      { name: 'Salida', value: `$${result.exitPrice.toLocaleString()}`, inline: true },
      { name: 'P&L', value: `${emoji} $${result.pnl.toFixed(2)} (${result.pnlPct.toFixed(2)}%)`, inline: true },
    )
    .setFooter({ text: 'RSI Divergence Bot' })
    .setTimestamp();
}

/**
 * Build PnL table embed
 */
export function buildPnLEmbed(trades) {
  if (trades.length === 0) {
    return new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📊 P&L — Sin operaciones')
      .setDescription('No hay operaciones cerradas registradas.')
      .setTimestamp();
  }

  // Build table
  const header = '| Token | Dir | Entry | Exit | PnL | PnL% | Razón | Fecha |\n|---|---|---|---|---|---|---|---|';
  const rows = trades.map(t => {
    const pnlEmoji = parseFloat(t.pnl) >= 0 ? '📈' : '📉';
    const date = new Date(t.closed_at).toLocaleDateString('es-ES');
    return `| ${t.symbol.replace('/USDT', '')} | ${t.direction} | $${parseFloat(t.entry_price).toFixed(2)} | $${parseFloat(t.exit_price).toFixed(2)} | ${pnlEmoji} $${parseFloat(t.pnl).toFixed(2)} | ${parseFloat(t.pnl_pct).toFixed(2)}% | ${t.exit_reason} | ${date} |`;
  });

  // Summary
  const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
  const wins = trades.filter(t => parseFloat(t.pnl) >= 0).length;
  const winRate = ((wins / trades.length) * 100).toFixed(1);
  const bestTrade = trades.reduce((best, t) => parseFloat(t.pnl) > parseFloat(best.pnl) ? t : best, trades[0]);
  const worstTrade = trades.reduce((worst, t) => parseFloat(t.pnl) < parseFloat(worst.pnl) ? t : worst, trades[0]);

  const summaryEmoji = totalPnl >= 0 ? '📈' : '📉';
  const embed = new EmbedBuilder()
    .setColor(totalPnl >= 0 ? 0x00FF00 : 0xFF0000)
    .setTitle(`📊 P&L — Resumen de operaciones`)
    .setDescription(`${header}\n${rows.join('\n')}`)
    .addFields(
      { name: 'Total P&L', value: `${summaryEmoji} $${totalPnl.toFixed(2)}`, inline: true },
      { name: 'Operaciones', value: `${trades.length}`, inline: true },
      { name: 'Win Rate', value: `${winRate}%`, inline: true },
      { name: 'Mejor trade', value: `📈 $${parseFloat(bestTrade.pnl).toFixed(2)} (${bestTrade.symbol})`, inline: true },
      { name: 'Peor trade', value: `📉 $${parseFloat(worstTrade.pnl).toFixed(2)} (${worstTrade.symbol})`, inline: true },
    )
    .setFooter({ text: 'RSI Divergence Bot — /pnl' })
    .setTimestamp();

  return embed;
}

/**
 * Build open positions embed
 */
export function buildOpenPositionsEmbed(positions) {
  if (positions.length === 0) {
    return new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📋 Posiciones abiertas — Ninguna')
      .setDescription('No hay posiciones abiertas.')
      .setTimestamp();
  }

  const header = '| Token | Dir | Entry | Stop | TP1 | TP2 | Estado |\n|---|---|---|---|---|---|---|';
  const rows = positions.map(p => {
    const dir = p.direction === 'LONG' ? '📈' : '📉';
    return `| ${p.symbol.replace('/USDT', '')} | ${dir} ${p.direction} | $${parseFloat(p.entry_price).toFixed(2)} | $${parseFloat(p.stop_price).toFixed(2)} | $${parseFloat(p.tp1_price).toFixed(2)} | $${parseFloat(p.tp2_price).toFixed(2)} | ${p.status} |`;
  });

  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📋 Posiciones abiertas (${positions.length})`)
    .setDescription(`${header}\n${rows.join('\n')}`)
    .setFooter({ text: 'RSI Divergence Bot — /positions' })
    .setTimestamp();
}
