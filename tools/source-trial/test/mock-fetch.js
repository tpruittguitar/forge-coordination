'use strict';
// Test-only fetch stub for the source trial: two Greenhouse boards, a probed Lever board, everything else 404.
const R = {
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true': { jobs: [
    { title: 'Director of Quality', location: { name: 'Dayton, OH' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/111', content: '' },
    { title: 'Senior Director, Quality Assurance', location: { name: 'Austin, TX' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/222', content: 'Base pay $200,000 - $250,000' },
    { title: 'Director of Manufacturing Engineering', location: { name: 'Munich, Germany' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/333', content: '' },
    { title: 'Software Quality Director', location: { name: 'Remote, US' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/444', content: '' },
    { title: 'Quality Engineer', location: { name: 'Dayton, OH' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/555', content: '' } ] },
  'https://boards-api.greenhouse.io/v1/boards/aevexaerospace/jobs?content=true': { jobs: [
    { title: 'Plant Manager', location: { name: 'Tampa, FL' }, absolute_url: 'https://job-boards.greenhouse.io/aevexaerospace/jobs/1', content: '' } ] },
  'https://api.lever.co/v0/postings/shieldai?mode=json': [
    { text: 'Director of Production', categories: { location: 'Dallas, TX' }, hostedUrl: 'https://jobs.lever.co/shieldai/x1', descriptionPlain: '' } ],
};
globalThis.fetch = async url => {
  if(process.env.TRIAL_FETCH_LOG)require('fs').appendFileSync(process.env.TRIAL_FETCH_LOG,String(url)+'\n');
  if (url in R) { const b = R[url]; return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) }; }
  return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};
