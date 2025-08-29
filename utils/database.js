const { PrismaClient } = require('@prisma/client');

// Global singleton Prisma instance
let prismaInstance = null;
let isConnecting = false;
let connectionPromise = null;

// Create a single Prisma client instance with strict connection management
const createPrismaClient = async () => {
  // If already connecting, wait for that connection
  if (isConnecting && connectionPromise) {
    console.log('⏳ Waiting for existing connection...');
    return await connectionPromise;
  }

  // If instance exists, return it
  if (prismaInstance) {
    return prismaInstance;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    throw new Error('Connection already in progress');
  }

  isConnecting = true;
  console.log('🔌 Creating new Prisma client instance...');
  
  try {
    // Add strict connection pooling parameters to the URL
    let connectionUrl = process.env.DATABASE_URL;
    if (connectionUrl && !connectionUrl.includes('connection_limit')) {
      const separator = connectionUrl.includes('?') ? '&' : '?';
      // Very strict limits for shared hosting
      connectionUrl += `${separator}connection_limit=2&pool_timeout=10&acquire_timeout=30000&idle_timeout=30000&max_idle_time=30000`;
    }
    
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    // Handle connection events
    prismaInstance.$on('query', (e) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Query: ${e.query}`);
        console.log(`⏱️  Duration: ${e.duration}ms`);
      }
    });

    prismaInstance.$on('error', (e) => {
      console.error('❌ Prisma Error:', e);
      // If we get connection errors, reset the instance
      if (e.code === 'P2037' || e.message.includes('Too many database connections')) {
        console.log('🔄 Connection limit exceeded, resetting Prisma instance...');
        prismaInstance = null;
        isConnecting = false;
        connectionPromise = null;
      }
    });

    // Handle process events for graceful shutdown
    const cleanup = async () => {
      console.log('🔄 Cleaning up Prisma connections...');
      if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
        isConnecting = false;
        connectionPromise = null;
      }
    };

    process.on('beforeExit', cleanup);
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });

    console.log('✅ Prisma client created successfully');
    return prismaInstance;
    
  } catch (error) {
    console.error('❌ Failed to create Prisma client:', error);
    prismaInstance = null;
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Get the singleton Prisma client with connection management
const getPrismaClient = async () => {
  try {
    if (!prismaInstance && !isConnecting) {
      connectionPromise = createPrismaClient();
      prismaInstance = await connectionPromise;
      connectionPromise = null;
    } else if (connectionPromise) {
      prismaInstance = await connectionPromise;
      connectionPromise = null;
    }
    
    return prismaInstance;
  } catch (error) {
    console.error('❌ Error getting Prisma client:', error);
    // Reset state on error
    prismaInstance = null;
    isConnecting = false;
    connectionPromise = null;
    throw error;
  }
};

// Graceful shutdown function
const closePrismaConnections = async () => {
  if (prismaInstance) {
    console.log('🔄 Closing all Prisma connections...');
    await prismaInstance.$disconnect();
    prismaInstance = null;
    isConnecting = false;
    connectionPromise = null;
  }
};

// Enhanced health check function with connection management
const checkDatabaseHealth = async () => {
  try {
    const client = await getPrismaClient();
    
    // Test basic connection
    await client.$queryRaw`SELECT 1`;
    
    // Test if tables exist
    const tables = await client.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `;
    
    console.log('✅ Database health check passed');
    console.log('📊 Available tables:', tables.map(t => t.TABLE_NAME));
    
    return { 
      status: 'healthy', 
      message: 'Database connection successful',
      tables: tables.map(t => t.TABLE_NAME)
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Reset connection on error
    if (error.code === 'P2037' || error.message.includes('Too many database connections')) {
      console.log('🔄 Resetting connection due to connection limit...');
      await closePrismaConnections();
    }
    
    return { status: 'unhealthy', message: error.message, details: error };
  }
};

// Test specific database operations with connection management
const testDatabaseOperations = async () => {
  try {
    const client = await getPrismaClient();
    
    console.log('🧪 Testing database operations...');
    
    // Test User table
    const userCount = await client.user.count();
    console.log(`✅ User table: ${userCount} records`);
    
    // Test Profile table
    const profileCount = await client.profile.count();
    console.log(`✅ Profile table: ${profileCount} records`);
    
    // Test JobCategory table
    const categoryCount = await client.jobCategory.count();
    console.log(`✅ JobCategory table: ${categoryCount} records`);
    
    return { success: true, counts: { userCount, profileCount, categoryCount } };
  } catch (error) {
    console.error('❌ Database operations test failed:', error);
    return { success: false, error: error.message };
  }
};

// Export the singleton instance
module.exports = {
  getPrismaClient,
  closePrismaConnections,
  checkDatabaseHealth,
  testDatabaseOperations,
  // Export the Prisma client for backward compatibility
  prisma: () => getPrismaClient()
};
