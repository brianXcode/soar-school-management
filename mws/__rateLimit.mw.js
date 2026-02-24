module.exports = ({ meta, config, managers, cache }) => {
    cache = cache || require('../cache/cache.dbh')({
        prefix: config.dotEnv.CACHE_PREFIX,
        url: config.dotEnv.CACHE_REDIS,
    });

    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_REQUESTS = 100;

    return async ({ req, res, next }) => {
        const requestIp = require('request-ip');
        const ip = requestIp.getClientIp(req) || 'unknown';
        const key = `ratelimit:${ip}`;
        const now = Date.now();

        try {
            // Remove old entries outside the window
            await cache.sorted.remove({ key, field: `${now - WINDOW_MS}` }).catch(() => {});

            // Get current count
            const entries = await cache.sorted.get({
                key,
                start: 0,
                end: -1,
            });

            if (entries && entries.length >= MAX_REQUESTS) {
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 429,
                    message: 'Too many requests. Please try again later.',
                });
            }

            // Add current request
            await cache.sorted.set({
                key,
                scores: [now, `${now}:${Math.random()}`],
            });

            // Set expiry on the key
            await cache.key.expire({ key, expire: Math.ceil(WINDOW_MS / 1000) });

            next({});
        } catch (err) {
            // If rate limiting fails, let the request through
            next({});
        }
    };
};
