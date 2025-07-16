const winston = require("winston")
const path = require("path")

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: "telegram-ecommerce-bot" },
      transports: [
        new winston.transports.File({
          filename: path.join("logs", "error.log"),
          level: "error",
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join("logs", "combined.log"),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    })

    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      )
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, meta)
  }

  error(message, error = null, meta = {}) {
    this.logger.error(message, { error: error?.stack || error, ...meta })
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta)
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta)
  }
}

module.exports = Logger
