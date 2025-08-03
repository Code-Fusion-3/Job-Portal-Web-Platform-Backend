const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAllRequests() {
  try {
    console.log('Checking all employer requests...');
    
    // Get all requests ordered by ID
    const allRequests = await prisma.employerRequest.findMany({
      orderBy: { id: 'asc' }
    });
    
    console.log(`Total requests in database: ${allRequests.length}`);
    console.log('\nAll requests:');
    
    allRequests.forEach((request, index) => {
      console.log(`${index + 1}. ID: ${request.id} | Name: ${request.name} | Email: ${request.email} | Status: ${request.status} | Created: ${request.createdAt}`);
    });
    
    // Check for any requests with higher IDs
    const maxId = await prisma.employerRequest.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    
    console.log(`\nHighest request ID: ${maxId?.id || 0}`);
    
    // Check for any requests created after our test data
    const recentRequests = await prisma.employerRequest.findMany({
      where: {
        createdAt: {
          gt: new Date('2025-08-03T16:54:00.000Z') // After our test data
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\nRequests created after test data: ${recentRequests.length}`);
    recentRequests.forEach(request => {
      console.log(`- ID: ${request.id} | Name: ${request.name} | Email: ${request.email} | Status: ${request.status}`);
    });
    
  } catch (error) {
    console.error('Error checking requests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllRequests(); 