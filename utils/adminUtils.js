const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get admin email from database
 * @returns {Promise<string>} Admin email address
 */
async function getAdminEmail() {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { email: true }
    });

    return admin?.email || process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  } catch (error) {
    console.error('Error getting admin email:', error);
    return process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  }
}

/**
 * Get admin user details
 * @returns {Promise<Object|null>} Admin user object
 */
async function getAdminUser() {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { 
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return admin;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

module.exports = {
  getAdminEmail,
  getAdminUser
}; 