const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create job categories
  const categories = [
    { name_en: 'Software Developer', name_rw: 'Umubatsi wa Software' },
    { name_en: 'Housemaid', name_rw: 'Umukozi wa Nzu' },
    { name_en: 'Gardener', name_rw: 'Umukozi wa Umurima' },
    { name_en: 'Driver', name_rw: 'Umushoferi' },
    { name_en: 'Cook', name_rw: 'Umupishi' },
    { name_en: 'Security Guard', name_rw: 'Umukingi' }
  ];

  // Clear existing categories and create new ones
  await prisma.jobCategory.deleteMany();
  
  for (const category of categories) {
    await prisma.jobCategory.create({
      data: category
    });
  }

  console.log('✅ Job categories created');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@jobportal.com' },
    update: {},
    create: {
      email: 'admin@jobportal.com',
      password: adminPassword,
      role: 'admin',
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          description: 'System Administrator',
          skills: 'Management, Administration',
          gender: 'Male',
          contactNumber: '+250788000000',
          location: 'Kigali, Rwanda',
          city: 'Kigali',
          country: 'Rwanda'
        }
      }
    }
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create test job seekers
  const jobSeekers = [
    {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      skills: 'JavaScript, React, Node.js, Python, Django, PostgreSQL, AWS, Docker, Git',
      gender: 'Male',
      contactNumber: '+250788123456',
      location: 'Kigali, Rwanda',
      city: 'Kigali',
      country: 'Rwanda',
      description: 'Experienced software developer with 5 years of experience',
      experience: '5 years in web development',
      monthlyRate: '500000'
    },
    {
      email: 'sarah.johnson@example.com',
      firstName: 'Sarah',
      lastName: 'Johnson',
      skills: 'House Cleaning, Laundry, Ironing, Cooking, Childcare, Elderly Care',
      gender: 'Female',
      contactNumber: '+250788234567',
      location: 'Kigali, Rwanda',
      city: 'Kigali',
      country: 'Rwanda',
      description: 'Professional housekeeper with excellent references',
      experience: '3 years in domestic work',
      monthlyRate: '300000'
    },
    {
      email: 'mike.gardener@example.com',
      firstName: 'Mike',
      lastName: 'Gardener',
      skills: 'Gardening, Landscaping, Plant Care, Basic Repairs, Maintenance',
      gender: 'Male',
      contactNumber: '+250788345678',
      location: 'Kigali, Rwanda',
      city: 'Kigali',
      country: 'Rwanda',
      description: 'Skilled gardener with knowledge of local plants',
      experience: '4 years in gardening and landscaping',
      monthlyRate: '250000'
    }
  ];

  for (const seeker of jobSeekers) {
    const password = await bcrypt.hash('password123', 10);
    const { email, firstName, lastName, skills, gender, contactNumber, location, city, country, description, experience, monthlyRate } = seeker;
    
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password,
        role: 'jobseeker',
        profile: {
          create: {
            firstName,
            lastName,
            description,
            skills,
            gender,
            contactNumber,
            location,
            city,
            country,
            experience,
            monthlyRate: monthlyRate ? monthlyRate.toString() : null
          }
        }
      }
    });
  }

  console.log('✅ Job seekers created');

  // Create some employer requests
  const requests = [
    {
      name: 'Tech Company Ltd',
      email: 'hr@techcompany.com',
      phoneNumber: '+250788456789',
      companyName: 'Tech Company Ltd',
      message: 'Looking for experienced software developers for our team',
      status: 'pending',
      priority: 'high'
    },
    {
      name: 'Home Services',
      email: 'info@homeservices.com',
      phoneNumber: '+250788567890',
      companyName: 'Home Services',
      message: 'Need reliable housekeeper for residential property',
      status: 'in_progress',
      priority: 'normal'
    }
  ];

  // Clear existing requests and create new ones
  await prisma.employerRequest.deleteMany();
  
  for (const request of requests) {
    await prisma.employerRequest.create({
      data: request
    });
  }

  console.log('✅ Employer requests created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('👤 Admin: admin@jobportal.com / admin123');
  console.log('👤 Job Seeker 1: john.doe@example.com / password123');
  console.log('👤 Job Seeker 2: sarah.johnson@example.com / password123');
  console.log('👤 Job Seeker 3: mike.gardener@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });