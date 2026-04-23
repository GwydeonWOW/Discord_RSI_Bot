# RSI Divergence Crypto Bot

Bot de Discord para señales de trading en criptomonedas basado en la estrategia de **Divergencia RSI + Régimen + Estructura + ATR**.

## Características

- Scanner automático de divergencias RSI (ocultas y regulares)
- Filtro de régimen de mercado (alcista/bajista/neutro) en timeframe 1D
- Filtro de volatilidad (ATR ratio)
- Confirmación de entrada por ruptura estructural en 4H
- Alertas WATCH (pre-aviso) y ENTRY (señal confirmada)
- Botones interactivos para compra/venta
- Tracking de posiciones abiertas
- Stop loss automático con gestión por ATR
- Take profit (TP1 y TP2) con trailing
- Registro completo de operaciones y P&L

## Comandos

| Comando | Descripción |
|---|---|
| `/setalerts` | Configurar canal actual como canal de alertas |
| `/setpnl` | Configurar canal actual como canal de P&L |
| `/add <token>` | Añadir token a monitorizar (ej: btc, eth, sol) |
| `/remove <token>` | Eliminar token de la monitorización |
| `/list` | Ver tokens monitorizados |
| `/pnl` | Ver tabla de P&L de operaciones cerradas |
| `/positions` | Ver posiciones abiertas |

## Setup Rápido

### Con Docker (recomendado para Coolify)

1. Clona el repositorio
2. Crea un `.env` basado en `.env.example`
3. Crea un bot en [Discord Developer Portal](https://discord.com/developers/applications)
4. Activa los intents necesarios y obtén el token
5. Ejecuta:

```bash
docker-compose up -d
```

### Variables de Entorno

```env
DISCORD_TOKEN=tu_token_de_discord
DATABASE_URL=postgresql://rsibot:rsibot_secret@postgres:5432/rsibot
SCAN_CRON=0 */4 * * *
LOG_LEVEL=info
```

### Configuración en Discord

1. Invita el bot a tu servidor con permisos de: Send Messages, Embed Links, Manage Messages
2. Crea dos canales de texto: `#alertas` y `#pnl`
3. Ejecuta `/setalerts` en el canal de alertas
4. Ejecuta `/setpnl` en el canal de P&L
5. Añade tokens: `/add btc`, `/add eth`, `/add sol`...

## Estrategia

El bot implementa un sistema de 4 bloques:

1. **Régimen** (1D): EMA50 vs EMA200 + pendiente
2. **Setup** (4H): Divergencias RSI confirmadas por pivots
3. **Trigger** (4H): Ruptura estructural confirmada
4. **Riesgo**: Stop por ATR, TP1 a 1R, TP2 a 2.5R

### Tipos de señales

- **Continuación (principal)**: Divergencia oculta + régimen favorable
- **Reversión (secundario)**: Divergencia regular + régimen neutral/débil

## Licencia

MIT
