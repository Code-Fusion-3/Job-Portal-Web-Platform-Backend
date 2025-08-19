const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const allProfiles = await prisma.profile.count();
    const byRole = await prisma.profile.count({ where: { user: { is: { role: 'jobseeker' } } } });
    const approvedOnly = await prisma.profile.count({ where: { approvalStatus: 'approved' } });
    const approvedActive = await prisma.profile.count({ where: { approvalStatus: 'approved', isActive: true } });
    const approvedActiveJobseeker = await prisma.profile.count({ where: { approvalStatus: 'approved', isActive: true, user: { is: { role: 'jobseeker' } } } });

    let statusGroups = [];
    try {
      statusGroups = await prisma.profile.groupBy({
        by: ['approvalStatus', 'isActive'],
        _count: { _all: true },
      });
    } catch (e) {
      // groupBy may fail on older Prisma versions; ignore
    }

    const samples = await prisma.profile.findMany({
      where: {
        approvalStatus: 'approved',
        isActive: true,
        user: { is: { role: 'jobseeker' } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        approvalStatus: true,
        isActive: true,
        user: { select: { id: true, role: true, createdAt: true } },
      },
      take: 5,
      orderBy: { user: { createdAt: 'desc' } },
    });

    console.log('Counts:');
    console.log({ allProfiles, byRole, approvedOnly, approvedActive, approvedActiveJobseeker });
    if (statusGroups.length) {
      console.log('Status groups:');
      for (const g of statusGroups) {
        console.log(`${g.approvalStatus} / active=${g.isActive} => ${g._count._all}`);
      }
    }
    console.log('Sample approved+active+jobseeker profiles:');
    console.dir(samples, { depth: null });
  } catch (err) {
    console.error('Debug error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
