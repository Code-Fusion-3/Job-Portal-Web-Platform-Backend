const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdminProfile() {
  try {
    console.log('🔍 Checking for admin user...');
    
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { profile: true }
    });

    if (!adminUser) {
      console.log('❌ No admin user found. Creating admin user with profile...');
      
      const adminPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@jobportal.com',
          password: adminPassword,
          role: 'admin',
          profile: {
            create: {
              firstName: 'Admin',
              lastName: 'User',
              description: 'System Administrator for Job Portal',
              skills: 'Management, Administration, System Administration',
              gender: 'Male',
              contactNumber: '+250788000000',
              location: 'Kigali, Rwanda',
              city: 'Kigali',
              country: 'Rwanda',
              experienceLevel: 'Administrator',
              availability: 'Available',
              educationLevel: 'Administrative',
              languages: 'English, Kinyarwanda',
              certifications: 'System Administrator',
              monthlyRate: '0',
              experience: 'System Administration',
              dateOfBirth: new Date('1990-01-01'),
              idNumber: 'ADMIN001',
              references: 'System Reference',
              maritalStatus: 'Single'
            }
          }
        },
        include: { profile: true }
      });
      
      console.log('✅ Admin user created with profile:', newAdmin.email);
      console.log('Profile ID:', newAdmin.profile.id);
      
    } else if (!adminUser.profile) {
      console.log('⚠️ Admin user found but no profile. Creating profile...');
      
      const adminProfile = await prisma.profile.create({
        data: {
          userId: adminUser.id,
          firstName: 'Admin',
          lastName: 'User',
          description: 'System Administrator for Job Portal',
          skills: 'Management, Administration, System Administration',
          gender: 'Male',
          contactNumber: '+250788000000',
          location: 'Kigali, Rwanda',
          city: 'Kigali',
          country: 'Rwanda',
          experienceLevel: 'Administrator',
          availability: 'Available',
          educationLevel: 'Administrative',
          languages: 'English, Kinyarwanda',
          certifications: 'System Administrator',
          monthlyRate: '0',
          experience: 'System Administration',
          dateOfBirth: new Date('1990-01-01'),
          idNumber: 'ADMIN001',
          references: 'System Reference',
          maritalStatus: 'Single'
        }
      });
      
      console.log('✅ Admin profile created:', adminProfile.id);
      
    } else {
      console.log('✅ Admin user already has a profile');
      console.log('Admin ID:', adminUser.id);
      console.log('Profile ID:', adminUser.profile.id);
      console.log('Email:', adminUser.email);
      console.log('Name:', adminUser.profile.firstName, adminUser.profile.lastName);
    }

    // List all users with their profiles
    console.log('\n📋 All users with profiles:');
    const allUsers = await prisma.user.findMany({
      include: { profile: true }
    });
    
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) ${user.profile ? '✅ Has profile' : '❌ No profile'}`);
    });

  } catch (error) {
    console.error('❌ Error creating admin profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminProfile(); 