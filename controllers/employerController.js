const { getPrismaClient } = require('../utils/database');
const { getAnonymizedJobSeekerData } = require('../utils/dataAnonymizer');
const bcrypt = require('bcrypt');
const { generateRandomPassword } = require('../utils/passwordGenerator');
const { sendEmployerRequestNotification, sendAdminReplyNotification, sendCandidatePictureNotification, sendCandidateFullDetailsNotification, sendStatusUpdateNotification } = require('../utils/mailer');
const { getAdminEmail } = require('../utils/adminUtils');

let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Public: Submit employer request (no login required)
exports.submitEmployerRequest = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { name, email, phoneNumber, companyName, message, requestedCandidateId, priority } = req.body;

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

    // Check if employer account exists, if not create one
    let employerAccount = null;
    let existingUser = null;
    
    console.log(`🔍 Checking for existing user with email: ${email}`);
    
    // First, find the user by email
    existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        employerAccounts: true
      }
    });

    if (existingUser) {
      console.log(`✅ Found existing user: ${existingUser.id}, role: ${existingUser.role}, employer accounts: ${existingUser.employerAccounts.length}`);
      
      // User exists - check if they already have an employer account
      if (existingUser.employerAccounts.length > 0) {
        // User exists and has employer account(s)
        employerAccount = existingUser.employerAccounts[0];
        console.log(`✅ Using existing employer account: ${employerAccount.id}`);
      } else if (existingUser.role === 'employer') {
        // User exists with employer role but no employer account - create one
        console.log(`🔄 Creating employer account for existing employer user`);
        employerAccount = await prisma.employerAccount.create({
          data: {
            userId: existingUser.id,
            phoneNumber,
            companyName
          }
        });
        console.log(`✅ Created employer account: ${employerAccount.id}`);
      } else {
        // User exists but with different role (e.g., jobseeker) - update role and create employer account
        console.log(`🔄 Updating user role from ${existingUser.role} to employer and creating employer account`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'employer' }
        });
        
        employerAccount = await prisma.employerAccount.create({
          data: {
            userId: existingUser.id,
            phoneNumber,
            companyName
          }
        });
        console.log(`✅ Updated user role and created employer account: ${employerAccount.id}`);
      }
    }

    if (!employerAccount) {
      // No existing user - create new user and employer account
      console.log(`🆕 Creating new user and employer account`);
      const randomPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Create user record
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'employer'
        }
      });
      console.log(`✅ Created new user: ${user.id}`);

      // Create employer account
      employerAccount = await prisma.employerAccount.create({
        data: {
          userId: user.id,
          phoneNumber,
          companyName
        }
      });
      console.log(`✅ Created new employer account: ${employerAccount.id}`);

      // Store the plain password temporarily for email
      employerAccount.plainPassword = randomPassword;
    }

    // Create employer request linked to account
    const employerRequest = await prisma.employerRequest.create({
      data: {
        employerAccountId: employerAccount.id,
        message,
        requestedCandidateId: requestedCandidateId ? parseInt(requestedCandidateId, 10) : null,
        priority: priority || 'normal',
        // Set default payment requirements
        paymentRequired: true,
        paymentAmount: 5000.00,
        paymentCurrency: 'RWF',
        paymentDescription: 'Initial non-refundable fee for worker/service details access'
      }
    });

    // Create initial progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: employerRequest.id,
        stage: 'request_received',
        status: 'completed',
        description: 'Employer request received and under review. Initial payment of 5,000 Frw required.',
        completedAt: new Date()
      }
    });

    // Create payment required progress
    await prisma.requestProgress.create({
      data: {
        employerRequestId: employerRequest.id,
        stage: 'payment_required',
        status: 'pending',
        description: 'Initial payment of 5,000 Frw required to proceed with worker details access.',
        adminNotes: 'Employer needs to pay initial fee before receiving additional information'
      }
    });

    // Get admin email and send notification
    try {
      const adminEmail = await getAdminEmail();
      // Send to admin
      await sendEmployerRequestNotification(name, email, message, phoneNumber, companyName, requestedCandidateId, adminEmail, priority);
      
      // Send to employer with login credentials if new account
      if (employerAccount.plainPassword) {
        await sendEmployerRequestNotification(
          name, 
          email, 
          message, 
          phoneNumber, 
          companyName, 
          requestedCandidateId, 
          email, 
          priority,
          employerAccount.plainPassword // Pass the plain password for email
        );
      } else {
        // Send regular notification for existing accounts
        await sendEmployerRequestNotification(name, email, message, phoneNumber, companyName, requestedCandidateId, email, priority);
      }
    } catch (emailError) {
      console.error('Failed to send employer request notification:', emailError);
      // Continue even if email fails
    }

    // Send WebSocket notification
    if (global.wsServer) {
      global.wsServer.notifyNewRequest(employerRequest);
      // global.wsServer.notifyDashboardUpdate();
    }

    // Prepare response with login credentials if new account was created
    const response = {
      message: 'Employer request submitted successfully',
      request: {
        id: employerRequest.id,
        status: employerRequest.status,
        priority: employerRequest.priority,
        createdAt: employerRequest.createdAt
      }
    };

    // If this is a new account, include login credentials
    if (employerAccount.plainPassword) {
      response.loginCredentials = {
        email,
        password: employerAccount.plainPassword,
        message: 'Your account has been created. Please save these credentials to access your dashboard.'
      };
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit request.' });
  }
};

