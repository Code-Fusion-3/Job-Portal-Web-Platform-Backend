const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Public: Get anonymized job seekers with filtering
exports.getPublicJobSeekers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const { categoryId, skills, experience, location } = req.query;
    
    // Build where clause
    const whereClause = {
      role: 'jobseeker',
      profile: {
        is: {
          approvalStatus: 'approved',
          isActive: true,
        },
      },
    };

    if (categoryId) {
      whereClause.profile.is.jobCategoryId = parseInt(categoryId, 10);
    }

    if (skills) {
      whereClause.profile.is.skills = {
        contains: skills,
        mode: 'insensitive'
      };
    }

    if (experience) {
      whereClause.profile.is.experience = {
        contains: experience,
        mode: 'insensitive'
      };
    }

    if (location) {
      whereClause.profile.is.location = {
        contains: location,
        mode: 'insensitive'
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              gender: true,
              skills: true,
              experience: true,
              experienceLevel: true,
              location: true,
              city: true,
              country: true,
              jobCategory: {
                select: {
                  name_en: true,
                  name_rw: true
                }
              }
            }
          },
          createdAt: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({
        where: whereClause
      })
    ]);

    // Anonymize the data
    const anonymizedUsers = users.map((user, index) => ({
      id: `JS${user.id.toString().padStart(4, '0')}`, // Anonymized ID
      firstName: user.profile.firstName.charAt(0) + '*'.repeat(user.profile.firstName.length - 1),
      lastName: user.profile.lastName.charAt(0) + '*'.repeat(user.profile.lastName.length - 1),
      gender: user.profile.gender,
      skills: user.profile.skills,
      experience: user.profile.experience,
      experienceLevel: user.profile.experienceLevel,
      location: user.profile.location,
      city: user.profile.city,
      country: user.profile.country,
      jobCategory: user.profile.jobCategory,
      memberSince: user.createdAt
    }));

    res.json({
      jobSeekers: anonymizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job seekers.' });
  }
};

// Public: Get job seeker statistics
exports.getPublicStatistics = async (req, res) => {
  try {
    const [
      totalJobSeekers,
      totalCategories,
      categoryStats,
      locationStats,
      recentRegistrations
    ] = await Promise.all([
      // Total job seekers
      prisma.user.count({
        where: { role: 'jobseeker' }
      }),
      
      // Total categories
      prisma.jobCategory.count(),
      
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
      
      // Top locations
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
      
      // Recent registrations (last 30 days)
      prisma.user.count({
        where: {
          role: 'jobseeker',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      totalJobSeekers,
      totalCategories,
      topCategories: categoryStats,
      topLocations: locationStats.map(loc => ({
        city: loc.city,
        count: loc._count.city
      })),
      recentRegistrations
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch statistics.' });
  }
};

// Public: Get available filters
exports.getAvailableFilters = async (req, res) => {
  try {
    const [categories, locations, skills] = await Promise.all([
      // Job categories
      prisma.jobCategory.findMany({
        select: {
          id: true,
          name_en: true,
          name_rw: true
        },
        orderBy: { name_en: 'asc' }
      }),
      
      // Available cities
      prisma.profile.findMany({
        select: {
          city: true
        },
        where: {
          city: {
            not: null
          }
        },
        distinct: ['city'],
        orderBy: { city: 'asc' }
      }),
      
      // Common skills (sample from profiles)
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

    // Extract unique skills from profiles
    const allSkills = skills
      .map(profile => profile.skills)
      .filter(Boolean)
      .join(', ')
      .split(', ')
      .filter(skill => skill.trim().length > 0)
      .map(skill => skill.trim());

    const uniqueSkills = [...new Set(allSkills)].slice(0, 20); // Top 20 skills

    res.json({
      categories,
      locations: locations.map(loc => loc.city).filter(Boolean),
      skills: uniqueSkills
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch filters.' });
  }
}; 

// Public: Get a single anonymized job seeker by ID
exports.getPublicJobSeekerById = async (req, res) => {
  try {
    const idParam = req.params.id;
    // Remove 'JS' prefix and parse the numeric ID
    const userId = parseInt(idParam.replace(/^JS/, ''), 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid job seeker ID.' });
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, role: 'jobseeker' },
      select: {
        id: true,
        profile: {
          select: {
            // All Profile fields except contact information and photo (privacy)
            id: true,
            userId: true,
            skills: true,
            // photo: true, // Excluded for privacy in public endpoints
            gender: true,
            experience: true,
            jobCategoryId: true,
            createdAt: true,
            updatedAt: true,
            dateOfBirth: true,
            description: true,
            firstName: true,
            idNumber: true,
            lastName: true,
            references: true,
            city: true,
            country: true,
            location: true,
            maritalStatus: true,
            monthlyRate: true,
            availability: true,
            certifications: true,
            educationLevel: true,
            languages: true,
            experienceLevel: true,
            approvalStatus: true,
            isActive: true,
            jobCategory: {
              select: {
                name_en: true,
                name_rw: true
              }
            }
          }
        },
        createdAt: true
      }
    });
    if (!user || !user.profile || user.profile.approvalStatus !== 'approved' || !user.profile.isActive) {
      return res.status(404).json({ error: 'Job seeker not found.' });
    }
    // Anonymize the name, return all other profile fields except contact info
    const profile = user.profile;
    const anonymizedUser = {
      id: `JS${user.id.toString().padStart(4, '0')}`,
      firstName: profile.firstName.charAt(0) + '*'.repeat(profile.firstName.length - 1),
      lastName: profile.lastName.charAt(0) + '*'.repeat(profile.lastName.length - 1),
      // All other fields except contactNumber and photo (privacy)
      idNumber: profile.idNumber,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      // photo: profile.photo, // Excluded for privacy in public endpoints
      description: profile.description,
      skills: profile.skills,
      experience: profile.experience,
      experienceLevel: profile.experienceLevel,
      jobCategoryId: profile.jobCategoryId,
      jobCategory: profile.jobCategory,
      city: profile.city,
      country: profile.country,
      location: profile.location,
      maritalStatus: profile.maritalStatus,
      monthlyRate: profile.monthlyRate,
      availability: profile.availability,
      certifications: profile.certifications,
      educationLevel: profile.educationLevel,
      languages: profile.languages,
      references: profile.references,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      memberSince: user.createdAt
    };
    res.json(anonymizedUser);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job seeker.' });
  }
};