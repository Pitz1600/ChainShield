/** Barangay project categories for financial transaction classification. */
export const PROJECT_CATEGORIES = [
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

/** Resolve display category, inferring from program/description when missing. */
export function resolveProjectCategory(tx) {
  if (!tx) return 'Other';
  if (tx.projectCategory && PROJECT_CATEGORIES.includes(tx.projectCategory)) {
    return tx.projectCategory;
  }
  const combined = `${tx.programName || ''} ${tx.description || ''} ${tx.agency || ''}`.toLowerCase();
  for (const rule of INFERENCE_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.category;
    }
  }
  return 'Other';
}
