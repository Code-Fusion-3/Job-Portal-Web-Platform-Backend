const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Admin: Get comprehensive dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalJobSeekers,
      totalEmployerRequests,
      totalCategories,
      recentJobSeekers,
      recentEmployerRequests,
      pendingEmployerRequests,
      categoryDistribution,
      locationDistribution,
      monthlyRegistrations,
      topSkills
    ] = await Promise.all([
      // Total job seekers
      prisma.user.count({
        where: { role: 'jobseeker' }
      }),
      
      // Total employer requests
      prisma.employerRequest.count(),
      
      // Total categories
      prisma.jobCategory.count(),
      
      // Recent job seekers (last 7 days)
      prisma.user.findMany({
        where: {
          role: 'jobseeker',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          profile: {
            select: {
              firstName: true,
              lastName: true,
              skills: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      
      // Recent employer requests (last 7 days)
      prisma.employerRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      
      // Pending employer requests (no selected user)
      prisma.employerRequest.count({
        where: {
          selectedUserId: null
        }
      }),
      
      // Job seekers by category
      prisma.jobCategory.findMany({
        select: {
          name_en: true,
          name_rw: true,
          _count: {
            select: {
              profiles: true
            }
          }
        },
        orderBy: {
          profiles: {
            _count: 'desc'
          }
        },
        take: 5
      }),
      
      // Job seekers by location
      prisma.profile.groupBy({
        by: ['city'],
        where: {
          city: {
            not: null
          }
        },
        _count: {
          city: true
        },
        orderBy: {
          _count: {
            city: 'desc'
          }
        },
        take: 5
      }),
      
      // Monthly registrations (last 6 months)
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          role: 'jobseeker',
          createdAt: {
            gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
          }
        },
        _count: {
          id: true
        }
      }),
      
      // Top skills
      prisma.profile.findMany({
        select: {
          skills: true
        },
        where: {
          skills: {
            not: null
          }
        },
        take: 100
      })
    ]);

    // Process monthly registrations
    const monthlyData = monthlyRegistrations.reduce((acc, item) => {
      const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + item._count.id;
      return acc;
    }, {});

    // Process top skills
    const allSkills = topSkills
      .map(profile => profile.skills)
      .filter(Boolean)
      .join(', ')
      .split(', ')
      .filter(skill => skill.trim().length > 0)
      .map(skill => skill.trim());

    const skillCounts = allSkills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});

    const topSkillsList = Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    res.json({
      overview: {
        totalJobSeekers,
        totalEmployerRequests,
        totalCategories,
        pendingEmployerRequests
      },
      recentActivity: {
        recentJobSeekers: recentJobSeekers.map(user => ({
          id: user.id,
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          skills: user.profile.skills,
          registeredAt: user.createdAt
        })),
        recentEmployerRequests: recentEmployerRequests.map(request => ({
          id: request.id,
          name: request.name,
          email: request.email,
          message: request.message?.substring(0, 100) + '...',
          createdAt: request.createdAt
        }))
      },
      distributions: {
        categories: categoryDistribution.map(cat => ({
          name: cat.name_en,
          nameRw: cat.name_rw,
          count: cat._count.profiles
        })),
        locations: locationDistribution.map(loc => ({
          city: loc.city,
          count: loc._count.city
        }))
      },
      trends: {
        monthlyRegistrations: monthlyData,
        topSkills: topSkillsList
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch dashboard statistics.' });
  }
};

// Admin: Get detailed analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const days = parseInt(period, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      jobSeekerGrowth,
      employerRequestGrowth,
      categoryGrowth,
      topPerformingCategories,
      locationAnalytics,
      skillDemand
    ] = await Promise.all([
      // Job seeker growth over time
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          role: 'jobseeker',
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      }),
      
      // Employer request growth over time
      prisma.employerRequest.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      }),
      
      // Category growth
      prisma.jobCategory.findMany({
        include: {
          _count: {
            select: {
              profiles: true
            }
          }
        },
        orderBy: {
          profiles: {
            _count: 'desc'
          }
        }
      }),
      
      // Top performing categories
      prisma.jobCategory.findMany({
        select: {
          name_en: true,
          name_rw: true,
          _count: {
            select: {
              profiles: true
            }
          }
        },
        orderBy: {
          profiles: {
            _count: 'desc'
          }
        },
        take: 10
      }),
      
      // Location analytics
      prisma.profile.groupBy({
        by: ['city'],
        where: {
          city: {
            not: null
          }
        },
        _count: {
          city: true
        },
        orderBy: {
          _count: {
            city: 'desc'
          }
        },
        take: 10
      }),
      
      // Skill demand analysis
      prisma.profile.findMany({
        select: {
          skills: true
        },
        where: {
          skills: {
            not: null
          }
        }
      })
    ]);

    // Process skill demand
    const allSkills = skillDemand
      .map(profile => profile.skills)
      .filter(Boolean)
      .join(', ')
      .split(', ')
      .filter(skill => skill.trim().length > 0)
      .map(skill => skill.trim());

    const skillDemandAnalysis = allSkills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});

    const topSkills = Object.entries(skillDemandAnalysis)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([skill, count]) => ({ skill, count }));

    res.json({
      period,
      growth: {
        jobSeekers: jobSeekerGrowth.map(item => ({
          date: item.createdAt,
          count: item._count.id
        })),
        employerRequests: employerRequestGrowth.map(item => ({
          date: item.createdAt,
          count: item._count.id
        }))
      },
      categories: {
        all: categoryGrowth.map(cat => ({
          name: cat.name_en,
          nameRw: cat.name_rw,
          count: cat._count.profiles
        })),
        top: topPerformingCategories.map(cat => ({
          name: cat.name_en,
          nameRw: cat.name_rw,
          count: cat._count.profiles
        }))
      },
      locations: locationAnalytics.map(loc => ({
        city: loc.city,
        count: loc._count.city
      })),
      skills: topSkills
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch analytics.' });
  }
}; 