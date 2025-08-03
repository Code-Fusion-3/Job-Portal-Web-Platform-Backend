const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.jobCategory.create({
    data: {
      name_en: 'Engineering',
      name_rw: 'Ubwubatsi'
    }
  });
  
}

main().finally(() => prisma.$disconnect());