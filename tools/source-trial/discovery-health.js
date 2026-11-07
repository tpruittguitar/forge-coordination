'use strict';

// Keep this projection aligned with foreman-cockpit's pipeline-health fallback.
// Counts include every candidate; URLs alone are de-duplicated for the union.
function discoveryHealth(report) {
  if (!report?.summary?.at || !Array.isArray(report.new_roles)) {
    throw new Error('Unsupported discovery report');
  }
  const urls = new Set();
  for (const role of report.new_roles) {
    if (role && typeof role.url === 'string' && /^https:\/\//.test(role.url)) {
      urls.add(role.url.replace(/#.*$/, ''));
    }
  }
  return {
    schema: 'forge.discovery-health.v1',
    at: report.summary.at,
    failedBoards: report.summary.boards?.failed || 0,
    candidates: report.new_roles.length,
    urls: [...urls],
  };
}

module.exports = { discoveryHealth };
