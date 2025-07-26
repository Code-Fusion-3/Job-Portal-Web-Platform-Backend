const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jobportal.com' },
    update: {},
    create: {
      email: 'admin@jobportal.com',
      password: adminPassword,
      role: 'admin',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create job categories
  const jobCategories = [
    {
      name_en: 'Software Development',
      name_rw: 'Ubwubatsi bwa Software'
    },
    {
      name_en: 'Data Science',
      name_rw: 'Ubumenyi bw\'Amakuru'
    },
    {
      name_en: 'Marketing',
      name_rw: 'Ubwubatsi bw\'Amatangazo'
    },
    {
      name_en: 'Finance',
      name_rw: 'Imari'
    },
    {
      name_en: 'Healthcare',
      name_rw: 'Ubuzima'
    },
    {
      name_en: 'Education',
      name_rw: 'Uburezi'
    },
    {
      name_en: 'Sales',
      name_rw: 'Ubwubatsi bw\'Amatangazo'
    },
    {
      name_en: 'Customer Service',
      name_rw: 'Serivisi z\'Abakiriya'
    }
  ];

  // Check if categories already exist
  const existingCategories = await prisma.jobCategory.findMany();
  
  if (existingCategories.length === 0) {
    await prisma.jobCategory.createMany({
      data: jobCategories,
      skipDuplicates: true,
    });
    console.log('✅ Job categories created:', jobCategories.length);
  } else {
    console.log('ℹ️ Job categories already exist, skipping...');
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 