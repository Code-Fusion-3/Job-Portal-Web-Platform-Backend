const { PrismaClient } = require("@prisma/client");
const { sendEmployerRequestNotification, sendAdminReplyNotification, sendCandidatePictureNotification, sendCandidateFullDetailsNotification, sendStatusUpdateNotification } = require('../utils/mailer');
const { getAdminEmail } = require('../utils/adminUtils');

const prisma = new PrismaClient();

// Public: Submit employer request (no login required)
exports.submitEmployerRequest = async (req, res) => {
  try {
    const { name, email, phoneNumber, companyName, message, requestedCandidateId } = req.body;

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
        companyName,
        message,
        requestedCandidateId: requestedCandidateId ? parseInt(requestedCandidateId, 10) : null
      }
    });

    // Get admin email and send notification
    try {
      const adminEmail = await getAdminEmail();
      await sendEmployerRequestNotification(name, email, message, phoneNumber, companyName, requestedCandidateId, adminEmail);
    } catch (emailError) {
      console.error('Failed to send employer request notification:', emailError);
      // Continue even if email fails
    }

    // Send WebSocket notification
    if (global.wsServer) {
      global.wsServer.notifyNewRequest(employerRequest);
      global.wsServer.notifyDashboardUpdate();
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
    
    // Extract filter parameters
    const { 
      status, 
      priority, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      dateFrom,
      dateTo,
      category
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (priority) {
      whereClause.priority = priority;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt.lte = new Date(dateTo);
      }
    }

    // Handle category filtering
    if (category) {
      whereClause.requestedCandidate = {
        profile: {
          jobCategory: {
            name_en: { equals: category, mode: 'insensitive' }
          }
        }
      };
    }

    // Validate sort parameters
    const validSortFields = ['createdAt', 'updatedAt', 'name', 'email', 'status', 'priority'];
    const validSortOrders = ['asc', 'desc'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    const [requests, total] = await Promise.all([
      prisma.employerRequest.findMany({
        where: whereClause,
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
            orderBy: { createdAt: 'desc' },
            take: 1 // Get latest message
          }
        },
        skip,
        take: limit,
        orderBy: { [finalSortBy]: finalSortOrder }
      }),
      prisma.employerRequest.count({ where: whereClause })
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
                  experienceLevel: true,
                  location: true,
                  city: true,
                  country: true,
                  contactNumber: true,
                  monthlyRate: true,
                  jobCategoryId: true,
                  educationLevel: true,
                  availability: true,
                  languages: true,
                  certifications: true,
                  description: true,
                  gender: true,
                  maritalStatus: true,
                  idNumber: true,
                  references: true,
                  jobCategory: {
                    select: {
                      id: true,
                      name_en: true,
                      name_rw: true
                    }
                  }
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

    // Get status counts for dashboard
    const statusCounts = await prisma.employerRequest.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Format status counts
    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    res.json({
      requests: requestsWithCandidateDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        status,
        priority,
        search,
        sortBy: finalSortBy,
        sortOrder: finalSortOrder,
        dateFrom,
        dateTo
      },
      summary: {
        statusCounts: statusSummary,
        totalRequests: total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch employer requests.' });
  }
};

// Admin: Get request statistics
exports.getRequestStats = async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to last 30 days
    const days = parseInt(period);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get status counts
    const statusCounts = await prisma.employerRequest.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get priority counts
    const priorityCounts = await prisma.employerRequest.groupBy({
      by: ['priority'],
      _count: {
        priority: true
      }
    });

    // Get recent requests (last 7 days)
    const recentRequests = await prisma.employerRequest.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get requests with selected candidates
    const requestsWithCandidates = await prisma.employerRequest.count({
      where: {
        selectedUserId: {
          not: null
        }
      }
    });

    // Get approved requests count
    const approvedRequests = await prisma.employerRequest.count({
      where: {
        status: 'approved'
      }
    });

    // Get monthly trend (last 6 months)
    const monthlyTrend = await prisma.employerRequest.groupBy({
      by: ['createdAt'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Format monthly trend data
    const monthlyData = monthlyTrend.reduce((acc, item) => {
      const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM format
      acc[month] = (acc[month] || 0) + item._count.id;
      return acc;
    }, {});

    // Format status counts
    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    // Format priority counts
    const prioritySummary = priorityCounts.reduce((acc, item) => {
      acc[item.priority] = item._count.priority;
      return acc;
    }, {});

    res.json({
      summary: {
        totalRequests: Object.values(statusSummary).reduce((a, b) => a + b, 0),
        recentRequests,
        requestsWithCandidates,
        approvedRequests
      },
      statusCounts: statusSummary,
      priorityCounts: prioritySummary,
      monthlyTrend: monthlyData,
      period: `${days} days`
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch request statistics.' });
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
    const adminUser = req.user; // Get admin user from auth middleware

    console.log(`📧 Admin reply attempt - Request ID: ${requestId}, Admin: ${adminUser?.email || 'Unknown'}`);

    if (!content) {
      console.log('❌ Reply failed: Missing content');
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      console.log(`❌ Reply failed: Request not found - ID: ${requestId}`);
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    console.log(`📋 Request details - Employer: ${request.name} (${request.email}), Status: ${request.status}`);

    // Check if request is approved - block further communication
    if (request.status === 'approved') {
      console.log(`❌ Reply blocked: Request already approved - ID: ${requestId}`);
      return res.status(400).json({ 
        error: 'Cannot send messages for approved requests. Communication is closed after approval.' 
      });
    }

    // Check if request is cancelled or completed
    if (request.status === 'cancelled' || request.status === 'completed') {
      console.log(`❌ Reply blocked: Request ${request.status} - ID: ${requestId}`);
      return res.status(400).json({ 
        error: `Cannot send messages for ${request.status} requests.` 
      });
    }

    // Create message from admin
    const message = await prisma.message.create({
      data: {
        employerRequestId: requestId,
        fromAdmin: true,
        employerEmail: request.email,
        content,
        messageType: 'admin_reply'
      }
    });

    console.log(`✅ Message saved to database - Message ID: ${message.id}`);

    // Send email notification to employer
    let emailSent = false;
    try {
      console.log(`📤 Sending email to employer: ${request.email}`);
      await sendAdminReplyNotification(request.email, request.name, content);
      emailSent = true;
      console.log(`✅ Email sent successfully to: ${request.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send admin reply notification:', emailError);
      // Continue even if email fails
    }

    // Log the reply action
    console.log(`📝 Reply completed - Request: ${requestId}, Employer: ${request.name}, Email: ${emailSent ? 'Sent' : 'Failed'}`);

    res.status(201).json({
      message: 'Reply sent successfully',
      messageData: {
        ...message,
        emailSent,
        employerName: request.name,
        employerEmail: request.email
      }
    });
  } catch (err) {
    console.error('❌ Reply error:', err);
    res.status(500).json({ error: err.message || 'Failed to send reply.' });
  }
};

// Admin: Select a job seeker for employer request
exports.selectJobSeekerForRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { selectedUserId, detailsType = 'picture' } = req.body;
    const adminUser = req.user; // Get admin user from auth middleware

    console.log(`👤 Candidate selection attempt - Request ID: ${requestId}, Candidate: ${selectedUserId}, Details: ${detailsType}, Admin: ${adminUser?.email || 'Unknown'}`);

    if (!selectedUserId) {
      console.log('❌ Selection failed: Missing selected user ID');
      return res.status(400).json({ error: 'Selected user ID is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      console.log(`❌ Selection failed: Request not found - ID: ${requestId}`);
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    console.log(`📋 Request details - Employer: ${request.name} (${request.email}), Status: ${request.status}`);

    // Check if request is already approved
    if (request.status === 'approved') {
      console.log(`❌ Selection blocked: Request already approved - ID: ${requestId}`);
      return res.status(400).json({ 
        error: 'Cannot select candidate for approved requests.' 
      });
    }

    // Check if selected user exists and is a job seeker
    const selectedUser = await prisma.user.findUnique({
      where: { id: selectedUserId },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            skills: true,
            experience: true,
            experienceLevel: true,
            educationLevel: true,
            location: true,
            city: true,
            country: true,
            contactNumber: true,
            monthlyRate: true,
            availability: true,
            languages: true,
            certifications: true,
            description: true,
            gender: true,
            maritalStatus: true,
            idNumber: true,
            references: true,
            jobCategory: {
              select: {
                id: true,
                name_en: true,
                name_rw: true
              }
            }
          }
        }
      }
    });

    if (!selectedUser || selectedUser.role !== 'jobseeker') {
      console.log(`❌ Selection failed: Job seeker not found - ID: ${selectedUserId}`);
      return res.status(404).json({ error: 'Selected job seeker not found.' });
    }

    console.log(`✅ Candidate found: ${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}`);

    // Update request with selected user
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: { 
        selectedUserId,
        status: 'in_progress' // Update status to in progress
      },
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
                experienceLevel: true,
                educationLevel: true,
                location: true,
                city: true,
                country: true,
                contactNumber: true,
                monthlyRate: true,
                availability: true,
                languages: true,
                certifications: true,
                description: true,
                gender: true,
                maritalStatus: true,
                idNumber: true,
                references: true,
                jobCategory: {
                  select: {
                    id: true,
                    name_en: true,
                    name_rw: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`✅ Request updated with selected candidate - Request ID: ${requestId}`);

    // Send email notification to employer based on details type
    let emailSent = false;
    try {
      console.log(`📤 Sending candidate selection email to employer: ${request.email}`);
      
      if (detailsType === 'picture') {
        await sendCandidatePictureNotification(request.email, request.name, selectedUser);
      } else {
        await sendCandidateFullDetailsNotification(request.email, request.name, selectedUser);
      }
      
      emailSent = true;
      console.log(`✅ Candidate selection email sent successfully to: ${request.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send candidate selection notification:', emailError);
      // Continue even if email fails
    }

    // Log the selection action
    console.log(`📝 Candidate selection completed - Request: ${requestId}, Employer: ${request.name}, Candidate: ${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}, Details: ${detailsType}, Email: ${emailSent ? 'Sent' : 'Failed'}`);

    res.json({
      message: 'Job seeker selected successfully',
      request: {
        ...updatedRequest,
        emailSent,
        detailsType,
        employerName: request.name,
        employerEmail: request.email,
        candidateName: `${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}`
      }
    });
  } catch (err) {
    console.error('❌ Selection error:', err);
    res.status(500).json({ error: err.message || 'Failed to select job seeker.' });
  }
};

// Admin: Approve employer request
exports.approveEmployerRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { adminNotes } = req.body;

    // Check if request exists
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
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Check if request is already approved
    if (request.status === 'approved') {
      return res.status(400).json({ error: 'Request is already approved.' });
    }

    // Check if request is cancelled or completed
    if (request.status === 'cancelled' || request.status === 'completed') {
      return res.status(400).json({ error: 'Cannot approve a cancelled or completed request.' });
    }

    // Update request status to approved
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: { 
        status: 'approved',
        updatedAt: new Date()
      },
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

    // Create system message indicating approval
    if (adminNotes) {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: request.email,
          content: `Request approved. ${adminNotes}`,
          messageType: 'system'
        }
      });
    } else {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: request.email,
          content: 'Request approved by admin.',
          messageType: 'system'
        }
      });
    }

    // Send approval notification email to employer
    try {
      await sendRequestApprovalNotification(
        request.email, 
        request.name, 
        request.selectedUser,
        adminNotes
      );
    } catch (emailError) {
      console.error('Failed to send approval notification:', emailError);
      // Continue even if email fails
    }

    // Send WebSocket notification
    if (global.wsServer) {
      global.wsServer.notifyRequestStatusChange(requestId, 'approved');
      global.wsServer.notifyDashboardUpdate();
    }

    res.json({
      message: 'Employer request approved successfully',
      request: updatedRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to approve request.' });
  }
};

// Admin: Update request status
exports.updateRequestStatus = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status, priority, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: pending, in_progress, approved, completed, cancelled' });
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority. Must be one of: low, normal, high, urgent' });
      }
    }

    // Check if request exists
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
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Prepare update data
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (priority) {
      updateData.priority = priority;
    }

    // Update request
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: updateData,
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

    // Create system message for status change
    if (adminNotes) {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: request.email,
          content: `Status updated to ${status}. ${adminNotes}`,
          messageType: 'system'
        }
      });
    } else {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: request.email,
          content: `Status updated to ${status} by admin.`,
          messageType: 'system'
        }
      });
    }

    // Send email notification for status changes (except for pending)
    // Also send email if admin notes are provided, even if status hasn't changed
    if ((status !== 'pending' && status !== request.status) || adminNotes) {
      try {
        console.log(`📧 Sending status update email to: ${request.email}, Status: ${status}, Previous: ${request.status}, Has Notes: ${adminNotes ? 'Yes' : 'No'}`);
        await sendStatusUpdateNotification(
          request.email,
          request.name,
          status,
          adminNotes,
          {
            id: request.id,
            message: request.message,
            companyName: request.companyName,
            phoneNumber: request.phoneNumber
          }
        );
        console.log(`✅ Status update email sent successfully to: ${request.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send status update notification:', emailError);
        // Continue even if email fails
      }
    } else {
      console.log(`ℹ️ Skipping email notification - Status: ${status}, Previous: ${request.status}, No Notes`);
    }

    res.json({
      message: 'Request status updated successfully',
      request: updatedRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update request status.' });
  }
}; 