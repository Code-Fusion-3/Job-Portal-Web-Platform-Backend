// Alternative implementation for getPublicJobSeekers that's more compatible with shared hosting MySQL
// This version uses raw SQL queries to avoid Prisma relation complexities that can cause issues

const { getPrismaClient } = require('../utils/database');

exports.getPublicJobSeekersAlternative = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100.' 
      });
    }
    
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const { categoryId, skills, experience, location } = req.query;
    
    // Build SQL WHERE conditions
    let whereConditions = [
      "p.approvalStatus = 'approved'",
      "p.isActive = 1",
      "u.role = 'jobseeker'"
    ];
    
    let queryParams = [];
    
    if (categoryId) {
      whereConditions.push("p.jobCategoryId = ?");
      queryParams.push(parseInt(categoryId, 10));
    }
    
    if (skills) {
      whereConditions.push("p.skills LIKE ?");
      queryParams.push(`%${skills}%`);
    }
    
    if (experience) {
      whereConditions.push("p.experience LIKE ?");
      queryParams.push(`%${experience}%`);
    }
    
    if (location) {
      whereConditions.push("(p.location LIKE ? OR p.city LIKE ?)");
      queryParams.push(`%${location}%`, `%${location}%`);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get count using raw SQL
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Profile p
      INNER JOIN User u ON p.userId = u.id
      LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
      WHERE ${whereClause}
    `;
    
    // Get data using raw SQL
    const dataQuery = `
      SELECT 
        p.firstName,
        p.lastName,
        p.gender,
        p.skills,
        p.experience,
        p.experienceLevel,
        p.location,
        p.city,
        p.country,
        u.id as userId,
        u.createdAt,
        jc.name_en as category_name_en,
        jc.name_rw as category_name_rw
      FROM Profile p
      INNER JOIN User u ON p.userId = u.id
      LEFT JOIN JobCategory jc ON p.jobCategoryId = jc.id
      WHERE ${whereClause}
      ORDER BY u.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    
    try {
      // Execute queries
      const [countResult] = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
      const profiles = await prisma.$queryRawUnsafe(dataQuery, ...queryParams, limit, offset);
      
      const total = Number(countResult.total);
      
      // Anonymize the data
      const anonymizedUsers = profiles.map((p) => ({
        id: `JS${p.userId.toString().padStart(4, '0')}`,
        firstName: p.firstName ? p.firstName.charAt(0) + '*'.repeat(Math.max(0, p.firstName.length - 1)) : '*',
        lastName: p.lastName ? p.lastName.charAt(0) + '*'.repeat(Math.max(0, p.lastName.length - 1)) : '*',
        gender: p.gender,
        skills: p.skills,
        experience: p.experience,
        experienceLevel: p.experienceLevel,
        location: p.location,
        city: p.city,
        country: p.country,
        jobCategory: p.category_name_en ? {
          name_en: p.category_name_en,
          name_rw: p.category_name_rw
        } : null,
        memberSince: p.createdAt
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
      
    } catch (sqlError) {
      console.error('Raw SQL query failed, falling back to Prisma:', sqlError);
      
      // Fallback to simplified Prisma query
      const profiles = await prisma.profile.findMany({
        where: {
          approvalStatus: 'approved',
          isActive: true
        },
        include: {
          user: {
            select: { id: true, createdAt: true, role: true }
          },
          jobCategory: {
            select: { name_en: true, name_rw: true }
          }
        },
        skip: offset,
        take: limit,
        orderBy: { user: { createdAt: 'desc' } }
      });
      
      // Filter jobseekers in application code
      const jobseekerProfiles = profiles.filter(p => p.user.role === 'jobseeker');
      
      // Simple count estimation
      const total = Math.max(jobseekerProfiles.length, offset + jobseekerProfiles.length);
      
      const anonymizedUsers = jobseekerProfiles.map((p) => ({
        id: `JS${p.user.id.toString().padStart(4, '0')}`,
        firstName: p.firstName ? p.firstName.charAt(0) + '*'.repeat(Math.max(0, p.firstName.length - 1)) : '*',
        lastName: p.lastName ? p.lastName.charAt(0) + '*'.repeat(Math.max(0, p.lastName.length - 1)) : '*',
        gender: p.gender,
        skills: p.skills,
        experience: p.experience,
        experienceLevel: p.experienceLevel,
        location: p.location,
        city: p.city,
        country: p.country,
        jobCategory: p.jobCategory,
        memberSince: p.user.createdAt
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
    }
    
  } catch (err) {
    console.error('Error in getPublicJobSeekersAlternative:', {
      message: err.message,
      code: err.code,
      query: req.query,
      stack: process.env.NODE_ENV === 'development' ? err.stack : 'Hidden in production'
    });
    
    res.status(500).json({ 
      error: err.message || 'Failed to fetch job seekers.',
      ...(process.env.NODE_ENV === 'development' && { details: err.stack })
    });
  }
};