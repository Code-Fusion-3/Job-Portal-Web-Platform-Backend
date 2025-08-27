/**
 * Utility functions for anonymizing sensitive job seeker data
 * Used to hide personal information until payment is approved
 */

/**
 * Anonymize a name (show only first letter of each part)
 * @param {string} name - Full name to anonymize
 * @returns {string} Anonymized name (e.g., "John Doe" -> "J*** D**")
 */
// TO DO:
// - Always use exactly two stars "**" after the first letter of each name part, regardless of length
// - If only one part, apply to that part
// - If more than two parts, only anonymize the first two, ignore the rest

function anonymizeName(name) {
  if (!name || typeof name !== 'string') return '';
  
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    // Only anonymize first two parts, ignore the rest
    return `${parts[0].charAt(0)}** ${parts[1].charAt(0)}**`;
  } else if (parts.length === 1 && parts[0].length > 0) {
    return `${parts[0].charAt(0)}**`;
  } else {
    return '';
  }
}

/**
 * Anonymize a phone number (show only first 3 and last 2 digits)
 * @param {string} phone - Phone number to anonymize
 * @returns {string} Anonymized phone (e.g., "0788123456" -> "078*****56")
 */
function anonymizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 5) return phone;
  
  const firstThree = cleaned.substring(0, 3);
  const lastTwo = cleaned.substring(cleaned.length - 2);
  const middle = '*'.repeat(cleaned.length - 5);
  
  return `${firstThree}${middle}${lastTwo}`;
}

/**
 * Anonymize an email (show only first letter and domain)
 * @param {string} email - Email to anonymize
 * @returns {string} Anonymized email (e.g., "john@example.com" -> "j***@example.com")
 */
function anonymizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  const firstChar = localPart.charAt(0);
  const anonymizedLocal = `${firstChar}${'*'.repeat(localPart.length - 1)}`;
  
  return `${anonymizedLocal}@${domain}`;
}

/**
 * Anonymize location data (show only city and country, hide specific address)
 * @param {string} location - Specific location/address
 * @param {string} city - City name
 * @param {string} country - Country name
 * @returns {object} Anonymized location data
 */
function anonymizeLocation(location, city, country) {
  return {
    location: location ? '***' : null,
    city: city || null,
    country: country || null
  };
}

/**
 * Anonymize job seeker profile data based on access level
 * @param {object} profile - Job seeker profile data
 * @param {string} accessLevel - Current access level: 'none', 'photo', 'full'
 * @returns {object} Anonymized profile data
 */
function anonymizeProfile(profile, accessLevel = 'none') {
  if (!profile) return null;

  const baseData = {
    id: profile.id,
    skills: profile.skills,
    experience: profile.experience,
    experienceLevel: profile.experienceLevel,
    educationLevel: profile.educationLevel,
    availability: profile.availability,
    languages: profile.languages,
    certifications: profile.certifications,
    description: profile.description,
    gender: profile.gender,
    maritalStatus: profile.maritalStatus,
    monthlyRate: profile.monthlyRate,
    jobCategory: profile.jobCategory
  };

  switch (accessLevel) {
    case 'none':
      // Most restricted - only basic info
      return {
        ...baseData,
        firstName: anonymizeName(profile.firstName),
        lastName: anonymizeName(profile.lastName),
        contactNumber: anonymizePhone(profile.contactNumber),
        photo: null,
        location: anonymizeLocation(profile.location, profile.city, profile.country),
        city: profile.city,
        country: profile.country,
        idNumber: null,
        references: null,
        dateOfBirth: null
      };

    case 'photo':
      // Photo access granted - show photo but keep other details hidden
      return {
        ...baseData,
        firstName: anonymizeName(profile.firstName),
        lastName: anonymizeName(profile.lastName),
        contactNumber: anonymizePhone(profile.contactNumber),
        photo: profile.photo, // Show photo
        location: anonymizeLocation(profile.location, profile.city, profile.country),
        city: profile.city,
        country: profile.country,
        idNumber: null,
        references: null,
        dateOfBirth: null
      };

    case 'full':
      // Full access granted - show all details
      return {
        ...baseData,
        firstName: profile.firstName,
        lastName: profile.lastName,
        contactNumber: profile.contactNumber,
        photo: profile.photo,
        location: profile.location,
        city: profile.city,
        country: profile.country,
        idNumber: profile.idNumber,
        references: profile.references,
        dateOfBirth: profile.dateOfBirth
      };

    default:
      return anonymizeProfile(profile, 'none');
  }
}

/**
 * Get anonymized job seeker data for employer display
 * @param {object} user - User object with profile
 * @param {object} employerRequest - Employer request object
 * @returns {object} Anonymized job seeker data
 */
function getAnonymizedJobSeekerData(user, employerRequest) {
  if (!user || !user.profile) return null;

  // Determine current access level based on request status
  let accessLevel = 'none';
  
  if (employerRequest.imageAccessGranted && employerRequest.contactAccessGranted) {
    accessLevel = 'full';
  } else if (employerRequest.imageAccessGranted) {
    accessLevel = 'photo';
  }

  return {
    id: user.id,
    profile: anonymizeProfile(user.profile, accessLevel),
    accessLevel,
    accessGranted: {
      photo: employerRequest.imageAccessGranted,
      contact: employerRequest.contactAccessGranted,
      full: employerRequest.imageAccessGranted && employerRequest.contactAccessGranted
    }
  };
}

module.exports = {
  anonymizeName,
  anonymizePhone,
  anonymizeEmail,
  anonymizeLocation,
  anonymizeProfile,
  getAnonymizedJobSeekerData
};
