const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Public: Get all job categories
exports.getAllJobCategories = async (req, res) => {
  try {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { name_en: 'asc' }
    });

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job categories.' });
  }
};

// Admin: Create job category
exports.createJobCategory = async (req, res) => {
  try {
    const { name_en, name_rw } = req.body;

    if (!name_en || !name_rw) {
      return res.status(400).json({ error: 'Both English and Kinyarwanda names are required.' });
    }

    // Check if category already exists
    const existingCategory = await prisma.jobCategory.findFirst({
      where: {
        OR: [
          { name_en },
          { name_rw }
        ]
      }
    });

    if (existingCategory) {
      return res.status(409).json({ error: 'Job category already exists.' });
    }

    const category = await prisma.jobCategory.create({
      data: {
        name_en,
        name_rw
      }
    });

    res.status(201).json({
      message: 'Job category created successfully',
      category
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create job category.' });
  }
};

// Admin: Get all job categories with pagination
exports.adminGetAllJobCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      prisma.jobCategory.findMany({
        include: {
          _count: {
            select: {
              profiles: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { name_en: 'asc' }
      }),
      prisma.jobCategory.count()
    ]);

    res.json({
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job categories.' });
  }
};

// Admin: Get specific job category
exports.getJobCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);

    const category = await prisma.jobCategory.findUnique({
      where: { id: categoryId },
      include: {
        profiles: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            skills: true,
            experience: true
          }
        },
        _count: {
          select: {
            profiles: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Job category not found.' });
    }

    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job category.' });
  }
};

// Admin: Update job category
exports.updateJobCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const { name_en, name_rw } = req.body;

    if (!name_en || !name_rw) {
      return res.status(400).json({ error: 'Both English and Kinyarwanda names are required.' });
    }

    // Check if category exists
    const existingCategory = await prisma.jobCategory.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Job category not found.' });
    }

    // Check if new names conflict with other categories
    const conflictingCategory = await prisma.jobCategory.findFirst({
      where: {
        OR: [
          { name_en },
          { name_rw }
        ],
        NOT: {
          id: categoryId
        }
      }
    });

    if (conflictingCategory) {
      return res.status(409).json({ error: 'Job category name already exists.' });
    }

    const updatedCategory = await prisma.jobCategory.update({
      where: { id: categoryId },
      data: {
        name_en,
        name_rw
      }
    });

    res.json({
      message: 'Job category updated successfully',
      category: updatedCategory
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update job category.' });
  }
};

// Admin: Delete job category
exports.deleteJobCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);

    // Check if category exists
    const category = await prisma.jobCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            profiles: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Job category not found.' });
    }

    // Check if category is being used by profiles
    if (category._count.profiles > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete job category. It is being used by job seekers.',
        profilesCount: category._count.profiles
      });
    }

    await prisma.jobCategory.delete({
      where: { id: categoryId }
    });

    res.json({ message: 'Job category deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete job category.' });
  }
}; 