const { getPrismaClient } = require('../utils/database');
const { getAnonymizedJobSeekerData } = require('../utils/dataAnonymizer');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Employer: Get their request history
exports.getEmployerRequestHistory = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const employerId = req.user.id;
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { status, priority, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const whereClause = {
      employerAccount: { userId: employerId }
    };
    
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { requestedCandidate: {
          profile: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } }
            ]
          }
        }}
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.employerRequest.findMany({
        where: whereClause,
        include: {
          requestedCandidate: {
            include: {
              profile: {
                include: { jobCategory: true }
              }
            }
          },
          payments: {
            include: { paymentMethod: true }
          },
          requestProgress: { orderBy: { createdAt: 'asc' } }
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.employerRequest.count({ where: whereClause })
    ]);

    // Apply anonymization
    const anonymizedRequests = requests.map(request => {
      if (request.requestedCandidate) {
        const anonymizedCandidate = getAnonymizedJobSeekerData(request.requestedCandidate, request);
        return { ...request, requestedCandidate: anonymizedCandidate };
      }
      return request;
    });

    // Get summary statistics
    const summary = await prisma.employerRequest.groupBy({
      by: ['status'],
      where: { employerAccount: { userId: employerId } },
      _count: { status: true }
    });

    const statusSummary = summary.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    res.json({
      requests: anonymizedRequests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { totalRequests: total, statusCounts: statusSummary }
    });

  } catch (err) {
    console.error('Get employer request history error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch request history.' });
  }
};

// Admin: Get request reports
exports.getRequestReports = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { period = '30', status, category } = req.query;
    
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const baseWhere = { createdAt: { gte: startDate } };
    if (status) baseWhere.status = status;
    if (category) {
      baseWhere.requestedCandidate = {
        profile: {
          jobCategory: { name_en: { equals: category, mode: 'insensitive' } }
        }
      };
    }

    // Get request trends
    const requestTrends = await prisma.employerRequest.groupBy({
      by: ['createdAt'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { createdAt: 'asc' }
    });

    const trendsData = requestTrends.reduce((acc, item) => {
      const key = item.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + item._count.id;
      return acc;
    }, {});

    // Get status distribution
    const statusDistribution = await prisma.employerRequest.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true }
    });

    // Get payment statistics
    const paymentStats = await prisma.payment.groupBy({
      by: ['status'],
      where: { employerRequest: baseWhere },
      _count: { id: true },
      _sum: { amount: true }
    });

    // Get conversion rates
    const totalRequests = await prisma.employerRequest.count({ where: baseWhere });
    const approvedRequests = await prisma.employerRequest.count({ 
      where: { ...baseWhere, status: 'approved' } 
    });

    res.json({
      period: `${days} days`,
      trends: { data: trendsData, totalRequests: Object.values(trendsData).reduce((a, b) => a + b, 0) },
      distributions: {
        status: statusDistribution.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {})
      },
      payments: {
        byStatus: paymentStats.reduce((acc, item) => {
          acc[item.status] = { count: item._count.id, totalAmount: parseFloat(item._sum.amount || 0) };
          return acc;
        }, {}),
        totalAmount: paymentStats.reduce((sum, item) => sum + parseFloat(item._sum.amount || 0), 0)
      },
      metrics: {
        totalRequests,
        approvedRequests,
        approvalRate: totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0
      }
    });

  } catch (err) {
    console.error('Get request reports error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate reports.' });
  }
};

// Admin: Get employer analytics
exports.getEmployerAnalytics = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { employerId } = req.params;
    const { period = '30' } = req.query;
    
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const employer = await prisma.employerAccount.findUnique({
      where: { id: parseInt(employerId, 10) },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!employer) {
      return res.status(404).json({ error: 'Employer not found.' });
    }

    const baseWhere = {
      employerAccountId: parseInt(employerId, 10),
      createdAt: { gte: startDate }
    };

    const [requestStats, paymentStats, totalRequests] = await Promise.all([
      prisma.employerRequest.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where: { employerRequest: baseWhere },
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.employerRequest.count({ where: baseWhere })
    ]);

    const approvedRequests = requestStats.find(item => item.status === 'approved')?._count.status || 0;
    const successRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0;
    const totalPaid = paymentStats
      .filter(item => item.status === 'approved')
      .reduce((sum, item) => sum + parseFloat(item._sum.amount || 0), 0);

    res.json({
      employer: {
        id: employer.id,
        name: employer.user.name,
        email: employer.user.email,
        companyName: employer.companyName
      },
      period: `${days} days`,
      statistics: {
        totalRequests,
        approvedRequests,
        successRate: Math.round(successRate * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100
      },
      requestBreakdown: requestStats.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      paymentBreakdown: paymentStats.reduce((acc, item) => {
        acc[item.status] = {
          count: item._count.id,
          totalAmount: parseFloat(item._sum.amount || 0)
        };
        return acc;
      }, {})
    });

  } catch (err) {
    console.error('Get employer analytics error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch employer analytics.' });
  }
};
