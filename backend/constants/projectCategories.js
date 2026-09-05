/**
 * Barangay project categories for financial transaction classification.
 * Orthogonal to transactionType (fund/mechanism).
 */
const PROJECT_CATEGORIES = [
  'Agriculture',
  'Livelihood',
  'Tourism',
  'Socio-cultural activities',
  'Sports',
  'Health',
  'Beautification programs',
  'Infrastructure',
  'Education',
  'Other'
];

const CATEGORY_ALIASES = {
  agriculture: 'Agriculture',
  agri: 'Agriculture',
  farming: 'Agriculture',
  livelihood: 'Livelihood',
  tourism: 'Tourism',
  'socio-cultural': 'Socio-cultural activities',
  'socio cultural': 'Socio-cultural activities',
  sociocultural: 'Socio-cultural activities',
  'socio-cultural activities': 'Socio-cultural activities',
  cultural: 'Socio-cultural activities',
  sports: 'Sports',
  health: 'Health',
  healthcare: 'Health',
  beautification: 'Beautification programs',
  'beautification programs': 'Beautification programs',
  infrastructure: 'Infrastructure',
  education: 'Education',
  other: 'Other'
};

const INFERENCE_RULES = [
  { category: 'Agriculture', keywords: ['agriculture', 'agri', 'farming', 'palay', 'crop', 'fertilizer', 'seed distribution', 'irrigat', 'fishery', 'livestock'] },
  { category: 'Livelihood', keywords: ['livelihood', 'tupad', 'microenterprise', 'sari-sari', 'skills training', 'entrepreneur'] },
  { category: 'Tourism', keywords: ['tourism', 'tourist', 'eco-tourism', 'ecotourism'] },
  { category: 'Socio-cultural activities', keywords: ['socio-cultural', 'sociocultural', 'cultural', 'fiesta', 'festival', 'tradition', 'arts and culture'] },
  { category: 'Sports', keywords: ['sports', 'athletic', 'basketball', 'volleyball', 'tournament', 'gymnasium'] },
  { category: 'Health', keywords: ['health', 'medical', 'medicine', 'nutrition', 'bhc', 'clinic', 'barangay health', 'vaccine', 'sanitation'] },
  { category: 'Beautification programs', keywords: ['beautification', 'cleanup', 'clean-up', 'landscap', 'greening', 'parks and plaza'] },
  { category: 'Infrastructure', keywords: ['infrastructure', 'road repair', 'public works', 'construction', 'drainage', 'streetlight', 'pathway'] },
  { category: 'Education', keywords: ['education', 'school', 'scholarship', 'learning', 'classroom', 'day care', 'daycare'] }
];

function normalizeProjectCategory(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (PROJECT_CATEGORIES.includes(raw)) return raw;

  const lower = raw.toLowerCase();
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];

  const compact = lower.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (CATEGORY_ALIASES[compact]) return CATEGORY_ALIASES[compact];

  const match = PROJECT_CATEGORIES.find((c) => c.toLowerCase() === compact);
  return match || null;
}

function inferProjectCategory({ programName, description, agency, projectCategory } = {}) {
  const normalized = normalizeProjectCategory(projectCategory);
  if (normalized) return normalized;

  const combined = `${programName || ''} ${description || ''} ${agency || ''}`.toLowerCase();
  if (!combined.trim()) return 'Other';

  for (const rule of INFERENCE_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.category;
    }
  }

  return 'Other';
}

module.exports = {
  PROJECT_CATEGORIES,
  normalizeProjectCategory,
  inferProjectCategory
};
