const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkAdminProfile() {
  try {
    console.log('🔍 Checking admin profile data...');
    
    // Find admin user with profile
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { profile: true }
    });

    if (adminUser) {
      console.log('✅ Admin user found:');
      console.log('User ID:', adminUser.id);
      console.log('Email:', adminUser.email);
      console.log('Role:', adminUser.role);
      console.log('Created At:', adminUser.createdAt);
      console.log('Updated At:', adminUser.updatedAt);
      
      if (adminUser.profile) {
        console.log('\n📋 Profile data:');
        console.log('Profile ID:', adminUser.profile.id);
        console.log('First Name:', adminUser.profile.firstName);
        console.log('Last Name:', adminUser.profile.lastName);
        console.log('Contact Number:', adminUser.profile.contactNumber);
        console.log('Location:', adminUser.profile.location);
        console.log('Description:', adminUser.profile.description);
        console.log('Photo:', adminUser.profile.photo);
        console.log('Skills:', adminUser.profile.skills);
        console.log('Experience Level:', adminUser.profile.experienceLevel);
        console.log('Availability:', adminUser.profile.availability);
        console.log('Education Level:', adminUser.profile.educationLevel);
        console.log('Languages:', adminUser.profile.languages);
        console.log('Certifications:', adminUser.profile.certifications);
        console.log('Monthly Rate:', adminUser.profile.monthlyRate);
        console.log('Created At:', adminUser.profile.createdAt);
        console.log('Updated At:', adminUser.profile.updatedAt);
        
        // Simulate what the API should return
        const adminProfile = {
          id: adminUser.id,
          firstName: adminUser.profile?.firstName || 'Admin',
          lastName: adminUser.profile?.lastName || 'User',
          email: adminUser.email || '',
          phone: adminUser.profile?.contactNumber || '',
          location: adminUser.profile?.location || 'Kigali, Rwanda',
          bio: adminUser.profile?.description || 'System Administrator for Job Portal',
          avatar: adminUser.profile?.photo || null,
          role: adminUser.role,
          createdAt: adminUser.createdAt,
          updatedAt: adminUser.updatedAt
        };
        
        console.log('\n🎯 API Response (what frontend should receive):');
        console.log(JSON.stringify(adminProfile, null, 2));
        
      } else {
        console.log('❌ No profile found for admin user');
      }
    } else {
      console.log('❌ No admin user found');
    }

  } catch (error) {
    console.error('❌ Error checking admin profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminProfile(); 