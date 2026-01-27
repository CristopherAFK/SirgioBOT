const { db } = require('../database');

const RATE_LIMITS = {
  'sugerir': 60000,
  'postular': 300000,
  'ticket': 60000,
  'sancion': 5000,
  'default': 3000
};

const localRateLimits = new Map();

module.exports = (client) => {
  console.log('✅ Sistema de rate limiting cargado');

  client.rateLimit = {
    async check(userId, command) {
      const limit = RATE_LIMITS[command] || RATE_LIMITS.default;
      const key = `${userId}_${command}`;

      const localEntry = localRateLimits.get(key);
      if (localEntry && Date.now() - localEntry < limit) {
        return {
          limited: true,
          remaining: Math.ceil((limit - (Date.now() - localEntry)) / 1000)
        };
      }

      try {
        const isLimited = await db.checkRateLimit(userId, command, limit);
        if (isLimited) {
          return {
            limited: true,
            remaining: Math.ceil(limit / 1000)
          };
        }
      } catch (err) {
        console.error('Error checking rate limit in DB:', err);
      }

      return { limited: false };
    },

    async set(userId, command) {
      const key = `${userId}_${command}`;
      localRateLimits.set(key, Date.now());

      try {
        await db.setRateLimit(userId, command);
      } catch (err) {
        console.error('Error setting rate limit in DB:', err);
      }
    },

    async checkAndSet(userId, command) {
      const result = await this.check(userId, command);
      if (!result.limited) {
        await this.set(userId, command);
      }
      return result;
    }
  };

  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of localRateLimits.entries()) {
      if (now - timestamp > 300000) {
        localRateLimits.delete(key);
      }
    }
  }, 60000);
};
