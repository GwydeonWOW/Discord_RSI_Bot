/**
 * Discord event handlers
 */
import db from '../../db/database.js';
import logger from '../../logger.js';

export function setupEventHandlers(client) {
  client.once('clientReady', async () => {
    logger.info(`Bot ready as ${client.user.tag}`);

    // Run migrations
    try {
      await db.runMigrations();
    } catch (err) {
      logger.error('Migration failed', err);
    }

    // Register slash commands
    const { registerCommands } = await import('./interactions.js');
    await registerCommands(client);

    logger.info('Bot fully initialized');
  });

  // Handle slash commands
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Command ${interaction.commandName} failed`, err);
        const reply = { content: '❌ Error al ejecutar el comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }

    if (interaction.isButton()) {
      const { handleButton } = await import('./interactions.js');
      try {
        await handleButton(interaction);
      } catch (err) {
        logger.error('Button interaction failed', err);
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ Error al procesar la acción.', ephemeral: true });
        }
      }
    }
  });

  client.on('guildCreate', async (guild) => {
    logger.info(`Added to guild: ${guild.name} (${guild.id})`);
    await db.query(
      `INSERT INTO guilds (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [guild.id]
    );
  });

  client.on('error', (err) => {
    logger.error('Discord client error', err);
  });

  client.on('warn', (warn) => {
    logger.warn(`Discord warning: ${warn}`);
  });
}

export default { setupEventHandlers };
