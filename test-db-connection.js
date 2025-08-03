const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check if we can query the database
    const requestCount = await prisma.employerRequest.count();
    console.log(`✅ Database has ${requestCount} employer requests`);
    
    // Check the highest ID
    const maxRequest = await prisma.employerRequest.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true, name: true, email: true }
    });
    
    console.log(`✅ Highest request ID: ${maxRequest?.id || 0}`);
    if (maxRequest) {
      console.log(`   Last request: ${maxRequest.name} (${maxRequest.email})`);
    }
    
    // Try to create a test request
    console.log('\nTesting request creation...');
    const testRequest = await prisma.employerRequest.create({
      data: {
        name: 'Connection Test',
        email: 'test@connection.com',
        message: 'Testing database connection',
        status: 'pending'
      }
    });
    
    console.log(`✅ Created test request with ID: ${testRequest.id}`);
    
    // Verify it was saved
    const savedRequest = await prisma.employerRequest.findUnique({
      where: { id: testRequest.id }
    });
    
    if (savedRequest) {
      console.log(`✅ Test request was saved successfully`);
    } else {
      console.log(`❌ Test request was not saved`);
    }
    
    // Clean up test request
    await prisma.employerRequest.delete({
      where: { id: testRequest.id }
    });
    console.log(`✅ Cleaned up test request`);
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection(); 