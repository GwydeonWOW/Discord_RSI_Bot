/**
 * Slash command: /pnl
 * Shows PnL table of all closed trades
 */
import { SlashCommandBuilder } from 'discord.js';
import { getTradesForGuild } from '../../services/positionManager.js';
import { buildPnLEmbed } from '../../ui/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('pnl')
  .setDescription('Ver tabla de P&L de todas las operaciones');

export async function execute(interaction) {
  await interaction.deferReply();

  const trades = await getTradesForGuild(interaction.guildId);
  const embed = buildPnLEmbed(trades);

  await interaction.editReply({ embeds: [embed] });
}
