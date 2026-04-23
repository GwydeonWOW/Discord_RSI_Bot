/**
 * Discord UI components (buttons, action rows)
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Create buy button for LONG entry
 */
export function createBuyButton(alertId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`buy_${alertId}`)
      .setLabel('✅ Comprar')
      .setStyle(ButtonStyle.Success)
  );
}

/**
 * Create sell button for SHORT entry or closing LONG
 */
export function createSellButton(positionId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`sell_${positionId}`)
        .setLabel('💸 Vender / Cerrar')
        .setStyle(ButtonStyle.Danger)
    );
}

/**
 * Create short button for SHORT entry
 */
export function createShortButton(alertId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`short_${alertId}`)
      .setLabel('📉 Abrir Short')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * No buttons (position tracking message)
 */
export function noButtons() {
  return [];
}
