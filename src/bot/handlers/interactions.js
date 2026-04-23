/**
 * Interaction handler - buttons (buy/sell/short) and slash commands
 */
import db from '../../db/database.js';
import { openPosition, closePosition } from '../../services/positionManager.js';
import { fetchCurrentPrice, toSymbol } from '../../services/marketData.js';
import { buildPositionEmbed, buildTradeClosedEmbed } from '../../ui/embeds.js';
import { createSellButton } from '../../ui/components.js';
import logger from '../../logger.js';

/**
 * Handle button interactions
 */
export async function handleButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('buy_') || customId.startsWith('short_')) {
    await handleOpenPosition(interaction, customId);
  } else if (customId.startsWith('sell_')) {
    await handleClosePosition(interaction, customId);
  }
}

async function handleOpenPosition(interaction, customId) {
  const alertId = parseInt(customId.split('_')[1]);
  const direction = customId.startsWith('buy_') ? 'LONG' : 'SHORT';

  // Get alert data
  const alertRes = await db.query(
    `SELECT a.*, mt.symbol, mt.base_asset, mt.guild_id FROM alerts a
     JOIN monitored_tokens mt ON mt.id = a.token_id
     WHERE a.id = $1 AND a.active = TRUE`,
    [alertId]
  );

  if (alertRes.rows.length === 0) {
    return interaction.reply({ content: '❌ Esta alerta ya no está activa.', ephemeral: true });
  }

  const alert = alertRes.rows[0];
  const data = typeof alert.data === 'string' ? JSON.parse(alert.data) : alert.data;

  // Get current price
  const currentPrice = await fetchCurrentPrice(toSymbol(alert.base_asset));

  // Open position
  const position = await openPosition(
    alert.guild_id,
    alert.token_id,
    alert.id,
    direction,
    currentPrice,
    data.atr || 0,
    { value: data.currentPrice || currentPrice }
  );

  // Update the message - remove button, show position info
  const posRecord = await db.query(`SELECT * FROM positions WHERE id = $1`, [position.id]);
  const embed = buildPositionEmbed(posRecord.rows[0], alert.symbol, currentPrice);

  await interaction.message.edit({
    embeds: [embed],
    components: [],
  });

  // Deactivate the alert (position is now open)
  await db.query(`UPDATE alerts SET active = FALSE WHERE id = $1`, [alertId]);

  await interaction.reply({ content: `✅ Posición **${direction}** abierta en **${alert.symbol}** a $${currentPrice.toLocaleString()}`, ephemeral: true });

  // Store message_id on position for future updates
  await db.query(`UPDATE positions SET message_id = $1 WHERE id = $2`, [interaction.message.id, position.id]);
}

async function handleClosePosition(interaction, customId) {
  const positionId = parseInt(customId.split('_')[1]);

  const posRes = await db.query(
    `SELECT p.*, mt.symbol, mt.base_asset FROM positions p
     JOIN monitored_tokens mt ON mt.id = p.token_id
     WHERE p.id = $1 AND p.status IN ('OPEN', 'TP1_HIT')`,
    [positionId]
  );

  if (posRes.rows.length === 0) {
    return interaction.reply({ content: '❌ Esta posición ya está cerrada.', ephemeral: true });
  }

  const pos = posRes.rows[0];
  const currentPrice = await fetchCurrentPrice(toSymbol(pos.base_asset));

  // Close position
  const result = await closePosition(positionId, currentPrice, 'MANUAL');

  if (!result) {
    return interaction.reply({ content: '❌ Error al cerrar la posición.', ephemeral: true });
  }

  // Update message
  const embed = buildTradeClosedEmbed(result);
  await interaction.message.edit({
    embeds: [embed],
    components: [],
  });

  await interaction.reply({ content: `✅ Posición cerrada en **${pos.symbol}**. P&L: ${result.pnl >= 0 ? '📈' : '📉'} $${result.pnl.toFixed(2)} (${result.pnlPct.toFixed(2)}%)`, ephemeral: true });
}

/**
 * Register all slash commands with Discord
 */
export async function registerCommands(client) {
  const commands = [];

  // Import all command modules
  const commandFiles = [
    await import('../commands/add.js'),
    await import('../commands/remove.js'),
    await import('../commands/list.js'),
    await import('../commands/pnl.js'),
    await import('../commands/position.js'),
    await import('../commands/setalerts.js'),
    await import('../commands/setpnl.js'),
  ];

  for (const cmd of commandFiles) {
    commands.push(cmd.data.toJSON());
  }

  // Register globally
  try {
    await client.application.commands.set(commands);
    logger.info(`Registered ${commands.length} slash commands`);
  } catch (err) {
    logger.error('Failed to register commands', err);
  }

  // Store command executors
  client.commands = new Map();
  for (const cmd of commandFiles) {
    client.commands.set(cmd.data.name, cmd);
  }
}

export default { handleButton, registerCommands };
