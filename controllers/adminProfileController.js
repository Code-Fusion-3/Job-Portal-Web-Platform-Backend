const { getPrismaClient } = require('../utils/database');

// Helper function to validate and normalize social media URLs
const validateSocialMediaUrl = (url, platform) => {
  if (!url || url.trim() === '') return null;
  
  const trimmedUrl = url.trim();
  
  // If it's already a full URL, validate it
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // If it's just a username, construct the proper URL
  switch (platform) {
    case 'github':
      return `https://github.com/${trimmedUrl.replace(/^github\.com\//, '')}`;
    case 'facebook':
      return `https://facebook.com/${trimmedUrl.replace(/^facebook\.com\//, '')}`;
    case 'linkedin':
      return `https://linkedin.com/in/${trimmedUrl.replace(/^linkedin\.com\/in\//, '')}`;
    case 'twitter':
      return `https://twitter.com/${trimmedUrl.replace(/^twitter\.com\//, '')}`;
    case 'instagram':
      return `https://instagram.com/${trimmedUrl.replace(/^instagram\.com\//, '')}`;
    default:
      return trimmedUrl;
  }
};

// Helper function to sanitize personal data
const sanitizePersonalData = (personalData) => {
  if (!personalData) return personalData;
  
  return {
    ...personalData,
    github: validateSocialMediaUrl(personalData.github, 'github'),
    facebook: validateSocialMediaUrl(personalData.facebook, 'facebook'),
    linkedin: validateSocialMediaUrl(personalData.linkedin, 'linkedin'),
    twitter: validateSocialMediaUrl(personalData.twitter, 'twitter'),
    instagram: validateSocialMediaUrl(personalData.instagram, 'instagram')
  };
};

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
          personal: sanitizePersonalData({
            name: 'Admin User',
            title: 'Full Stack Developer & System Administrator',
            location: 'Kigali, Rwanda',
            email: 'info@braziconnect.rw',
            phone: '+250 123 456 789',
            aboutMe: 'Experienced full-stack developer with expertise in modern web technologies and system administration.',
            github: 'github.com/adminuser',
            facebook: 'facebook.com/adminuser',
            linkedin: 'linkedin.com/in/adminuser',
            twitter: 'twitter.com/adminuser',
            instagram: 'instagram.com/adminuser'
          }),
          skills: {
            frontend: ['React.js', 'Vue.js', 'Angular', 'TypeScript', 'Tailwind CSS', 'Next.js'],
            backend: ['Node.js', 'Express.js', 'Python', 'Django', 'PHP', 'Laravel'],
            database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Prisma ORM'],
            devops: ['Docker', 'AWS', 'CI/CD', 'Git', 'Linux', 'Nginx'],
            design: ['UI/UX Design', 'Figma', 'Adobe Creative Suite', 'Responsive Design'],
            management: ['Project Management', 'Team Leadership', 'Agile/Scrum', 'Strategic Planning']
          },
          experience: [],
          education: [],
          certifications: [],
          projects: []
        }
      });
    }

    // Return data in the format expected by Settings page
    const userProfile = {
      id: adminId,
      firstName: adminProfile.personal.name ? adminProfile.personal.name.split(' ')[0] : '',
      lastName: adminProfile.personal.name ? adminProfile.personal.name.split(' ').slice(1).join(' ') : '',
      email: adminProfile.personal.email || '',
      phone: adminProfile.personal.phone || '',
      location: adminProfile.personal.location || '',
      bio: adminProfile.personal.aboutMe || ''
    };

    res.json(userProfile);
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

    // Check if this is a simple profile update (from Settings page) or detailed profile update
    if (profileData.firstName || profileData.lastName || profileData.email || profileData.phone || profileData.location || profileData.bio) {
      // This is a simple profile update from Settings page
      // Update the User model with basic profile information
      const updatedUser = await prisma.user.update({
        where: { id: adminId },
        data: {
          name: profileData.firstName && profileData.lastName ? `${profileData.firstName} ${profileData.lastName}` : undefined,
          email: profileData.email || undefined,
          updatedAt: new Date()
        }
      });

      // Get or create AdminProfile and update the personal section
      let adminProfile = await prisma.adminProfile.findUnique({
        where: { adminId: adminId }
      });

      if (!adminProfile) {
        // Create new AdminProfile if it doesn't exist
        adminProfile = await prisma.adminProfile.create({
          data: {
            adminId: adminId,
            personal: {
              name: profileData.firstName && profileData.lastName ? `${profileData.firstName} ${profileData.lastName}` : 'Admin User',
              title: 'System Administrator',
              location: profileData.location || 'Kigali, Rwanda',
              email: profileData.email || 'info@braziconnect.rw',
              phone: profileData.phone || '',
              aboutMe: profileData.bio || 'System Administrator for Job Portal Platform'
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
            projects: []
          }
        });
      } else {
        // Update existing AdminProfile personal section
        adminProfile = await prisma.adminProfile.update({
          where: { adminId: adminId },
          data: {
            personal: {
              ...adminProfile.personal,
              name: profileData.firstName && profileData.lastName ? `${profileData.firstName} ${profileData.lastName}` : adminProfile.personal.name,
              location: profileData.location || adminProfile.personal.location,
              email: profileData.email || adminProfile.personal.email,
              phone: profileData.phone || adminProfile.personal.phone,
              aboutMe: profileData.bio || adminProfile.personal.aboutMe
            },
            updatedAt: new Date()
          }
        });
      }

      // Return the updated user data in the format expected by Settings page
      const userProfile = {
        id: updatedUser.id,
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: updatedUser.email,
        phone: profileData.phone || '',
        location: profileData.location || '',
        bio: profileData.bio || ''
      };

      res.json({ 
        message: 'Profile updated successfully', 
        profile: userProfile 
      });
    } else {
      // This is a detailed profile update from AdminProfileManagement page
      // Sanitize and validate personal data, especially social media URLs
      const sanitizedProfileData = {
        ...profileData,
        personal: sanitizePersonalData(profileData.personal)
      };

      // Update or create admin profile
      const adminProfile = await prisma.adminProfile.upsert({
        where: { adminId: adminId },
        update: {
          personal: sanitizedProfileData.personal,
          skills: sanitizedProfileData.skills,
          experience: sanitizedProfileData.experience,
          education: sanitizedProfileData.education,
          certifications: sanitizedProfileData.certifications,
          projects: sanitizedProfileData.projects,
          updatedAt: new Date()
        },
        create: {
          adminId: adminId,
          personal: sanitizedProfileData.personal,
          skills: sanitizedProfileData.skills,
          experience: sanitizedProfileData.experience,
          education: sanitizedProfileData.education,
          certifications: sanitizedProfileData.certifications,
          projects: sanitizedProfileData.projects
        }
      });

      res.json({ 
        message: 'Profile updated successfully', 
        profile: adminProfile 
      });
    }
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
          personal: sanitizePersonalData({
            name: adminUser.name || 'Admin User',
            title: 'Full Stack Developer & System Administrator',
            location: 'Kigali, Rwanda',
            email: adminUser.email || 'info@braziconnect.rw',
            phone: '+250 123 456 789',
            aboutMe: 'Experienced full-stack developer with expertise in modern web technologies and system administration.',
            github: 'github.com/adminuser',
            facebook: 'facebook.com/adminuser',
            linkedin: 'linkedin.com/in/adminuser',
            twitter: 'twitter.com/adminuser',
            instagram: 'instagram.com/adminuser'
          }),
          skills: {
            frontend: ['React.js', 'Vue.js', 'Angular', 'TypeScript', 'Tailwind CSS', 'Next.js'],
            backend: ['Node.js', 'Express.js', 'Python', 'Django', 'PHP', 'Laravel'],
            database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Prisma ORM'],
            devops: ['Docker', 'AWS', 'CI/CD', 'Git', 'Linux', 'Nginx'],
            design: ['UI/UX Design', 'Figma', 'Adobe Creative Suite', 'Responsive Design'],
            management: ['Project Management', 'Team Leadership', 'Agile/Scrum', 'Strategic Planning']
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
          ]
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
      projects: adminProfile.projects
    });
  } catch (error) {
    console.error('❌ Error getting public admin profile:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get public admin profile', details: error.message });
  }
};
