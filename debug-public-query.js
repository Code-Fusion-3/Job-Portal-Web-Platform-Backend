const { getPrismaClient } = require('./utils/database');

async function testPublicJobSeekersQuery() {
  console.log('🔍 Testing public job seekers query...');
  
  try {
    const prisma = await getPrismaClient();
    
    console.log('✅ Database connection established');
    
    // Test basic connection
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic query works');
    
    // Test simple counts
    console.log('\n📊 Testing basic counts:');
    
    try {
      const totalProfiles = await prisma.profile.count();
      console.log(`- Total profiles: ${totalProfiles}`);
    } catch (error) {
      console.error(`❌ Total profiles count failed: ${error.message}`);
    }
    
    try {
      const activeProfiles = await prisma.profile.count({
        where: { isActive: true }
      });
      console.log(`- Active profiles: ${activeProfiles}`);
    } catch (error) {
      console.error(`❌ Active profiles count failed: ${error.message}`);
    }
    
    try {
      const approvedProfiles = await prisma.profile.count({
        where: { 
          approvalStatus: 'approved',
          isActive: true 
        }
      });
      console.log(`- Approved active profiles: ${approvedProfiles}`);
    } catch (error) {
      console.error(`❌ Approved active profiles count failed: ${error.message}`);
    }
    
    // Test the problematic query with nested relation
    console.log('\n🎯 Testing nested relation query:');
    
    try {
      const jobseekerProfiles = await prisma.profile.count({
        where: {
          approvalStatus: 'approved',
          isActive: true,
          user: {
            role: 'jobseeker'
          }
        }
      });
      console.log(`- Jobseeker profiles (simplified): ${jobseekerProfiles}`);
    } catch (error) {
      console.error(`❌ Jobseeker profiles count failed: ${error.message}`);
    }
    
    // Test the old complex nested relation
    try {
      const complexQuery = await prisma.profile.count({
        where: {
          approvalStatus: 'approved',
          isActive: true,
          user: {
            is: { role: 'jobseeker' }
          }
        }
      });
      console.log(`- Complex nested relation: ${complexQuery}`);
    } catch (error) {
      console.error(`❌ Complex nested relation failed: ${error.message}`);
    }
    
    // Test actual data fetch
    console.log('\n📋 Testing data fetch:');
    
    try {
      const profiles = await prisma.profile.findMany({
        where: {
          approvalStatus: 'approved',
          isActive: true,
          user: {
            role: 'jobseeker'
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: {
            select: { id: true, createdAt: true }
          }
        },
        take: 5
      });
      console.log(`✅ Found ${profiles.length} profiles`);
      profiles.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.firstName} ${p.lastName} (ID: JS${p.user.id.toString().padStart(4, '0')})`);
      });
    } catch (error) {
      console.error(`❌ Data fetch failed: ${error.message}`);
    }
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testPublicJobSeekersQuery();