/**
 * RSI Divergence Crypto Bot - Entry Point
 */
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import cron from 'node-cron';
import config from './config.js';
import logger from './logger.js';
import db from './db/database.js';
import { scanAll } from './strategy/scanner.js';
import { checkPositions } from './services/positionManager.js';
import { setupEventHandlers } from './bot/handlers/events.js';
import { buildWatchEmbed, buildEntryEmbed, buildPositionEmbed, buildTP1Embed, buildExitEmbed, buildTradeClosedEmbed } from './ui/embeds.js';
import { createBuyButton, createSellButton, createShortButton } from './ui/components.js';
import alertManager from './services/alertManager.js';
import { fetchCurrentPrice, toSymbol } from './services/marketData.js';
import { startWebServer, setBotState } from './web/server.js';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Start web dashboard
startWebServer();

// Signal processor - handles scanner results and sends Discord messages
async function processSignal(token, signal) {
  const guild = client.guilds.cache.get(token.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(token.alerts_channel_id);
  if (!channel) return;

  if (signal.type === 'INVALIDATE') {
    // Delete invalidated alert messages
    for (const msg of signal.messages.alertMessages) {
      try {
        const ch = guild.channels.cache.get(msg.channelId);
        if (ch) {
          const message = await ch.messages.fetch(msg.message_id).catch(() => null);
          if (message) await message.delete().catch(() => {});
        }
      } catch {}
    }
    return;
  }

  if (signal.type === 'WATCH') {
    // Check if we already have an active watch alert
    const existingWatch = await alertManager.getActiveWatch(token.id);
    if (existingWatch) {
      // Update existing message
      const embed = buildWatchEmbed(signal);
      try {
        const message = await channel.messages.fetch(existingWatch.message_id).catch(() => null);
        if (message) {
          await message.edit({ embeds: [embed] });
          return;
        }
      } catch {}
      // If message not found, create new one
    }

    const embed = buildWatchEmbed(signal);
    const sent = await channel.send({ embeds: [embed] });

    await alertManager.upsertWatchAlert(
      token.id,
      signal.setup,
      signal.pricePivots,
      sent.id,
      channel.id
    );
    return;
  }

  if (signal.type === 'ENTRY') {
    // Check if we already have an active entry alert for this token
    const existingEntry = await alertManager.getActiveEntryAlert(token.id);
    if (existingEntry) {
      // Update existing
      const embed = buildEntryEmbed(signal);
      const button = signal.direction === 'LONG'
        ? createBuyButton(existingEntry.id)
        : createShortButton(existingEntry.id);
      try {
        const message = await channel.messages.fetch(existingEntry.message_id).catch(() => null);
        if (message) {
          await message.edit({ embeds: [embed], components: [button] });
          return;
        }
      } catch {}
    }

    // Create new entry alert
    const embed = buildEntryEmbed(signal);
    // We need to create the alert first to get the ID for the button
    const sent = await channel.send({ embeds: [embed] });
    const alertId = await alertManager.createEntryAlert(
      token.id, signal.direction,
      {
        ...signal,
        atr: signal.atr,
        currentPrice: signal.currentPrice,
        setup: signal.setup,
      },
      sent.id,
      channel.id
    );

    // Now edit to add the button with the correct alert ID
    const button = signal.direction === 'LONG'
      ? createBuyButton(alertId)
      : createShortButton(alertId);
    await sent.edit({ embeds: [embed], components: [button] });
  }
}

// Exit alert sender for position manager
async function sendExitAlert(position, result, reason) {
  const guild = client.guilds.cache.get(position.guild_id);
  if (!guild) return;

  // Get token info
  const tokenRes = await db.query(`SELECT * FROM monitored_tokens WHERE id = $1`, [position.token_id]);
  if (tokenRes.rows.length === 0) return;
  const token = tokenRes.rows[0];
  const channel = guild.channels.cache.get(token.alerts_channel_id);
  if (!channel) return;

  if (reason === 'TP1_HIT') {
    // Just update position message and send notification
    const embed = buildTP1Embed(token.symbol, position.direction);
    await channel.send({ embeds: [embed] });

    // Update original position message
    if (position.message_id) {
      try {
        const posRes = await db.query(`SELECT * FROM positions WHERE id = $1`, [position.id]);
        const currentPrice = await fetchCurrentPrice(toSymbol(token.base_asset));
        const posEmbed = buildPositionEmbed(posRes.rows[0], token.symbol, currentPrice);
        const msg = await channel.messages.fetch(position.message_id).catch(() => null);
        if (msg) await msg.edit({ embeds: [posEmbed], components: [] });
      } catch {}
    }
    return;
  }

  if (reason === 'STOP') {
    // Auto-close on stop hit - send notification
    if (result) {
      const embed = buildTradeClosedEmbed(result);
      await channel.send({ embeds: [embed] });

      // Update original position message
      if (position.message_id) {
        try {
          const msg = await channel.messages.fetch(position.message_id).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components: [] });
        } catch {}
      }
    }
    return;
  }

  if (reason === 'TP2') {
    if (result) {
      const embed = buildTradeClosedEmbed(result);
      await channel.send({ embeds: [embed] });

      if (position.message_id) {
        try {
          const msg = await channel.messages.fetch(position.message_id).catch(() => null);
          if (msg) await msg.edit({ embeds: [embed], components: [] });
        } catch {}
      }
    }
    return;
  }
}

// Setup event handlers
setupEventHandlers(client);

// Login
client.login(config.discordToken).then(() => {
  logger.info('Logging in to Discord...');

  // Wait for ready, then start scanner
  client.once('clientReady', () => {
    logger.info(`Bot ready as ${client.user.tag}`);

    // Update dashboard state
    setBotState({
      ready: true,
      guilds: client.guilds.cache.size,
      startedAt: new Date(),
    });

    // Update WS ping periodically
    setInterval(() => {
      setBotState({
        wsPing: client.ws.ping,
        guilds: client.guilds.cache.size,
      });
    }, 30000);

    // Schedule scanner + position check every 15 min
    cron.schedule(config.scanCron, async () => {
      logger.info('Scheduled scan triggered');
      try {
        await scanAll(processSignal);
        await checkPositions(sendExitAlert);
        setBotState({ lastScanTime: new Date() });
      } catch (err) {
        logger.error('Scan cycle error', err);
      }
    });

    logger.info(`Scanner scheduled with cron: ${config.scanCron}`);
  });
}).catch((err) => {
  logger.error('Failed to login to Discord', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  client.destroy();
  process.exit(0);
});
