const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('Creating test employer requests...');
    
    // Create test employer requests
    const testRequests = [
      {
        name: 'TechCorp Rwanda',
        email: 'hr@techcorp.rw',
        phoneNumber: '+250788123456',
        companyName: 'TechCorp Rwanda Ltd',
        message: 'Looking for React developers with 2+ years experience. Must be fluent in English and French.',
        status: 'pending',
        priority: 'high'
      },
      {
        name: 'Green Farms Ltd',
        email: 'jobs@greenfarms.rw',
        phoneNumber: '+250788654321',
        companyName: 'Green Farms Rwanda',
        message: 'Need experienced farm workers for our new location in Musanze. Experience with organic farming preferred.',
        status: 'in_progress',
        priority: 'normal'
      },
      {
        name: 'Kigali Construction',
        email: 'recruitment@kigaliconstruction.rw',
        phoneNumber: '+250788111222',
        companyName: 'Kigali Construction Company',
        message: 'Seeking skilled carpenters and electricians for ongoing projects in Kigali. Competitive salary offered.',
        status: 'approved',
        priority: 'urgent'
      },
      {
        name: 'Rwanda Tourism',
        email: 'careers@rwandatourism.rw',
        phoneNumber: '+250788333444',
        companyName: 'Rwanda Tourism Board',
        message: 'Looking for tour guides fluent in English, French, and Kinyarwanda. Experience with international tourists required.',
        status: 'completed',
        priority: 'normal'
      },
      {
        name: 'Digital Solutions Rwanda',
        email: 'jobs@digitalsolutions.rw',
        phoneNumber: '+250788555666',
        companyName: 'Digital Solutions Rwanda',
        message: 'Seeking UI/UX designers and mobile app developers. Experience with React Native and Figma preferred.',
        status: 'pending',
        priority: 'high'
      }
    ];
    
    for (const request of testRequests) {
      const created = await prisma.employerRequest.create({
        data: request
      });
      console.log(`Created request: ${created.name} (${created.status})`);
    }
    
    console.log('Test data created successfully!');
    
    // Verify the data
    const totalRequests = await prisma.employerRequest.count();
    console.log(`Total requests in database: ${totalRequests}`);
    
    const statusCounts = await prisma.employerRequest.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    console.log('Status breakdown:');
    statusCounts.forEach(item => {
      console.log(`  ${item.status}: ${item._count.status}`);
    });
    
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData(); 