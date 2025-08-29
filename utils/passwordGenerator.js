/**
 * Generate a random password in the format: abc@123
 * Where:
 * - First 3 characters are random lowercase letters
 * - @ symbol
 * - Last 3 characters are random digits
 */
function generateRandomPassword() {
  // Generate 3 random lowercase letters
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let randomLetters = '';
  for (let i = 0; i < 3; i++) {
    randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Generate 3 random digits
  const digits = '0123456789';
  let randomDigits = '';
  for (let i = 0; i < 3; i++) {
    randomDigits += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  
  // Combine in format: abc@123
  return `${randomLetters}@${randomDigits}`;
}

/**
 * Generate multiple random passwords
 * @param {number} count - Number of passwords to generate
 * @returns {string[]} Array of random passwords
 */
function generateMultiplePasswords(count = 1) {
  const passwords = [];
  for (let i = 0; i < count; i++) {
    passwords.push(generateRandomPassword());
  }
  return passwords;
}

module.exports = {
  generateRandomPassword,
  generateMultiplePasswords
};
