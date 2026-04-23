/**
 * Slash command: /positions
 * Shows open positions
 */
import { SlashCommandBuilder } from 'discord.js';
import { getOpenPositions } from '../../services/positionManager.js';
import { buildOpenPositionsEmbed } from '../../ui/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('positions')
  .setDescription('Ver posiciones abiertas');

export async function execute(interaction) {
  const positions = await getOpenPositions(interaction.guildId);
  const embed = buildOpenPositionsEmbed(positions);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
