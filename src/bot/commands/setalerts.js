/**
 * Slash command: /setalerts
 * Sets the alerts channel
 */
import { SlashCommandBuilder } from 'discord.js';
import db from '../../db/database.js';

export const data = new SlashCommandBuilder()
  .setName('setalerts')
  .setDescription('Configurar este canal como canal de alertas (ejecutar en el canal deseado)');

export async function execute(interaction) {
  await db.query(
    `INSERT INTO guilds (id, alerts_channel_id) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET alerts_channel_id = $2`,
    [interaction.guildId, interaction.channelId]
  );

  await interaction.reply(`✅ Canal <#${interaction.channelId}> configurado como **canal de alertas**.`);
}
