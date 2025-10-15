const { getPrismaClient } = require('../utils/database');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Public: Get anonymized job seekers with filtering
exports.getPublicJobSeekers = async (req, res) => {
  console.log('🎯 [DEBUG] ===== PUBLIC JOB SEEKERS API CALLED =====');
  console.log('🎯 [DEBUG] Route hit successfully at:', new Date().toISOString());
  console.log('🎯 [DEBUG] Request query parameters:', req.query);
  console.log('🎯 [DEBUG] Request headers:', req.headers);
  console.log('🎯 [DEBUG] =====================================');
  
  try {
    console.log('🔌 [DEBUG] Step 1: Initializing Prisma client...');
    const prisma = await initPrisma();
    console.log('✅ [DEBUG] Prisma client initialized successfully');
    
    // Check if "all" parameter is set to return all candidates
    const fetchAll = req.query.all === 'true' || req.query.all === '1';
    
    let page, limit, skip;
    
    if (fetchAll) {
      console.log('📊 [DEBUG] Step 2: Fetch ALL mode enabled - no pagination limits');
      page = 1;
      limit = 10000; // Very high limit to ensure we get all records
      skip = 0;
    } else {
      page = parseInt(req.query.page) || 1;
      limit = parseInt(req.query.limit) || 1000; // Default to high limit to get all records
      console.log(`📊 [DEBUG] Step 2: Pagination - page: ${page}, limit: ${limit}`);
      
      // Validate pagination parameters - increased max limit for "get all" functionality
      if (page < 1 || limit < 1 || limit > 2000) {
        console.log('❌ [DEBUG] Invalid pagination parameters');
        return res.status(400).json({ 
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 2000.' 
        });
      }
      
      skip = (page - 1) * limit;
    }
    console.log(`📝 [DEBUG] Step 3: Skip calculation - skip: ${skip}`);
    
    // Filter parameters
    const { categoryId, skills, experience, location } = req.query;
    console.log('🔍 [DEBUG] Step 4: Filters extracted:', { categoryId, skills, experience, location });
    
    // Build where clause - simplified for better MySQL compatibility on shared hosting
    const profileWhere = {
      approvalStatus: 'approved',
      isActive: true,
      user: {
        role: 'jobseeker' // Simplified relation query for better compatibility
      }
    };
    console.log('🏗️  [DEBUG] Step 5: Base where clause built:', JSON.stringify(profileWhere, null, 2));

    if (categoryId) {
      profileWhere.jobCategoryId = parseInt(categoryId, 10);
    }

    // For MySQL compatibility on shared hosting, avoid mode: 'insensitive' which can cause issues
    if (skills) {
      profileWhere.skills = {
        contains: skills
        // Removed mode: 'insensitive' for MySQL compatibility on shared hosting
      };
    }

    if (experience) {
      profileWhere.experience = {
        contains: experience
        // Removed mode: 'insensitive' for MySQL compatibility on shared hosting
      };
    }

    if (location) {
      profileWhere.location = {
        contains: location
        // Removed mode: 'insensitive' for MySQL compatibility on shared hosting
      };
    }

    console.log('🔎 [DEBUG] Step 6: Attempting to fetch profiles...');
    // First get the profiles
    const profiles = await prisma.profile.findMany({
      where: profileWhere,
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
          select: { name_en: true, name_rw: true }
        },
        user: {
          select: { id: true, createdAt: true }
        },
      },
      skip,
      take: limit,
      orderBy: { user: { createdAt: 'desc' } },
    });
    console.log(`✅ [DEBUG] Step 7: Profiles fetched successfully. Count: ${profiles.length}`);

    // Separate count query with multiple fallback strategies for shared hosting compatibility
    console.log('🔢 [DEBUG] Step 8: Starting count query...');
    let total = 0;
    try {
      console.log('🎯 [DEBUG] Attempting primary count query with where:', JSON.stringify(profileWhere, null, 2));
      total = await prisma.profile.count({ where: profileWhere });
      console.log(`✅ [DEBUG] Primary count query successful. Total: ${total}`);
    } catch (countError) {
      console.error('❌ [DEBUG] Count query failed, trying fallback methods:', countError.message);
      console.error('❌ [DEBUG] Count error details:', {
        name: countError.name,
        code: countError.code,
        meta: countError.meta,
        stack: countError.stack
      });
      
      try {
        console.log('🔄 [DEBUG] Fallback 1: Trying simplified count query...');
        // Fallback 1: Simpler count query without complex nested conditions
        const simpleWhere = {
          approvalStatus: 'approved',
          isActive: true
        };
        
        // Add simple filters only
        if (categoryId) simpleWhere.jobCategoryId = parseInt(categoryId, 10);
        
        console.log('🎯 [DEBUG] Fallback 1 where clause:', JSON.stringify(simpleWhere, null, 2));
        total = await prisma.profile.count({ where: simpleWhere });
        console.log(`✅ [DEBUG] Fallback 1 successful. Total: ${total}`);
      } catch (fallbackError) {
        console.error('❌ [DEBUG] Fallback 1 also failed:', fallbackError.message);
        console.error('❌ [DEBUG] Fallback 1 error details:', {
          name: fallbackError.name,
          code: fallbackError.code,
          meta: fallbackError.meta
        });
        
        console.log('🔄 [DEBUG] Fallback 2: Using manual estimation...');
        // Fallback 2: Manual estimation based on current results
        if (profiles.length === limit) {
          // If we got a full page, estimate there might be more
          total = skip + profiles.length + 10; // Conservative estimate
          console.log(`📊 [DEBUG] Full page detected, estimating: ${total}`);
        } else {
          // If less than limit, this is likely the last page
          total = skip + profiles.length;
          console.log(`📊 [DEBUG] Partial page detected, calculating: ${total}`);
        }
        console.log(`✅ [DEBUG] Manual estimation complete: ${total}`);
      }
    }
    
    console.log(`🎯 [DEBUG] Step 9: Final total count determined: ${total}`);

    console.log('🔐 [DEBUG] Step 10: Starting data anonymization...');
    // Anonymize the data
    const anonymizedUsers = profiles.map((p) => {
      // Safe anonymization with null/undefined/empty string checks
      const safeFirstName = p.firstName && p.firstName.length > 0 
        ? p.firstName.charAt(0) + '*'.repeat(Math.max(0, p.firstName.length - 1))
        : 'N*';
        
      const safeLastName = p.lastName && p.lastName.length > 0
        ? p.lastName.charAt(0) + '*'.repeat(Math.max(0, p.lastName.length - 1))
        : 'N*';
        
      console.log(`🔐 [DEBUG] Anonymizing user ${p.user.id}: firstName="${p.firstName}" -> "${safeFirstName}", lastName="${p.lastName}" -> "${safeLastName}"`);
        
      return {
        id: `JS${p.user.id.toString().padStart(4, '0')}`, // Anonymized ID
        firstName: safeFirstName,
        lastName: safeLastName,
        gender: p.gender,
        skills: p.skills,
        experience: p.experience,
        experienceLevel: p.experienceLevel,
        location: p.location,
        city: p.city,
        country: p.country,
        jobCategory: p.jobCategory,
        memberSince: p.user.createdAt
      };
    });
    console.log(`✅ [DEBUG] Data anonymized successfully. ${anonymizedUsers.length} users processed.`);

    console.log('📊 [DEBUG] Step 11: Preparing final response...');
    const response = {
      jobSeekers: anonymizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
    
    console.log('📤 [DEBUG] Step 12: Sending response:', {
      jobSeekersCount: response.jobSeekers.length,
      pagination: response.pagination
    });
    
    res.json(response);
  } catch (err) {
    console.error('💥 [DEBUG] CRITICAL ERROR in getPublicJobSeekers:', {
      message: err.message,
      code: err.code,
      name: err.name,
      query: req.query,
      stack: err.stack
    });
    
    // Check if total is -1 and provide specific debugging info
    if (err.message && err.message.includes('Invalid count value: -1')) {
      console.error('🚨 [DEBUG] DETECTED -1 COUNT ERROR - This should not happen with our fallbacks!');
      console.error('🔍 [DEBUG] This error suggests the issue is elsewhere in the code');
    }
    
    res.status(500).json({ 
      error: err.message || 'Failed to fetch job seekers.',
      debug: process.env.NODE_ENV === 'development' ? err.stack : 'Check server logs for details',
      timestamp: new Date().toISOString()
    });
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