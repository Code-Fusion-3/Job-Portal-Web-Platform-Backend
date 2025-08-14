const redis = require('redis');

// Redis client configuration
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Connect to Redis on startup
redisClient.connect().then(() => {
}).catch((err) => {
  console.error('❌ Redis client connection error:', err);
});

// Connect to Redis
redisClient.on('connect', async () => {
  // Test Redis set/get on startup
  try {
    await redisClient.set('copilot_test_key', 'connected');
    const testValue = await redisClient.get('copilot_test_key');
  } catch (err) {
    console.error('Redis test key error:', err);
  }
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Message caching functions
const messageCache = {
  // Cache message for 1 hour
  async cacheMessage(messageId, messageData) {
    try {
      await redisClient.setEx(`message:${messageId}`, 3600, JSON.stringify(messageData));
    } catch (error) {
      console.error('Redis cache error:', error);
    }
  },

  // Get cached message
  async getCachedMessage(messageId) {
    try {
      const cached = await redisClient.get(`message:${messageId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get cache error:', error);
      return null;
    }
  },

  // Cache conversation for 30 minutes
  async cacheConversation(requestId, messages) {
    try {
      await redisClient.setEx(`conversation:${requestId}`, 1800, JSON.stringify(messages));
    } catch (error) {
      console.error('Redis conversation cache error:', error);
    }
  },

  // Get cached conversation
  async getCachedConversation(requestId) {
    try {
      const cached = await redisClient.get(`conversation:${requestId}`);
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
      await redisClient.hSet('online_users', userId.toString(), socketId);
      await redisClient.expire('online_users', 3600); // 1 hour
    } catch (error) {
      console.error('Redis set online error:', error);
    }
  },

  // Get user's socket ID
  async getUserSocket(userId) {
    try {
      return await redisClient.hGet('online_users', userId.toString());
    } catch (error) {
      console.error('Redis get socket error:', error);
      return null;
    }
  },

  // Remove user from online list
  async setUserOffline(userId) {
    try {
      await redisClient.hDel('online_users', userId.toString());
    } catch (error) {
      console.error('Redis set offline error:', error);
    }
  },

  // Publish message to channel
  async publishMessage(channel, message) {
    try {
      await redisClient.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Redis publish error:', error);
    }
  },

  // Increment unread count
  async incrementUnreadCount(userId, requestId) {
    try {
      const key = `unread:${userId}:${requestId}`;
      await redisClient.incr(key);
      await redisClient.expire(key, 86400); // 24 hours
    } catch (error) {
      console.error('Redis increment unread error:', error);
    }
  },

  // Get unread count
  async getUnreadCount(userId, requestId) {
    try {
      const count = await redisClient.get(`unread:${userId}:${requestId}`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Redis get unread error:', error);
      return 0;
    }
  },

  // Mark messages as read
  async markAsRead(userId, requestId) {
    try {
      await redisClient.del(`unread:${userId}:${requestId}`);
    } catch (error) {
      console.error('Redis mark as read error:', error);
    }
  }
};

// Session management functions
const sessionManager = {
  // Store session data
  async setSession(sessionId, sessionData) {
    try {
      await redisClient.setEx(sessionId, 3600, JSON.stringify(sessionData)); // 1 hour
    } catch (error) {
      console.error('Redis set session error:', error);
    }
  },

  // Get session data
  async getSession(sessionId) {
    try {
      const session = await redisClient.get(sessionId);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Redis get session error:', error);
      return null;
    }
  },

  // Delete session
  async deleteSession(sessionId) {
    try {
      await redisClient.del(sessionId);
    } catch (error) {
      console.error('Redis delete session error:', error);
    }
  }
};

// Rate limiting functions
const rateLimiter = {
  // Check rate limit
  async checkRateLimit(key, limit, window) {
    try {
      const current = await redisClient.get(key);
      if (current && parseInt(current) >= limit) {
        return false; // Rate limit exceeded
      }
      
      await redisClient.multi()
        .incr(key)
        .expire(key, window)
        .exec();
      
      return true; // Within rate limit
    } catch (error) {
      console.error('Redis rate limit error:', error);
      return true; // Allow on error
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