const { getPrismaClient } = require('../utils/database');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Get comprehensive dashboard analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { period = '30' } = req.query;
    
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all statistics in parallel
    const [
      totalRequests,
      totalEmployers,
      totalJobSeekers,
      totalPayments,
      totalRevenue,
      statusDistribution,
      priorityDistribution,
      categoryDistribution,
      paymentDistribution,
      recentRequests,
      topEmployers,
      topCategories,
      dailyTrends
    ] = await Promise.all([
      // Total counts
      prisma.employerRequest.count({ where: { createdAt: { gte: startDate } } }),
      prisma.employerAccount.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({ where: { role: 'jobseeker', createdAt: { gte: startDate } } }),
      
      // Payment statistics
      prisma.payment.count({ 
        where: { 
          employerRequest: { createdAt: { gte: startDate } },
          status: 'approved'
        } 
      }),
      prisma.payment.aggregate({
        where: { 
          employerRequest: { createdAt: { gte: startDate } },
          status: 'approved'
        },
        _sum: { amount: true }
      }),

      // Distributions
      prisma.employerRequest.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: { status: true }
      }),
      prisma.employerRequest.groupBy({
        by: ['priority'],
        where: { createdAt: { gte: startDate } },
        _count: { priority: true }
      }),
      prisma.employerRequest.groupBy({
        by: ['requestedCandidate'],
        where: { 
          createdAt: { gte: startDate },
          requestedCandidate: { not: null }
        },
        _count: { id: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where: { employerRequest: { createdAt: { gte: startDate } } },
        _count: { id: true },
        _sum: { amount: true }
      }),

      // Recent activity
      prisma.employerRequest.findMany({
        where: { createdAt: { gte: startDate } },
        include: {
          employerAccount: {
            include: { user: { select: { name: true, email: true } } }
          },
          requestedCandidate: {
            include: { profile: { select: { firstName: true, lastName: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Top performers
      prisma.employerRequest.groupBy({
        by: ['employerAccount'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),
      prisma.employerRequest.groupBy({
        by: ['requestedCandidate'],
        where: { 
          createdAt: { gte: startDate },
          requestedCandidate: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),

      // Daily trends
      prisma.employerRequest.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // Format daily trends
    const trendsData = dailyTrends.reduce((acc, item) => {
      const key = item.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + item._count.id;
      return acc;
    }, {});

    // Calculate conversion rates
    const approvedRequests = statusDistribution.find(item => item.status === 'approved')?._count.status || 0;
    const pendingRequests = statusDistribution.find(item => item.status === 'pending')?._count.status || 0;
    const conversionRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0;

    // Calculate average request value
    const avgRequestValue = totalRequests > 0 ? parseFloat(totalRevenue._sum.amount || 0) / totalRequests : 0;

    // Get top employers with details
    const topEmployersWithDetails = await Promise.all(
      topEmployers.map(async (item) => {
        const employer = await prisma.employerAccount.findUnique({
          where: { id: item.employerAccount },
          include: { user: { select: { name: true, email: true, companyName: true } } }
        });
        return {
          id: item.employerAccount,
          name: employer?.user?.name || 'Unknown',
          email: employer?.user?.email || 'Unknown',
          companyName: employer?.companyName || 'Unknown',
          requestCount: item._count.id
        };
      })
    );

    // Get top categories with details
    const topCategoriesWithDetails = await Promise.all(
      topCategories.map(async (item) => {
        const category = await prisma.jobCategory.findUnique({
          where: { id: item.requestedCandidate }
        });
        return {
          id: item.requestedCandidate,
          name: category?.name_en || 'Unknown',
          requestCount: item._count.id
        };
      })
    );

    res.json({
      period: `${days} days`,
      overview: {
        totalRequests,
        totalEmployers,
        totalJobSeekers,
        totalPayments,
        totalRevenue: parseFloat(totalRevenue._sum.amount || 0),
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgRequestValue: Math.round(avgRequestValue * 100) / 100
      },
      distributions: {
        status: statusDistribution.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        priority: priorityDistribution.reduce((acc, item) => {
          acc[item.priority] = item._count.priority;
          return acc;
        }, {}),
        category: categoryDistribution.reduce((acc, item) => {
          acc[item.requestedCandidate] = item._count.id;
          return acc;
        }, {}),
        payment: paymentDistribution.reduce((acc, item) => {
          acc[item.status] = {
            count: item._count.id,
            totalAmount: parseFloat(item._sum.amount || 0)
          };
          return acc;
        }, {})
      },
      trends: {
        data: trendsData,
        totalRequests: Object.values(trendsData).reduce((a, b) => a + b, 0)
      },
      recentActivity: recentRequests.map(request => ({
        id: request.id,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        employer: {
          name: request.employerAccount.user.name,
          email: request.employerAccount.user.email,
          company: request.employerAccount.companyName
        },
        candidate: request.requestedCandidate ? {
          name: `${request.requestedCandidate.profile.firstName} ${request.requestedCandidate.profile.lastName}`
        } : null
      })),
      topPerformers: {
        employers: topEmployersWithDetails,
        categories: topCategoriesWithDetails
      },
      insights: {
        mostActivePeriod: getMostActivePeriod(trendsData),
        growthRate: calculateGrowthRate(trendsData),
        peakDay: getPeakDay(trendsData),
        lowActivityDays: getLowActivityDays(trendsData)
      }
    });

  } catch (err) {
    console.error('Get dashboard analytics error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch dashboard analytics.' });
  }
};

// Get real-time activity feed
exports.getActivityFeed = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { limit = 20 } = req.query;

    // Get recent activities from multiple sources
    const [recentRequests, recentPayments, recentProgress] = await Promise.all([
      prisma.employerRequest.findMany({
        include: {
          employerAccount: {
            include: { user: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3)
      }),
      prisma.payment.findMany({
        include: {
          employerRequest: {
            include: {
              employerAccount: {
                include: { user: { select: { name: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3)
      }),
      prisma.requestProgress.findMany({
        include: {
          employerRequest: {
            include: {
              employerAccount: {
                include: { user: { select: { name: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(limit / 3)
      })
    ]);

    // Combine and sort all activities
    const activities = [
      ...recentRequests.map(request => ({
        type: 'request_created',
        timestamp: request.createdAt,
        description: `New request from ${request.employerAccount.user.name}`,
        data: {
          requestId: request.id,
          status: request.status,
          priority: request.priority
        }
      })),
      ...recentPayments.map(payment => ({
        type: 'payment_' + payment.status,
        timestamp: payment.createdAt,
        description: `Payment ${payment.status} for request #${payment.employerRequest.id}`,
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status
        }
      })),
      ...recentProgress.map(progress => ({
        type: 'progress_' + progress.stage,
        timestamp: progress.createdAt,
        description: `Progress: ${progress.description}`,
        data: {
          requestId: progress.employerRequestId,
          stage: progress.stage,
          status: progress.status
        }
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

    res.json({
      activities,
      total: activities.length,
      lastUpdated: new Date()
    });

  } catch (err) {
    console.error('Get activity feed error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch activity feed.' });
  }
};

// Helper functions
function getMostActivePeriod(trendsData) {
  const entries = Object.entries(trendsData);
  if (entries.length === 0) return null;
  
  const maxEntry = entries.reduce((max, [date, count]) => 
    count > max.count ? { date, count } : max, 
    { date: entries[0][0], count: entries[0][1] }
  );
  
  return {
    date: maxEntry.date,
    count: maxEntry.count
  };
}

function calculateGrowthRate(trendsData) {
  const entries = Object.entries(trendsData).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length < 2) return 0;
  
  const firstHalf = entries.slice(0, Math.ceil(entries.length / 2));
  const secondHalf = entries.slice(Math.ceil(entries.length / 2));
  
  const firstHalfTotal = firstHalf.reduce((sum, [_, count]) => sum + count, 0);
  const secondHalfTotal = secondHalf.reduce((sum, [_, count]) => sum + count, 0);
  
  if (firstHalfTotal === 0) return secondHalfTotal > 0 ? 100 : 0;
  
  return ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;
}

function getPeakDay(trendsData) {
  return getMostActivePeriod(trendsData);
}

function getLowActivityDays(trendsData) {
  const entries = Object.entries(trendsData);
  if (entries.length === 0) return [];
  
  const avgCount = entries.reduce((sum, [_, count]) => sum + count, 0) / entries.length;
  const threshold = avgCount * 0.5; // Days with less than 50% of average
  
  return entries
    .filter(([_, count]) => count < threshold)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.count - b.count);
}
