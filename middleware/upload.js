const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Message file storage
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/messages/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'message-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// File filter for message attachments (documents and images)
const messageFileFilter = (req, file, cb) => {
  // Allow common document and image types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed! Only documents and images are permitted.'), false);
  }
};

// Configure multer for profile photos
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Configure multer for message attachments
const uploadMessageFile = multer({
  storage: messageStorage,
  fileFilter: messageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for message attachments
  }
});

// Middleware for single photo upload
const uploadProfilePhoto = upload.single('photo');

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: [{ field: 'photo', message: 'Photo must be less than 5MB' }]
      });
    }
  } else if (err) {
    return res.status(400).json({
      error: 'Upload failed',
      details: [{ field: 'photo', message: err.message }]
    });
  }
  next();
};

// Error handling middleware for message file uploads
const handleMessageUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: [{ field: 'attachment', message: 'Attachment must be less than 10MB' }]
      });
    }
  } else if (err) {
    return res.status(400).json({
      error: 'Upload failed',
      details: [{ field: 'attachment', message: err.message }]
    });
  }
  next();
};

module.exports = {
  uploadProfilePhoto,
  uploadMessageFile,
  handleUploadError,
  handleMessageUploadError
}; 