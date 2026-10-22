const termsVersion='2026-10-22-customer-v3';
const privacyVersion='2026-10-22-customer-v3';
function legalVersions(role) {
  return role==='customer'?{termsVersion,privacyVersion}:{termsVersion:'2026-10-13-v2',privacyVersion:'2026-10-13-v2'};
}
// Always require customer acceptance; preserve other roles' existing rollout.
function legalRequired(role, env=process.env) {
  return role==='customer'||env.LEGAL_ACCEPTANCE_ENABLED==='true';
}
module.exports={legalRequired,legalVersions,termsVersion,privacyVersion};
