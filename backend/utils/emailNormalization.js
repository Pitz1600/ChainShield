const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function splitEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }
  return {
    local: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1)
  };
}

function normalizeEmail(email) {
  const parts = splitEmail(email);
  if (!parts) return String(email || '').trim().toLowerCase();

  let { local, domain } = parts;

  if (GMAIL_DOMAINS.has(domain)) {
    // Gmail treats dots and plus aliases in local-part as the same mailbox.
    local = local.split('+')[0].replace(/\./g, '');
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}

function isGmailLike(email) {
  const parts = splitEmail(email);
  return Boolean(parts && GMAIL_DOMAINS.has(parts.domain));
}

async function findUserByEmail(UserModel, email, select = '') {
  const normalizedInput = String(email || '').trim().toLowerCase();
  if (!normalizedInput) return null;

  const canonicalInput = normalizeEmail(normalizedInput);
  const candidateEmails = Array.from(new Set([normalizedInput, canonicalInput]));

  let query = UserModel.findOne({ email: { $in: candidateEmails } });
  if (select) query = query.select(select);
  let user = await query;
  if (user) return user;

  if (!isGmailLike(normalizedInput)) return null;

  // Backward-compatible fallback for legacy rows saved with dotted gmail local-parts.
  let fallbackQuery = UserModel.find({ email: /@(gmail\.com|googlemail\.com)$/i });
  if (select) fallbackQuery = fallbackQuery.select(select);
  const gmailUsers = await fallbackQuery;

  user = gmailUsers.find((u) => normalizeEmail(u.email) === canonicalInput) || null;
  return user;
}

module.exports = {
  normalizeEmail,
  findUserByEmail
};
