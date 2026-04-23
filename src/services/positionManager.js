/**
 * Position management service
 * Handles opening, closing, stop loss, and TP management
 */
import db from '../db/database.js';
import { calcStop, calcTPs, isStopHit, isTP1Hit, isTP2Hit, checkTrailingExit, calcPnL } from '../strategy/risk.js';
import { fetchCurrentPrice } from './marketData.js';
import logger from '../logger.js';

/**
 * Open a new position
 */
export async function openPosition(guildId, tokenId, alertId, direction, entryPrice, atr, pivot, riskAmount = null) {
  const stop = calcStop(entryPrice, pivot, atr, direction);
  const { tp1, tp2, risk } = calcTPs(entryPrice, stop);

  const result = await db.query(
    `INSERT INTO positions (guild_id, token_id, alert_id, direction, entry_price, stop_price, tp1_price, tp2_price, risk_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN') RETURNING id`,
    [guildId, tokenId, alertId, direction, entryPrice, stop, tp1, tp2, riskAmount || risk]
  );

  logger.info(`Position opened: ${direction} token#${tokenId} entry=${entryPrice} stop=${stop} tp1=${tp1} tp2=${tp2}`);

  return {
    id: result.rows[0].id,
    entryPrice, stop, tp1, tp2, risk,
  };
}

/**
 * Close a position and record the trade
 */
export async function closePosition(positionId, exitPrice, exitReason) {
  const posRes = await db.query(
    `SELECT p.*, t.symbol FROM positions p
     JOIN monitored_tokens t ON t.id = p.token_id
     WHERE p.id = $1`,
    [positionId]
  );

  if (posRes.rows.length === 0) {
    logger.error(`Position ${positionId} not found`);
    return null;
  }

  const pos = posRes.rows[0];
  const { pnl, pnlPct } = calcPnL(parseFloat(pos.entry_price), exitPrice, pos.direction);

  await db.query(
    `INSERT INTO trades (position_id, exit_price, exit_reason, pnl, pnl_pct)
     VALUES ($1, $2, $3, $4, $5)`,
    [positionId, exitPrice, exitReason, pnl, pnlPct]
  );

  await db.query(
    `UPDATE positions SET status = $1 WHERE id = $2`,
    [exitReason === 'STOP' ? 'STOPPED' : 'CLOSED', positionId]
  );

  logger.info(`Position closed: ${pos.symbol} ${pos.direction} entry=${pos.entry_price} exit=${exitPrice} PnL=${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) reason=${exitReason}`);

  return { pnl, pnlPct, symbol: pos.symbol, direction: pos.direction, entryPrice: parseFloat(pos.entry_price), exitPrice };
}

/**
 * Move stop to breakeven (after TP1 hit)
 */
export async function moveStopToBreakeven(positionId) {
  const pos = await db.query(`SELECT entry_price FROM positions WHERE id = $1`, [positionId]);
  if (pos.rows.length === 0) return;

  await db.query(
    `UPDATE positions SET stop_price = entry_price, status = 'TP1_HIT' WHERE id = $1`,
    [positionId]
  );

  logger.info(`Position ${positionId}: stop moved to breakeven`);
}

/**
 * Check all open positions for stop/TP hits
 * @param {Function} sendExitAlert - Callback to send exit alert to Discord
 */
export async function checkPositions(sendExitAlert) {
  const positions = await db.query(
    `SELECT p.*, t.symbol FROM positions p
     JOIN monitored_tokens t ON t.id = p.token_id
     WHERE p.status IN ('OPEN', 'TP1_HIT')`
  );

  for (const pos of positions) {
    try {
      const currentPrice = await fetchCurrentPrice(`${pos.symbol}/USDT`);
      const entry = parseFloat(pos.entry_price);
      const stop = parseFloat(pos.stop_price);
      const tp1 = parseFloat(pos.tp1_price);
      const tp2 = parseFloat(pos.tp2_price);
      const direction = pos.direction;

      // Stop loss hit
      if (isStopHit(currentPrice, stop, direction)) {
        const result = await closePosition(pos.id, currentPrice, 'STOP');
        if (result) await sendExitAlert(pos, result, 'STOP');
        continue;
      }

      // TP2 hit (only if TP1 already hit)
      if (pos.status === 'TP1_HIT' && isTP2Hit(currentPrice, tp2, direction)) {
        const result = await closePosition(pos.id, currentPrice, 'TP2');
        if (result) await sendExitAlert(pos, result, 'TP2');
        continue;
      }

      // TP1 hit
      if (pos.status === 'OPEN' && isTP1Hit(currentPrice, tp1, direction)) {
        await moveStopToBreakeven(pos.id);
        await sendExitAlert(pos, null, 'TP1_HIT');
        continue;
      }
    } catch (err) {
      logger.error(`Error checking position ${pos.id}: ${err.message}`);
    }
  }
}

/**
 * Get all trades for PnL report
 */
export async function getTradesForGuild(guildId) {
  const result = await db.query(
    `SELECT t.*, p.direction, p.entry_price, p.opened_at, p.status as pos_status,
            mt.symbol
     FROM trades t
     JOIN positions p ON p.id = t.position_id
     JOIN monitored_tokens mt ON mt.id = p.token_id
     WHERE p.guild_id = $1
     ORDER BY t.closed_at DESC`,
    [guildId]
  );
  return result.rows;
}

/**
 * Get open positions for a guild
 */
export async function getOpenPositions(guildId) {
  const result = await db.query(
    `SELECT p.*, mt.symbol FROM positions p
     JOIN monitored_tokens mt ON mt.id = p.token_id
     WHERE p.guild_id = $1 AND p.status IN ('OPEN', 'TP1_HIT')
     ORDER BY p.opened_at DESC`,
    [guildId]
  );
  return result.rows;
}

export default { openPosition, closePosition, moveStopToBreakeven, checkPositions, getTradesForGuild, getOpenPositions };
