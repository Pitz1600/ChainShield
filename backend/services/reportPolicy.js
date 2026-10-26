const expenditure = require('./budgetExpenditurePolicy');
const { fail } = require('./budgetProposalPolicy');
function access(user) {
  const ready = user && user.isActive === true && user.isVerified === true && user.isApproved === true && !user.mustChangePassword && !user.mustSetup2FA && (user.role !== 'administrator' || user.twoFactorEnabled);
  const allowed = ready && expenditure.reader(user);
  return { enabled: expenditure.enabled(), reportTypes: expenditure.enabled() && allowed ? ['summary', 'register', ...(['auditor', 'administrator'].includes(user.role) ? ['audit'] : [])] : [] };
}
function requireAccess(user, type) {
  const result = access(user);
  if (!result.enabled) fail('Budget expenditure reports are unavailable: module disabled', 503);
  if (!result.reportTypes.length || (type && !result.reportTypes.includes(type))) fail('Report access denied', 403);
  return result;
}
module.exports = { access, requireAccess };
