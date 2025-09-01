const { getPrismaClient } = require('../utils/database');

// Get admin profile information
exports.getAdminProfile = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const adminId = req.user.id;

    // Get admin profile from database
    let adminProfile = await prisma.adminProfile.findUnique({
      where: { adminId: adminId }
    });

    // If no profile exists, create default one
    if (!adminProfile) {
      adminProfile = await prisma.adminProfile.create({
        data: {
          adminId: adminId,
          personal: {
            name: 'Admin User',
            title: 'Full Stack Developer & System Administrator',
            location: 'Kigali, Rwanda',
            email: 'admin@jobportal.com',
            phone: '+250 123 456 789',
            aboutMe: 'Experienced full-stack developer with expertise in modern web technologies and system administration.'
          },
          skills: {
            frontend: ['React.js', 'Vue.js', 'Angular', 'TypeScript', 'Tailwind CSS', 'Next.js'],
            backend: ['Node.js', 'Express.js', 'Python', 'Django', 'PHP', 'Laravel'],
            database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Prisma ORM'],
            devops: ['Docker', 'AWS', 'CI/CD', 'Git', 'Linux', 'Nginx']
          },
          experience: [],
          education: [],
          certifications: [],
          projects: [],
          systemStats: {
            jobSeekers: 500,
            uptime: 98,
            companies: 50,
            experience: 5
          }
        }
      });
    }

    res.json(adminProfile);
  } catch (error) {
    console.error('Error getting admin profile:', error);
    res.status(500).json({ error: 'Failed to get admin profile' });
  }
};

// Update admin profile information
exports.updateAdminProfile = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const adminId = req.user.id;
    const profileData = req.body;

    // Update or create admin profile
    const adminProfile = await prisma.adminProfile.upsert({
      where: { adminId: adminId },
      update: {
        personal: profileData.personal,
        skills: profileData.skills,
        experience: profileData.experience,
        education: profileData.education,
        certifications: profileData.certifications,
        projects: profileData.projects,
        systemStats: profileData.systemStats,
        updatedAt: new Date()
      },
      create: {
        adminId: adminId,
        personal: profileData.personal,
        skills: profileData.skills,
        experience: profileData.experience,
        education: profileData.education,
        certifications: profileData.certifications,
        projects: profileData.projects,
        systemStats: profileData.systemStats
      }
    });

    res.json({ 
      message: 'Profile updated successfully', 
      profile: adminProfile 
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: 'Failed to update admin profile' });
  }
};

// Get public admin profile (for AdminInfo page)
exports.getPublicAdminProfile = async (req, res) => {
  try {
    console.log('🔍 getPublicAdminProfile: Starting...');
    const prisma = await getPrismaClient();
    console.log('🔍 getPublicAdminProfile: Prisma client initialized');
    
    // Get the first admin profile (assuming there's one main admin)
    let adminProfile = await prisma.adminProfile.findFirst({
      where: {
        admin: {
          role: 'admin'
        }
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log('🔍 getPublicAdminProfile: Admin profile search result:', adminProfile);

    // If no admin profile exists, create a default one for the first admin user
    if (!adminProfile) {
      console.log('🔍 getPublicAdminProfile: No admin profile found, creating default...');
      
      // Find the first admin user
      const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' }
      });

      console.log('🔍 getPublicAdminProfile: Admin user search result:', adminUser);

      if (!adminUser) {
        console.log('❌ getPublicAdminProfile: No admin users found');
        return res.status(404).json({ error: 'No admin users found' });
      }

      console.log('🔍 getPublicAdminProfile: Creating default profile for admin user:', adminUser.id);

      // Create default admin profile
      adminProfile = await prisma.adminProfile.create({
        data: {
          adminId: adminUser.id,
          personal: {
            name: adminUser.name || 'Admin User',
            title: 'Full Stack Developer & System Administrator',
            location: 'Kigali, Rwanda',
            email: adminUser.email || 'admin@jobportal.com',
            phone: '+250 123 456 789',
            aboutMe: 'Experienced full-stack developer with expertise in modern web technologies and system administration.'
          },
          skills: {
            frontend: ['React.js', 'Vue.js', 'Angular', 'TypeScript', 'Tailwind CSS', 'Next.js'],
            backend: ['Node.js', 'Express.js', 'Python', 'Django', 'PHP', 'Laravel'],
            database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Prisma ORM'],
            devops: ['Docker', 'AWS', 'CI/CD', 'Git', 'Linux', 'Nginx']
          },
          experience: [
            {
              company: 'Job Portal Platform',
              position: 'Lead Developer & System Admin',
              period: '2023 - Present',
              description: 'Leading development of comprehensive job portal platform with modern technologies.',
              achievements: [
                'Built full-stack job portal with React and Node.js',
                'Implemented secure authentication and role-based access control',
                'Managed database design and optimization',
                'Integrated payment systems and messaging functionality'
              ]
            }
          ],
          education: [
            {
              degree: 'Master of Computer Science',
              school: 'University of Technology',
              period: '2020 - 2022',
              description: 'Specialized in software engineering and system architecture'
            },
            {
              degree: 'Bachelor of Computer Science',
              school: 'Technical University',
              period: '2016 - 2020',
              description: 'Computer science fundamentals and programming'
            }
          ],
          certifications: [
            {
              name: 'AWS Certified Solutions Architect',
              issuer: 'Amazon Web Services',
              year: '2023'
            },
            {
              name: 'Microsoft Azure Developer',
              issuer: 'Microsoft',
              year: '2022'
            }
          ],
          projects: [
            {
              name: 'Job Portal Platform',
              description: 'Comprehensive job matching platform for employers and job seekers with payment integration',
              tech: 'React, Node.js, PostgreSQL, Redis, Prisma ORM',
              status: 'live'
            },
            {
              name: 'E-Learning Management System',
              description: 'Online learning platform with course management and student tracking',
              tech: 'Vue.js, Laravel, MySQL, Docker',
              status: 'live'
            }
          ],
          systemStats: {
            jobSeekers: 500,
            uptime: 98,
            companies: 50,
            experience: 5
          }
        }
      });

      console.log('✅ getPublicAdminProfile: Default profile created successfully');
    }

    console.log('🔍 getPublicAdminProfile: Returning profile data');

    // Return public profile data
    res.json({
      personal: adminProfile.personal,
      skills: adminProfile.skills,
      experience: adminProfile.experience,
      education: adminProfile.education,
      certifications: adminProfile.certifications,
      projects: adminProfile.projects,
      systemStats: adminProfile.systemStats
    });
  } catch (error) {
    console.error('❌ Error getting public admin profile:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get public admin profile', details: error.message });
  }
};
