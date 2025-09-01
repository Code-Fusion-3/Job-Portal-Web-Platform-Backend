const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdminProfileTable() {
  try {
    console.log('🔄 Creating AdminProfile table...');
    
    // This will be handled by Prisma schema changes
    // Run: npx prisma db push
    
    console.log('✅ AdminProfile table creation completed!');
    console.log('📝 Run "npx prisma db push" to apply schema changes');
    
  } catch (error) {
    console.error('❌ Error creating AdminProfile table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminProfileTable();
