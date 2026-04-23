/**
 * Slash command: /remove <token>
 */
import { SlashCommandBuilder } from 'discord.js';
import db from '../../db/database.js';
import { toSymbol } from '../../services/marketData.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Eliminar un token de la monitorización')
  .addStringOption(option =>
    option.setName('token')
      .setDescription('Token a eliminar (btc, eth, etc.)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const baseAsset = interaction.options.getString('token').toLowerCase();
  const symbol = toSymbol(baseAsset);

  const result = await db.query(
    `UPDATE monitored_tokens SET active = FALSE
     WHERE guild_id = $1 AND symbol = $2 AND active = TRUE`,
    [interaction.guildId, symbol]
  );

  if (result.rowCount === 0) {
    return interaction.reply({ content: `⚠️ El token **${symbol}** no estaba siendo monitorizado.`, ephemeral: true });
  }

  await interaction.reply(`🗑 Token **${symbol}** eliminado de la monitorización.`);
}
