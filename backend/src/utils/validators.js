const crypto = require('crypto');

// Password rules: 8–13 characters, including uppercase,
// lowercase and at least one number.
const PASSWORD_MESSAGE = 'Password 8-13';

function validatePassword(password) {
  if (typeof password !== 'string') return PASSWORD_MESSAGE;

  if (password.length < 8 || password.length > 13) {
    return PASSWORD_MESSAGE;
  }

  if (!/[A-Z]/.test(password)) return PASSWORD_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_MESSAGE;

  return null;
}

// Validate and normalize South African mobile numbers.
// Accepts local and international formats.
function validateSouthAfricanPhone(raw) {
  // Phone numbers are optional during registration.
  if (raw == null || raw === '') {
    return { phone: null };
  }

  if (typeof raw !== 'string') {
    return { error: 'Invalid phone number' };
  }

  // Allow spaces, hyphens and parentheses as formatting.
  const cleaned = raw.trim().replace(/[\s()-]/g, '');

  // Accept 0XX XXXXXXX, 27XX XXXXXXX or +27XX XXXXXXX.
  // Restrict numbers to South African mobile prefixes 06, 07 and 08.
  const validFormat = /^(?:\+27|27|0)(?:6\d|7\d|8\d)\d{7}$/;

  if (!validFormat.test(cleaned)) {
    return { error: 'Invalid phone number' };
  }

  const digits = cleaned.replace(/\D/g, '');

  let nationalNumber;

  if (digits.startsWith('27')) {
    nationalNumber = digits.slice(2);
  } else {
    nationalNumber = digits.slice(1);
  }

  // Store all accepted numbers in +27 format.
  return {
    phone: `+27${nationalNumber}`,
  };
}

// Full name must contain at least two words.
function validateFullName(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { error: 'full_name is required' };
  }

  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length > 100) {
    return {
      error: 'full_name is too long (max 100 characters)',
    };
  }

  const parts = name.split(' ');

  if (parts.length < 2) {
    return {
      error: 'Please enter your first name and surname, separated by a space',
    };
  }

  const wordOk = /^[\p{L}][\p{L}'’.-]*$/u;

  if (!parts.every((part) => wordOk.test(part))) {
    return {
      error: 'Names can only contain letters, hyphens, apostrophes and full stops',
    };
  }

  return { name };
}

// Generate temporary passwords that meet the password rules.
function generateTempPassword(length = 10) {
  if (!Number.isInteger(length) || length < 8 || length > 13) {
    throw new Error('Password length must be 8-13');
  }

  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const pick = (set) => set[crypto.randomInt(set.length)];

  const chars = [
    pick(upper),
    pick(lower),
    pick(digits),
  ];

  while (chars.length < length) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);

    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

module.exports = {
  validatePassword,
  validateSouthAfricanPhone,
  validateFullName,
  generateTempPassword,
  PASSWORD_MESSAGE,
};