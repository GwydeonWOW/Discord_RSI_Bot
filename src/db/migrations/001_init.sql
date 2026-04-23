-- Guilds (Discord servers)
CREATE TABLE IF NOT EXISTS guilds (
  id BIGINT PRIMARY KEY,
  alerts_channel_id BIGINT,
  pnl_channel_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitored tokens per guild
CREATE TABLE IF NOT EXISTS monitored_tokens (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  base_asset TEXT NOT NULL,
  added_by BIGINT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, symbol)
);

-- Watch states (divergence detected but not yet confirmed)
CREATE TABLE IF NOT EXISTS watch_states (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES monitored_tokens(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  pivot_data JSONB,
  message_id BIGINT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Alerts (all alert messages sent)
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES monitored_tokens(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_id BIGINT,
  channel_id BIGINT,
  data JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Open and closed positions
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  token_id INTEGER REFERENCES monitored_tokens(id) ON DELETE CASCADE,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  stop_price DECIMAL(20, 8),
  tp1_price DECIMAL(20, 8),
  tp2_price DECIMAL(20, 8),
  risk_amount DECIMAL(20, 8),
  message_id BIGINT,
  status TEXT DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT NOW()
);

-- Completed trade records for PnL tracking
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
  exit_price DECIMAL(20, 8) NOT NULL,
  exit_reason TEXT NOT NULL,
  pnl DECIMAL(20, 8),
  pnl_pct DECIMAL(10, 4),
  closed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitored_tokens_guild ON monitored_tokens(guild_id);
CREATE INDEX IF NOT EXISTS idx_monitored_tokens_active ON monitored_tokens(active);
CREATE INDEX IF NOT EXISTS idx_watch_states_active ON watch_states(active);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_guild ON positions(guild_id);
CREATE INDEX IF NOT EXISTS idx_trades_position ON trades(position_id);
