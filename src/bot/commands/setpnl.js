/**
 * Slash command: /setpnl
 * Sets the PnL channel
 */
import { SlashCommandBuilder } from 'discord.js';
import db from '../../db/database.js';

export const data = new SlashCommandBuilder()
  .setName('setpnl')
  .setDescription('Configurar este canal como canal de P&L (ejecutar en el canal deseado)');

export async function execute(interaction) {
  await db.query(
    `INSERT INTO guilds (id, pnl_channel_id) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET pnl_channel_id = $2`,
    [interaction.guildId, interaction.channelId]
  );

  await interaction.reply(`✅ Canal <#${interaction.channelId}> configurado como **canal de P&L**.`);
}
