/**
 * Alert lifecycle management
 * Handles creating, updating, and invalidating alerts
 */
import db from '../db/database.js';
import logger from '../logger.js';

/**
 * Create or update a WATCH alert
 */
export async function upsertWatchAlert(tokenId, type, pivotData, messageId, channelId) {
  // Check if there's an active watch for this token
  const existing = await db.query(
    `SELECT id, message_id FROM watch_states WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    await db.query(
      `UPDATE watch_states SET type = $1, pivot_data = $2, message_id = $3, detected_at = NOW()
       WHERE id = $4`,
      [type, JSON.stringify(pivotData), messageId, existing.rows[0].id]
    );
    return { id: existing.rows[0].id, previousMessageId: existing.rows[0].message_id, isNew: false };
  }

  // Create new
  const result = await db.query(
    `INSERT INTO watch_states (token_id, type, pivot_data, message_id, active)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
    [tokenId, type, JSON.stringify(pivotData), messageId]
  );

  // Also create alert record
  await db.query(
    `INSERT INTO alerts (token_id, type, direction, message_id, channel_id, data, active)
     VALUES ($1, 'WATCH', $2, $3, $4, $5, TRUE)`,
    [tokenId, type.includes('LONG') ? 'LONG' : 'SHORT', messageId, channelId,
     JSON.stringify({ watchType: type, pivotData })]
  );

  return { id: result.rows[0].id, isNew: true };
}

/**
 * Create an ENTRY alert
 */
export async function createEntryAlert(tokenId, direction, data, messageId, channelId) {
  // Invalidate any active watch for this token
  await db.query(
    `UPDATE watch_states SET active = FALSE WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );

  // Invalidate any previous active entry alerts
  await db.query(
    `UPDATE alerts SET active = FALSE WHERE token_id = $1 AND type = 'ENTRY' AND active = TRUE`,
    [tokenId]
  );

  const result = await db.query(
    `INSERT INTO alerts (token_id, type, direction, message_id, channel_id, data, active)
     VALUES ($1, 'ENTRY', $2, $3, $4, $5, TRUE) RETURNING id`,
    [tokenId, direction, messageId, channelId, JSON.stringify(data)]
  );

  return result.rows[0].id;
}

/**
 * Invalidate alerts for a token (signal no longer valid)
 * Returns message IDs that should be deleted
 */
export async function invalidateAlerts(tokenId) {
  // Get active alerts to delete messages
  const alerts = await db.query(
    `SELECT id, message_id, channel_id, type FROM alerts WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );

  const watches = await db.query(
    `SELECT id, message_id FROM watch_states WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );

  // Mark inactive
  await db.query(
    `UPDATE alerts SET active = FALSE WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );
  await db.query(
    `UPDATE watch_states SET active = FALSE WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );

  return {
    alertMessages: alerts.rows.map(a => ({ messageId: a.message_id, channelId: a.channel_id })),
    watchMessages: watches.rows.map(w => ({ messageId: w.message_id })),
  };
}

/**
 * Get active ENTRY alert for a token
 */
export async function getActiveEntryAlert(tokenId) {
  const result = await db.query(
    `SELECT * FROM alerts WHERE token_id = $1 AND type = 'ENTRY' AND active = TRUE`,
    [tokenId]
  );
  return result.rows[0] || null;
}

/**
 * Get active WATCH states for a token
 */
export async function getActiveWatch(tokenId) {
  const result = await db.query(
    `SELECT * FROM watch_states WHERE token_id = $1 AND active = TRUE`,
    [tokenId]
  );
  return result.rows[0] || null;
}

export default { upsertWatchAlert, createEntryAlert, invalidateAlerts, getActiveEntryAlert, getActiveWatch };
