const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sessionManager, rateLimiter } = require('../utils/redis');
const { sendPasswordResetEmail, sendPasswordResetConfirmation } = require('../utils/mailer');

const prisma = new PrismaClient();

// Generate JWT tokens (access + refresh)
exports.generateTokens = async (userId, email, role) => {
  const accessToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Store refresh token in Redis
  await sessionManager.setSession(`refresh_token_${userId}`, {
    token: refreshToken,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { accessToken, refreshToken };
};

// Refresh access token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Check if refresh token exists in Redis
    const storedToken = await sessionManager.getSession(`refresh_token_${decoded.userId}`);
    
    if (!storedToken || storedToken.token !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Check if token is expired
    if (new Date() > new Date(storedToken.expiresAt)) {
      await sessionManager.deleteSession(`refresh_token_${decoded.userId}`);
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken: refreshToken // Return same refresh token
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
    res.status(500).json({ error: err.message || 'Token refresh failed.' });
  }
};

// Revoke refresh token (logout)
exports.revokeToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Remove refresh token from Redis
    await sessionManager.deleteSession(`refresh_token_${userId}`);
    
    res.json({ message: 'Successfully logged out.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Logout failed.' });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Check rate limiting
    const rateLimitKey = `password_reset_${email}`;
    const isRateLimited = await rateLimiter.checkRateLimit(rateLimitKey, 3, 3600); // 3 attempts per hour
    
    if (isRateLimited) {
      return res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenHash = await bcrypt.hash(resetToken, 10);

    // Store reset token in Redis with expiration
    await sessionManager.setSession(`password_reset_${resetToken}`, {
      userId: user.id,
      email: user.email,
      tokenHash: resetTokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, user.profile?.firstName || 'User', resetUrl);

    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Password reset request failed.' });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Get reset token data from Redis
    const resetData = await sessionManager.getSession(`password_reset_${token}`);
    
    if (!resetData) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    // Check if token is expired
    if (new Date() > new Date(resetData.expiresAt)) {
      await sessionManager.deleteSession(`password_reset_${token}`);
      return res.status(400).json({ error: 'Reset token has expired.' });
    }

    // Verify token hash
    const isValidToken = await bcrypt.compare(token, resetData.tokenHash);
    if (!isValidToken) {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    // Update user password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: resetData.userId },
      data: { password: hashedPassword }
    });

    // Remove reset token from Redis
    await sessionManager.deleteSession(`password_reset_${token}`);

    // Revoke all refresh tokens for this user
    await sessionManager.deleteSession(`refresh_token_${resetData.userId}`);

    // Send confirmation email
    await sendPasswordResetConfirmation(resetData.email);

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Password reset failed.' });
  }
};

// Change password (authenticated user)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Revoke all refresh tokens for this user
    await sessionManager.deleteSession(`refresh_token_${userId}`);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Password change failed.' });
  }
};

// Get user sessions (admin only)
exports.getUserSessions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { userId } = req.params;

    // Get user's active sessions from Redis
    const sessions = await sessionManager.getSession(`user_sessions_${userId}`) || [];

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get user sessions.' });
  }
};

// Revoke user session (admin only)
exports.revokeUserSession = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { userId, sessionId } = req.params;

    // Remove specific session
    await sessionManager.deleteSession(`user_session_${userId}_${sessionId}`);

    res.json({ message: 'Session revoked successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to revoke session.' });
  }
};

// Get security logs (admin only)
exports.getSecurityLogs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Get recent login attempts and security events
    const recentLogins = await prisma.user.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        updatedAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    });

    const securityLogs = recentLogins.map(user => ({
      type: 'login',
      userId: user.id,
      email: user.email,
      role: user.role,
      description: `User login: ${user.profile?.firstName || 'Unknown'} ${user.profile?.lastName || 'User'}`,
      timestamp: user.updatedAt
    }));

    res.json({
      logs: securityLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: securityLogs.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get security logs.' });
  }
}; 