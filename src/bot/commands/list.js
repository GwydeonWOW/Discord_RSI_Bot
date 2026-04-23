/**
 * Slash command: /list
 * Lists all monitored tokens
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../../db/database.js';

export const data = new SlashCommandBuilder()
  .setName('list')
  .setDescription('Ver tokens monitorizados');

export async function execute(interaction) {
  const result = await db.query(
    `SELECT symbol, base_asset, added_by, created_at FROM monitored_tokens
     WHERE guild_id = $1 AND active = TRUE ORDER BY created_at`,
    [interaction.guildId]
  );

  if (result.rows.length === 0) {
    return interaction.reply({ content: '📋 No hay tokens monitorizados. Usa `/add <token>` para añadir.', ephemeral: true });
  }

  const list = result.rows.map(r =>
    `• **${r.symbol}** (añadido <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>)`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📋 Tokens monitorizados (${result.rows.length})`)
    .setDescription(list)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
