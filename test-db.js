const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Check admin users
    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin' }
    });
    console.log('Admin users:', adminUsers.length);
    console.log('Admin emails:', adminUsers.map(u => u.email));
    
    // Check total requests
    const totalRequests = await prisma.employerRequest.count();
    console.log('Total employer requests:', totalRequests);
    
    // Check recent requests
    const recentRequests = await prisma.employerRequest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Recent requests:', recentRequests.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt
    })));
    
  } catch (error) {
    console.error('Database test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase(); 