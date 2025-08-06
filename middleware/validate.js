const { body, validationResult } = require('express-validator');

// Validation rules for job seeker registration
const validateJobSeekerRegistration = [
  // Email is optional, but if present must be valid
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  // ID Number validation (16 digits)
  body('idNumber')
    .optional()
    .isLength({ min: 16, max: 16 })
    .withMessage('ID number must be exactly 16 digits')
    .matches(/^\d{16}$/)
    .withMessage('ID number must contain only digits'),
  
  // Date of Birth validation (18+ years old)
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age = age - 1;
        }
        
        if (age < 18) {
          throw new Error('You must be at least 18 years old to register');
        }
      }
      return true;
    }),
  
  // Contact number validation (accept local formats e.g. 078xxxxxxx, 079xxxxxxx, 072xxxxxxx, 073xxxxxxx)
  body('contactNumber')
    .optional({ checkFalsy: true })
    .matches(/^(078|079|072|073)\d{7}$/)
    .withMessage('Please provide a valid contact number'),
  // Custom validator: require at least one of email or contactNumber
  body().custom(body => {
    if (!body.email && !body.contactNumber) {
      throw new Error('At least one of email or contact number is required');
    }
    return true;
  }),
  
  // Marital status validation
  body('maritalStatus')
    .optional()
    .isIn(['Single', 'Married', 'Divorced', 'Widowed'])
    .withMessage('Marital status must be one of: Single, Married, Divorced, Widowed'),
  
  // Location validation
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  
  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters'),
  
  // Other optional fields
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('skills')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Skills must not exceed 300 characters'),
  
  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be one of: Male, Female, Other'),
  
  body('experience')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Experience must not exceed 200 characters'),
  
  body('references')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('References must not exceed 300 characters'),
  
  body('jobCategoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Job category ID must be a positive integer'),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

module.exports = {
  validateJobSeekerRegistration,
  handleValidationErrors
}; 