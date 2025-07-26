const { PrismaClient } = require('../generated/prisma');
const { messageCache } = require('../utils/redis');

const prisma = new PrismaClient();

// Advanced job seeker search with multiple filters
exports.searchJobSeekers = async (req, res) => {
  try {
    const {
      query,
      categoryId,
      skills,
      experience,
      location,
      city,
      country,
      gender,
      ageRange,
      dateRange,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build search conditions
    const whereConditions = {
      role: 'jobseeker',
      profile: {
        isNot: null
      }
    };

    // Text search across multiple fields
    if (query) {
      whereConditions.OR = [
        {
          profile: {
            firstName: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          profile: {
            lastName: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          profile: {
            skills: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          profile: {
            description: {
              contains: query,
              mode: 'insensitive'
            }
          }
        },
        {
          profile: {
            experience: {
              contains: query,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Category filter
    if (categoryId) {
      whereConditions.profile.jobCategoryId = parseInt(categoryId, 10);
    }

    // Skills filter
    if (skills) {
      const skillArray = skills.split(',').map(skill => skill.trim());
      whereConditions.profile.skills = {
        contains: skillArray.join('|'),
        mode: 'insensitive'
      };
    }

    // Experience filter
    if (experience) {
      whereConditions.profile.experience = {
        contains: experience,
        mode: 'insensitive'
      };
    }

    // Location filters
    if (location) {
      whereConditions.profile.location = {
        contains: location,
        mode: 'insensitive'
      };
    }

    if (city) {
      whereConditions.profile.city = {
        contains: city,
        mode: 'insensitive'
      };
    }

    if (country) {
      whereConditions.profile.country = {
        contains: country,
        mode: 'insensitive'
      };
    }

    // Gender filter
    if (gender) {
      whereConditions.profile.gender = gender;
    }

    // Age range filter
    if (ageRange) {
      const [minAge, maxAge] = ageRange.split('-').map(age => parseInt(age, 10));
      const today = new Date();
      const minDate = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());
      const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
      
      whereConditions.profile.dateOfBirth = {
        gte: minDate,
        lte: maxDate
      };
    }

    // Date range filter (registration date)
    if (dateRange) {
      const [startDate, endDate] = dateRange.split('|');
      whereConditions.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Sort options
    const sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.profile = {
        firstName: sortOrder
      };
    } else if (sortBy === 'skills') {
      sortOptions.profile = {
        skills: sortOrder
      };
    } else {
      sortOptions[sortBy] = sortOrder;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereConditions,
        include: {
          profile: {
            include: {
              jobCategory: {
                select: {
                  name_en: true,
                  name_rw: true
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: sortOptions
      }),
      prisma.user.count({
        where: whereConditions
      })
    ]);

    // Anonymize the data for public access
    const anonymizedUsers = users.map(user => ({
      id: `JS${user.id.toString().padStart(4, '0')}`,
      firstName: user.profile.firstName.charAt(0) + '*'.repeat(user.profile.firstName.length - 1),
      lastName: user.profile.lastName.charAt(0) + '*'.repeat(user.profile.lastName.length - 1),
      skills: user.profile.skills,
      experience: user.profile.experience,
      location: user.profile.location,
      city: user.profile.city,
      country: user.profile.country,
      gender: user.profile.gender,
      jobCategory: user.profile.jobCategory,
      memberSince: user.createdAt
    }));

    res.json({
      jobSeekers: anonymizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        query,
        categoryId,
        skills,
        experience,
        location,
        city,
        country,
        gender,
        ageRange,
        dateRange
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
};

// Search within conversations
exports.searchConversations = async (req, res) => {
  try {
    const { query, requestId, fromAdmin, dateRange, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    // Build search conditions
    const whereConditions = {};

    if (query) {
      whereConditions.content = {
        contains: query,
        mode: 'insensitive'
      };
    }

    if (requestId) {
      whereConditions.employerRequestId = parseInt(requestId, 10);
    }

    if (fromAdmin !== undefined) {
      whereConditions.fromAdmin = fromAdmin === 'true';
    }

    if (dateRange) {
      const [startDate, endDate] = dateRange.split('|');
      whereConditions.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: whereConditions,
        include: {
          employerRequest: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.message.count({
        where: whereConditions
      })
    ]);

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        query,
        requestId,
        fromAdmin,
        dateRange
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Conversation search failed.' });
  }
};

// Get search suggestions
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { query, type = 'jobseekers' } = req.query;

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    let suggestions = [];

    if (type === 'jobseekers') {
      // Get skill suggestions
      const skillSuggestions = await prisma.profile.findMany({
        where: {
          skills: {
            contains: query,
            mode: 'insensitive'
          }
        },
        select: {
          skills: true
        },
        take: 5
      });

      // Get location suggestions
      const locationSuggestions = await prisma.profile.findMany({
        where: {
          OR: [
            { city: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          city: true,
          location: true
        },
        take: 5
      });

      suggestions = [
        ...skillSuggestions.map(s => s.skills?.split(',')[0]?.trim()).filter(Boolean),
        ...locationSuggestions.map(l => l.city || l.location).filter(Boolean)
      ];
    } else if (type === 'conversations') {
      // Get conversation search suggestions
      const messageSuggestions = await prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        select: {
          content: true
        },
        take: 5
      });

      suggestions = messageSuggestions.map(m => 
        m.content.substring(0, 50) + (m.content.length > 50 ? '...' : '')
      );
    }

    // Remove duplicates and limit results
    suggestions = [...new Set(suggestions)].slice(0, 10);

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get suggestions.' });
  }
};

// Get search filters and options
exports.getSearchFilters = async (req, res) => {
  try {
    const [categories, locations, skills, experienceLevels] = await Promise.all([
      // Job categories
      prisma.jobCategory.findMany({
        select: {
          id: true,
          name_en: true,
          name_rw: true,
          _count: {
            select: {
              profiles: true
            }
          }
        },
        orderBy: { name_en: 'asc' }
      }),

      // Available locations
      prisma.profile.findMany({
        select: {
          city: true,
          country: true
        },
        where: {
          OR: [
            { city: { not: null } },
            { country: { not: null } }
          ]
        },
        distinct: ['city', 'country'],
        take: 50
      }),

      // Common skills
      prisma.profile.findMany({
        select: {
          skills: true
        },
        where: {
          skills: { not: null }
        },
        take: 100
      }),

      // Experience levels
      prisma.profile.findMany({
        select: {
          experience: true
        },
        where: {
          experience: { not: null }
        },
        take: 50
      })
    ]);

    // Process skills
    const allSkills = skills
      .map(profile => profile.skills)
      .filter(Boolean)
      .join(', ')
      .split(', ')
      .filter(skill => skill.trim().length > 0)
      .map(skill => skill.trim());

    const uniqueSkills = [...new Set(allSkills)].slice(0, 20);

    // Process locations
    const uniqueLocations = [...new Set(
      locations.map(loc => loc.city || loc.country).filter(Boolean)
    )].slice(0, 20);

    // Process experience levels
    const uniqueExperience = [...new Set(
      experienceLevels.map(exp => exp.experience).filter(Boolean)
    )].slice(0, 10);

    res.json({
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name_en,
        nameRw: cat.name_rw,
        count: cat._count.profiles
      })),
      locations: uniqueLocations,
      skills: uniqueSkills,
      experienceLevels: uniqueExperience,
      genderOptions: ['Male', 'Female', 'Other'],
      sortOptions: [
        { value: 'createdAt', label: 'Newest First' },
        { value: '-createdAt', label: 'Oldest First' },
        { value: 'name', label: 'Name A-Z' },
        { value: '-name', label: 'Name Z-A' },
        { value: 'skills', label: 'Skills A-Z' }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get search filters.' });
  }
}; 