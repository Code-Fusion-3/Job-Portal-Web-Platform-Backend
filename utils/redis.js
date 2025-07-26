const redis = require('redis');
const { promisify } = require('util');

// Redis client configuration
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with a individual error
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands with a individual error
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Promisify Redis commands
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const hgetAsync = promisify(redisClient.hget).bind(redisClient);
const hsetAsync = promisify(redisClient.hset).bind(redisClient);
const hdelAsync = promisify(redisClient.hdel).bind(redisClient);
const lpushAsync = promisify(redisClient.lpush).bind(redisClient);
const lrangeAsync = promisify(redisClient.lrange).bind(redisClient);
const llenAsync = promisify(redisClient.llen).bind(redisClient);
const expireAsync = promisify(redisClient.expire).bind(redisClient);
const publishAsync = promisify(redisClient.publish).bind(redisClient);

// Connect to Redis
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Message caching functions
const messageCache = {
  // Cache message for 1 hour
  async cacheMessage(messageId, messageData) {
    try {
      await setAsync(`message:${messageId}`, JSON.stringify(messageData), 'EX', 3600);
    } catch (error) {
      console.error('Redis cache error:', error);
    }
  },

  // Get cached message
  async getCachedMessage(messageId) {
    try {
      const cached = await getAsync(`message:${messageId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get cache error:', error);
      return null;
    }
  },

  // Cache conversation for 30 minutes
  async cacheConversation(requestId, messages) {
    try {
      await setAsync(`conversation:${requestId}`, JSON.stringify(messages), 'EX', 1800);
    } catch (error) {
      console.error('Redis conversation cache error:', error);
    }
  },

  // Get cached conversation
  async getCachedConversation(requestId) {
    try {
      const cached = await getAsync(`conversation:${requestId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get conversation cache error:', error);
      return null;
    }
  }
};

// Real-time messaging functions
const realTimeMessaging = {
  // Store user's online status
  async setUserOnline(userId, socketId) {
    try {
      await hsetAsync('online_users', userId.toString(), socketId);
      await expireAsync('online_users', 3600); // 1 hour
    } catch (error) {
      console.error('Redis set online error:', error);
    }
  },

  // Get user's socket ID
  async getUserSocket(userId) {
    try {
      return await hgetAsync('online_users', userId.toString());
    } catch (error) {
      console.error('Redis get socket error:', error);
      return null;
    }
  },

  // Remove user from online list
  async setUserOffline(userId) {
    try {
      await hdelAsync('online_users', userId.toString());
    } catch (error) {
      console.error('Redis set offline error:', error);
    }
  },

  // Publish message to channel
  async publishMessage(channel, message) {
    try {
      await publishAsync(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Redis publish error:', error);
    }
  },

  // Store unread message count
  async incrementUnreadCount(userId, requestId) {
    try {
      const key = `unread:${userId}:${requestId}`;
      const current = await getAsync(key) || '0';
      await setAsync(key, (parseInt(current) + 1).toString(), 'EX', 86400); // 24 hours
    } catch (error) {
      console.error('Redis increment unread error:', error);
    }
  },

  // Get unread message count
  async getUnreadCount(userId, requestId) {
    try {
      const key = `unread:${userId}:${requestId}`;
      const count = await getAsync(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Redis get unread error:', error);
      return 0;
    }
  },

  // Mark messages as read
  async markAsRead(userId, requestId) {
    try {
      const key = `unread:${userId}:${requestId}`;
      await delAsync(key);
    } catch (error) {
      console.error('Redis mark read error:', error);
    }
  }
};

// Session management functions
const sessionManager = {
  // Store session data
  async setSession(sessionId, sessionData) {
    try {
      await setAsync(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', 86400); // 24 hours
    } catch (error) {
      console.error('Redis session set error:', error);
    }
  },

  // Get session data
  async getSession(sessionId) {
    try {
      const session = await getAsync(`session:${sessionId}`);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Redis session get error:', error);
      return null;
    }
  },

  // Delete session
  async deleteSession(sessionId) {
    try {
      await delAsync(`session:${sessionId}`);
    } catch (error) {
      console.error('Redis session delete error:', error);
    }
  }
};

// Rate limiting functions
const rateLimiter = {
  // Check rate limit
  async checkRateLimit(key, limit, window) {
    try {
      const current = await getAsync(`rate_limit:${key}`);
      if (current && parseInt(current) >= limit) {
        return false; // Rate limit exceeded
      }
      
      const newCount = (parseInt(current) || 0) + 1;
      await setAsync(`rate_limit:${key}`, newCount.toString(), 'EX', window);
      return true; // Within rate limit
    } catch (error) {
      console.error('Redis rate limit error:', error);
      return true; // Allow if Redis fails
    }
  }
};

module.exports = {
  redisClient,
  messageCache,
  realTimeMessaging,
  sessionManager,
  rateLimiter
}; 