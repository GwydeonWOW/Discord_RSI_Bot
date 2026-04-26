/**
 * Slash command: /status
 * Shows all monitored tokens with their current market state
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../../db/database.js';
import { fetchOHLCV, fetchCurrentPrice, toSymbol } from '../../services/marketData.js';
import { calcRSI, calcATR, calcEMA, calcSMA } from '../../strategy/indicators.js';
import { getRegime } from '../../strategy/regime.js';
import { checkVolatility } from '../../strategy/volatility.js';
import { findPivots } from '../../strategy/pivots.js';
import { detectDivergences } from '../../strategy/divergence.js';
import { isRegimeValidForDivergence } from '../../strategy/regime.js';
import config from '../../config.js';

const S = config.strategy;

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Ver estado actual del mercado para todos los tokens monitorizados');

export async function execute(interaction) {
  await interaction.deferReply();

  const tokens = await db.query(
    `SELECT * FROM monitored_tokens WHERE guild_id = $1 AND active = TRUE ORDER BY symbol`,
    [interaction.guildId]
  );

  if (tokens.rows.length === 0) {
    return interaction.editReply({ content: '📋 No hay tokens monitorizados. Usa `/add <token>` para añadir.' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📊 Estado del Mercado')
    .setDescription(`Datos en tiempo real para ${tokens.rows.length} tokens`)
    .setTimestamp();

  for (const token of tokens.rows) {
    try {
      const symbol = toSymbol(token.base_asset);

      const [dailyData, fourHourData, currentPrice] = await Promise.all([
        fetchOHLCV(symbol, S.htfTimeframe, S.candleLimit),
        fetchOHLCV(symbol, S.etfTimeframe, S.candleLimit),
        fetchCurrentPrice(symbol),
      ]);

      // Daily indicators for regime
      const dailyEma50 = calcEMA(dailyData.closes, S.emaFast);
      const dailyEma200 = calcEMA(dailyData.closes, S.emaSlow);
      const regime = getRegime(dailyData.closes[dailyData.closes.length - 1], dailyEma50, dailyEma200);

      // 4H indicators
      const rsi = calcRSI(fourHourData.closes, S.rsiPeriod);
      const atr = calcATR(fourHourData.highs, fourHourData.lows, fourHourData.closes, S.atrPeriod);
      const volatility = checkVolatility(atr, S.volRatioSmaPeriod, S.volRatioMin, S.volRatioMax);

      const lastRsi = rsi[rsi.length - 1];
      const lastAtr = atr[atr.length - 1];

      // 24h change
      const prevClose = dailyData.closes[dailyData.closes.length - 2];
      const change24h = ((currentPrice - prevClose) / prevClose * 100).toFixed(2);

      // Check for active divergences (aligned arrays)
      const rsiStart = rsi.findIndex(v => v != null);
      const pricePivots = findPivots(fourHourData.closes.slice(rsiStart), S.pivotLeft, S.pivotRight);
      const rsiPivots = findPivots(rsi.slice(rsiStart), S.pivotLeft, S.pivotRight);
      const divergences = detectDivergences(pricePivots.lows, pricePivots.highs, rsiPivots.lows, rsiPivots.highs);
      const validDivs = divergences.filter(d => isRegimeValidForDivergence(regime.regime, d));

      // Check active alerts
      const activeWatch = await db.query(
        `SELECT type FROM watch_states WHERE token_id = $1 AND active = TRUE`, [token.id]
      );
      const activeEntry = await db.query(
        `SELECT direction FROM alerts WHERE token_id = $1 AND type = 'ENTRY' AND active = TRUE`, [token.id]
      );

      // Regime emoji
      const regimeEmoji = regime.regime === 'BULL' ? '🟢' : regime.regime === 'BEAR' ? '🔴' : '⚪';
      const changeEmoji = parseFloat(change24h) >= 0 ? '📈' : '📉';

      // Alert status
      let alertStatus = '—';
      if (activeEntry.rows.length > 0) {
        alertStatus = `⚡ ENTRY ${activeEntry.rows[0].direction}`;
      } else if (activeWatch.rows.length > 0) {
        alertStatus = `👁 WATCH`;
      } else if (validDivs.length > 0) {
        alertStatus = `🔍 ${validDivs.length} div (sin confirmar)`;
      }

      // Divergences detail
      let divDetail = '';
      if (validDivs.length > 0) {
        divDetail = validDivs.map(d =>
          `${d.type.replace(/_/g, ' ')} (${d.category})`
        ).join('\n');
      }

      embed.addFields({
        name: `${regimeEmoji} ${symbol}`,
        value: [
          `Precio: $${currentPrice.toLocaleString()} ${changeEmoji} ${parseFloat(change24h) >= 0 ? '+' : ''}${change24h}%`,
          `Régimen: ${regime.regime} | RSI: ${lastRsi.toFixed(1)} | VolRatio: ${volatility.volRatio.toFixed(3)}`,
          `ATR: $${lastAtr.toFixed(2)} | Volatilidad: ${volatility.valid ? '✅' : '❌'}`,
          `Alerta: ${alertStatus}`,
          divDetail ? `Divergencias: ${divDetail}` : '',
        ].filter(Boolean).join('\n'),
        inline: false,
      });
    } catch (err) {
      embed.addFields({
        name: `❌ ${token.symbol}`,
        value: `Error: ${err.message}`,
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
