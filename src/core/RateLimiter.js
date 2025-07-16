const { RateLimiterMemory } = require("rate-limiter-flexible")

class RateLimiter {
  constructor() {
    this.limiters = {
      global: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 100, // Number of requests
        duration: 60, // Per 60 seconds
      }),

      telegram: new RateLimiterMemory({
        keyGenerator: (chatId) => chatId,
        points: 30, // Number of messages
        duration: 60, // Per 60 seconds
      }),

      heavy: new RateLimiterMemory({
        keyGenerator: (chatId) => chatId,
        points: 5, // Number of heavy operations
        duration: 60, // Per 60 seconds
      }),
    }
  }

  middleware() {
    return async (req, res, next) => {
      try {
        await this.limiters.global.consume(req.ip)
        next()
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
        res.set("Retry-After", String(secs))
        res.status(429).json({
          error: "Too Many Requests",
          retryAfter: secs,
        })
      }
    }
  }

  async checkTelegramLimit(chatId) {
    try {
      await this.limiters.telegram.consume(chatId)
      return true
    } catch (rejRes) {
      return false
    }
  }

  async checkHeavyLimit(chatId) {
    try {
      await this.limiters.heavy.consume(chatId)
      return true
    } catch (rejRes) {
      return false
    }
  }
}

module.exports = RateLimiter
