const crypto = require('crypto');

// Password rules: 8 to 72 characters, with an upper case letter, a lower case
// letter and a number. (bcrypt ignores everything after 72 bytes, so longer
// passwords would give a false sense of security.)
const PASSWORD_MESSAGE =
  'Password must be 8 to 72 characters and include an uppercase letter, a lowercase letter and a number';

function validatePassword(password) {
  if (typeof password !== 'string') return PASSWORD_MESSAGE;
  if (password.length < 8 || password.length > 72) return PASSWORD_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_MESSAGE;
  return null;
}

// Full name must be at least two words separated by a space, e.g. "Jane Doe".
// Returns { error } or { name } (the cleaned-up name to save).
function validateFullName(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { error: 'full_name is required' };
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length > 100) {
    return { error: 'full_name is too long (max 100 characters)' };
  }
  const parts = name.split(' ');
  if (parts.length < 2) {
    return { error: 'Please enter your first name and surname, separated by a space' };
  }
  const wordOk = /^[\p{L}][\p{L}'’.-]*$/u;
  if (!parts.every((p) => wordOk.test(p))) {
    return { error: 'Names can only contain letters, hyphens, apostrophes and full stops' };
  }
  return { name };
}

// Random temporary password that always passes validatePassword.
// Leaves out look-alike characters (0/O, 1/l/I) so it is easy to read out.
function generateTempPassword(length = 10) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { validatePassword, validateFullName, generateTempPassword, PASSWORD_MESSAGE };
