/**
 * Slash command: /add <token>
 * Adds a token to monitor
 */
import { SlashCommandBuilder } from 'discord.js';
import db from '../../db/database.js';
import { validateSymbol, toSymbol } from '../../services/marketData.js';

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Añadir un token para monitorizar')
  .addStringOption(option =>
    option.setName('token')
      .setDescription('Token (btc, eth, sol, etc.)')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(10)
  );

export async function execute(interaction) {
  const baseAsset = interaction.options.getString('token').toLowerCase();
  const symbol = toSymbol(baseAsset);

  // Ensure guild exists
  await db.query(
    `INSERT INTO guilds (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [interaction.guildId]
  );

  // Validate symbol on Binance
  const valid = await validateSymbol(symbol);
  if (!valid) {
    return interaction.reply({ content: `❌ Token \`${baseAsset}\` no encontrado en Binance. Formato: btc, eth, sol...`, ephemeral: true });
  }

  try {
    await db.query(
      `INSERT INTO monitored_tokens (guild_id, symbol, base_asset, added_by, active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [interaction.guildId, symbol, baseAsset, interaction.user.id]
    );
    await interaction.reply(`✅ Token **${symbol}** añadido a la monitorización.`);
  } catch (err) {
    if (err.code === '23505') {
      return interaction.reply({ content: `⚠️ El token **${symbol}** ya está siendo monitorizado.`, ephemeral: true });
    }
    throw err;
  }
}
