import winston from 'winston';
import { Writable } from 'stream';
import config from './config.js';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${metaStr}`;
});

// In-memory log buffer (last 100 entries for dashboard)
const logBuffer = [];
const MAX_LOG_ENTRIES = 100;

const memoryStream = new Writable({
  write(chunk, encoding, callback) {
    try {
      const entry = JSON.parse(chunk.toString());
      logBuffer.push({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
      });
      if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
    } catch {}
    callback();
  },
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
    new winston.transports.Stream({ stream: memoryStream }),
  ],
});

export function getLogBuffer() {
  return [...logBuffer];
}

export default logger;
