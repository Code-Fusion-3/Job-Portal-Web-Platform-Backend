const { PrismaClient } = require("@prisma/client");
const { sendEmployerRequestNotification, sendAdminReplyNotification } = require('../utils/mailer');

const prisma = new PrismaClient();

// Public: Submit employer request (no login required)
exports.submitEmployerRequest = async (req, res) => {
  try {
    const { name, email, phoneNumber, message, requestedCandidateId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Validate requested candidate if provided
    if (requestedCandidateId) {
      const candidate = await prisma.user.findUnique({
        where: { id: parseInt(requestedCandidateId, 10) },
        include: { profile: true }
      });
      
      if (!candidate || candidate.role !== 'jobseeker') {
        return res.status(400).json({ error: 'Invalid candidate ID or candidate not found.' });
      }
    }

    const employerRequest = await prisma.employerRequest.create({
      data: {
        name,
        email,
        phoneNumber,
        message,
        requestedCandidateId: requestedCandidateId ? parseInt(requestedCandidateId, 10) : null
      }
    });

    // Send notification email to admin
    try {
      await sendEmployerRequestNotification(name, email, message, phoneNumber, requestedCandidateId);
    } catch (emailError) {
      console.error('Failed to send employer request notification:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      message: 'Employer request submitted successfully',
      request: employerRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit request.' });
  }
};

// Admin: Get all employer requests with pagination
exports.getAllEmployerRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.employerRequest.findMany({
        include: {
          selectedUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  skills: true
                }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get latest message
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.employerRequest.count()
    ]);

    // Get requested candidate details for each request
    const requestsWithCandidateDetails = await Promise.all(
      requests.map(async (request) => {
        if (request.requestedCandidateId) {
          const candidate = await prisma.user.findUnique({
            where: { id: request.requestedCandidateId },
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  skills: true,
                  experience: true,
                  location: true,
                  city: true,
                  country: true
                }
              }
            }
          });
          return {
            ...request,
            requestedCandidate: candidate
          };
        }
        return request;
      })
    );

    res.json({
      requests: requestsWithCandidateDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch employer requests.' });
  }
};

// Admin: Get specific employer request with messages
exports.getEmployerRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);

    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId },
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                contactNumber: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Get requested candidate details if available
    let requestWithCandidate = request;
    if (request.requestedCandidateId) {
      const candidate = await prisma.user.findUnique({
        where: { id: request.requestedCandidateId },
        include: {
          profile: {
            select: {
              firstName: true,
              lastName: true,
              skills: true,
              experience: true,
              location: true,
              city: true,
              country: true,
              contactNumber: true
            }
          }
        }
      });
      requestWithCandidate = {
        ...request,
        requestedCandidate: candidate
      };
    }

    res.json(requestWithCandidate);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch employer request.' });
  }
};

// Admin: Reply to employer request
exports.replyToEmployerRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Create message from admin
    const message = await prisma.message.create({
      data: {
        employerRequestId: requestId,
        fromAdmin: true,
        employerEmail: request.email,
        content
      }
    });

    // Send email notification to employer
    try {
      await sendAdminReplyNotification(request.email, request.name, content);
    } catch (emailError) {
      console.error('Failed to send admin reply notification:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      message: 'Reply sent successfully',
      messageData: message
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send reply.' });
  }
};

// Admin: Select a job seeker for employer request
exports.selectJobSeekerForRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { selectedUserId } = req.body;

    if (!selectedUserId) {
      return res.status(400).json({ error: 'Selected user ID is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Check if selected user exists and is a job seeker
    const selectedUser = await prisma.user.findUnique({
      where: { id: selectedUserId }
    });

    if (!selectedUser || selectedUser.role !== 'jobseeker') {
      return res.status(404).json({ error: 'Selected job seeker not found.' });
    }

    // Update request with selected user
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: { selectedUserId },
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                contactNumber: true
              }
            }
          }
        }
      }
    });

    res.json({
      message: 'Job seeker selected successfully',
      request: updatedRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to select job seeker.' });
  }
}; 