// Admin: Get all employer requests with pagination
exports.getAllEmployerRequests = async (req, res) => {
  try {
    const prisma = await initPrisma();
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

    // Get requested candidate details for each request with anonymization
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
                  photo: true,
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
          
          // Apply anonymization based on current access level
          const anonymizedCandidate = getAnonymizedJobSeekerData(candidate, request);
          
          return {
            ...request,
            requestedCandidate: anonymizedCandidate
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
      // global.wsServer.notifyDashboardUpdate();
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
    const prisma = await initPrisma();
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

// Get employer dashboard data
exports.getEmployerDashboard = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const employerId = req.user.id;

    // Get employer account details
    const employerAccount = await prisma.employerAccount.findFirst({
      where: { userId: employerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
          }
        }
      }
    });

    if (!employerAccount) {
      return res.status(404).json({ error: 'Employer account not found' });
    }

    // Get all requests for this employer
    const requests = await prisma.employerRequest.findMany({
      where: { employerAccountId: employerAccount.id },
      include: {
        requestedCandidate: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                photo: true,
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
                dateOfBirth: true,
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
        },
        selectedUser: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                photo: true,
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
                dateOfBirth: true,
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
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest message
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get latest payment
          include: {
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                accountName: true,
                accountNumber: true,
                bankName: true
              }
            }
          }
        },
        requestProgress: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest progress
        },
        _count: {
          select: {
            messages: true,
            payments: true,
            requestProgress: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get unread message count
    const unreadCount = await prisma.message.count({
      where: {
        fromAdmin: true,
        isRead: false,
        employerRequest: {
          employerAccountId: employerAccount.id
        }
      }
    });

    // Calculate statistics
    const stats = {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      paymentRequired: requests.filter(r => r.status === 'payment_required').length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      completedRequests: requests.filter(r => r.status === 'completed').length,
      totalMessages: requests.reduce((sum, r) => sum + r._count.messages, 0),
      unreadMessages: unreadCount,
      totalPayments: requests.reduce((sum, r) => sum + r._count.payments, 0)
    };

    // Process requests using proper anonymization utility
    const processedRequests = requests.map(request => {
      const requestData = {
        id: request.id,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        message: request.message,
        paymentRequired: request.paymentRequired,
        paymentAmount: request.paymentAmount,
        paymentCurrency: request.paymentCurrency,
        paymentDescription: request.paymentDescription,
        paymentDueDate: request.paymentDueDate,
        contactAccessGranted: request.contactAccessGranted,
        imageAccessGranted: request.imageAccessGranted,
        accessGrantedAt: request.accessGrantedAt,
        messageCount: request._count.messages,
        paymentCount: request._count.payments,
        progressCount: request._count.requestProgress,
        latestMessage: request.messages[0] || null,
        latestPayment: request.payments[0] || null,
        latestProgress: request.requestProgress[0] || null
      };

      // Add candidate information using proper anonymization utility
      if (request.requestedCandidate) {
        const anonymizedCandidate = getAnonymizedJobSeekerData(request.requestedCandidate, request);
        requestData.candidate = {
          id: anonymizedCandidate.id,
          name: `${anonymizedCandidate.profile.firstName} ${anonymizedCandidate.profile.lastName}`,
          skills: anonymizedCandidate.profile.skills || 'Not specified',
          experience: anonymizedCandidate.profile.experience || 'Not specified',
          experienceLevel: anonymizedCandidate.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedCandidate.profile.educationLevel || 'Not specified',
          location: anonymizedCandidate.profile.location || 'Not specified',
          city: anonymizedCandidate.profile.city || 'Not specified',
          country: anonymizedCandidate.profile.country || 'Not specified',
          gender: anonymizedCandidate.profile.gender || 'Not specified',
          monthlyRate: anonymizedCandidate.profile.monthlyRate || 'Not specified',
          availability: anonymizedCandidate.profile.availability || 'Not specified',
          languages: anonymizedCandidate.profile.languages || 'Not specified',
          certifications: anonymizedCandidate.profile.certifications || 'Not specified',
          description: anonymizedCandidate.profile.description || 'Not specified',
          photo: anonymizedCandidate.profile.photo,
          contactNumber: anonymizedCandidate.profile.contactNumber,
          accessLevel: anonymizedCandidate.accessLevel,
          accessGranted: anonymizedCandidate.accessGranted
        };
      }

      // Add selected user information if different from requested candidate
      if (request.selectedUser && request.selectedUser.id !== request.requestedCandidate?.id) {
        const anonymizedSelectedUser = getAnonymizedJobSeekerData(request.selectedUser, request);
        requestData.selectedUser = {
          id: anonymizedSelectedUser.id,
          name: `${anonymizedSelectedUser.profile.firstName} ${anonymizedSelectedUser.profile.lastName}`,
          skills: anonymizedSelectedUser.profile.skills || 'Not specified',
          experience: anonymizedSelectedUser.profile.experience || 'Not specified',
          experienceLevel: anonymizedSelectedUser.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedSelectedUser.profile.educationLevel || 'Not specified',
          location: anonymizedSelectedUser.profile.location || 'Not specified',
          city: anonymizedSelectedUser.profile.city || 'Not specified',
          country: anonymizedSelectedUser.profile.country || 'Not specified',
          gender: anonymizedSelectedUser.profile.gender || 'Not specified',
          monthlyRate: anonymizedSelectedUser.profile.monthlyRate || 'Not specified',
          availability: anonymizedSelectedUser.profile.availability || 'Not specified',
          languages: anonymizedSelectedUser.profile.languages || 'Not specified',
          certifications: anonymizedSelectedUser.profile.certifications || 'Not specified',
          description: anonymizedSelectedUser.profile.description || 'Not specified',
          photo: anonymizedSelectedUser.profile.photo,
          contactNumber: anonymizedSelectedUser.profile.contactNumber,
          accessLevel: anonymizedSelectedUser.accessLevel,
          accessGranted: anonymizedSelectedUser.accessGranted
        };
      }

      return requestData;
    });

    res.json({
      employer: {
        id: employerAccount.id,
        email: employerAccount.user.email,
        name: employerAccount.user.name,
        phoneNumber: employerAccount.phoneNumber,
        companyName: employerAccount.companyName,
        createdAt: employerAccount.user.createdAt
      },
      stats,
      requests: processedRequests
    });

  } catch (error) {
    console.error('Error getting employer dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
}; 