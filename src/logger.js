import winston from 'winston';
import config from './config.js';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${metaStr}`;
});

// In-memory log buffer (last 100 entries for dashboard)
const logBuffer = [];
const MAX_LOG_ENTRIES = 100;

const memoryTransport = new winston.transports.Stream({
  stream: {
    write: (raw) => {
      try {
        const entry = JSON.parse(raw);
        logBuffer.push({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
        });
        if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
      } catch {}
    },
  },
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
    memoryTransport,
  ],
});

export function getLogBuffer() {
  return [...logBuffer];
}

export default logger;
