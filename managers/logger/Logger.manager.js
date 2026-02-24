const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
    constructor({ config } = {}) {
        this.config = config;
        this.level = (config && config.dotEnv && config.dotEnv.LOG_LEVEL) || 'info';
        this.errorStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });
        this.combinedStream = fs.createWriteStream(path.join(LOG_DIR, 'combined.log'), { flags: 'a' });
    }

    _shouldLog(level) {
        return LEVELS[level] <= LEVELS[this.level];
    }

    _format(level, message, meta = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta,
        });
    }

    _write(level, message, meta) {
        if (!this._shouldLog(level)) return;

        const line = this._format(level, message, meta) + '\n';
        this.combinedStream.write(line);

        if (level === 'error' || level === 'warn') {
            this.errorStream.write(line);
        }
    }

    error(message, meta = {}) {
        if (meta instanceof Error) {
            meta = { stack: meta.stack, errorMessage: meta.message };
        }
        this._write('error', message, meta);
    }

    warn(message, meta = {}) {
        this._write('warn', message, meta);
    }

    info(message, meta = {}) {
        this._write('info', message, meta);
    }

    debug(message, meta = {}) {
        this._write('debug', message, meta);
    }
}

module.exports = Logger;
