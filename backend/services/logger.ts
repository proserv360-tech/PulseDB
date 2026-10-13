// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/logger.js
 * Central structured logger (pino).
 *
 * Exposes:
 *   - logger:      the pino instance (child loggers via logger.child())
 *   - log():       backward-compatible (level, message, meta) helper that
 *                  matches the legacy hand-rolled JSON logger's signature,
 *                  so existing call sites keep working unchanged.
 *   - httpLogger(): pino-http middleware for request logging.
 *
 * Falls back to a console-based shim if pino is not installed, so the
 * server never fails to boot because of the logger.
 */

let pino = null;
let pinoHttp = null;
try {
    pino = (await import('pino')).default;
    pinoHttp = (await import('pino-http')).default;
} catch {
    /* optional — falls back to console shim below */
}

const LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

export const logger = pino
    ? pino({
          level: LEVEL,
          base: { service: 'pulsedb-backend' },
          timestamp: pino.stdTimeFunctions.isoTime,
          redact: {
              paths: [
                  'password',
                  '*.password',
                  'req.headers.authorization',
                  'req.headers.cookie',
                  'token',
                  '*.token',
                  'connectionString',
                  '*.connectionString',
              ],
              censor: '[REDACTED]',
          },
      })
    : {
          // console shim with the same call shape
          info: (o, m) => console.log(JSON.stringify({ level: 'INFO', msg: m ?? o, ...(m ? o : {}) })),
          warn: (o, m) => console.warn(JSON.stringify({ level: 'WARN', msg: m ?? o, ...(m ? o : {}) })),
          error: (o, m) => console.error(JSON.stringify({ level: 'ERROR', msg: m ?? o, ...(m ? o : {}) })),
          debug: () => {},
          child: () => logger,
      };

/**
 * Legacy-compatible helper: log('ERROR', 'message', { meta })
 */
export function log(level, message, meta = {}) {
    const lvl = String(level || 'INFO').toUpperCase();
    if (lvl === 'ERROR') logger.error(meta, message);
    else if (lvl === 'WARN') logger.warn(meta, message);
    else if (lvl === 'DEBUG') logger.debug(meta, message);
    else logger.info(meta, message);
}

/**
 * pino-http request-logging middleware. No-op middleware when pino-http
 * is unavailable.
 */
export function httpLogger() {
    if (!pinoHttp) return (_req, _res, next) => next();
    return pinoHttp({
        logger,
        autoLogging: {
            ignore: (req) => req.url === '/health' || req.url === '/api/health',
        },
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
    });
}

export default logger;
