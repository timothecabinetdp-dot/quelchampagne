import { existsSync, readFileSync } from 'node:fs';

const status = JSON.parse(readFileSync('launch-status.json', 'utf8'));
const required = [
  'technicalValidation',
  'responsiveVisualReview',
  'publisherIdentityProvided',
  'publicationDirectorProvided',
  'professionalContactProvided',
  'hostIdentityProvided',
  'privacyPolicyFinalized',
  'affiliateDisclosureFinalized',
  'imageRightsRegisterComplete'
];
const blockers = required.filter(key => status.checks[key] !== true);

for (const asset of ['assets/hero-quelchampagne.svg', 'assets/og-quelchampagne.png', 'data/image-rights-register.json']) {
  if (!existsSync(asset)) blockers.push(`missing:${asset}`);
}

const legal = readFileSync('dist/mentions-legales/index.html', 'utf8');
const privacy = readFileSync('dist/confidentialite/index.html', 'utf8');
if (legal.includes('[À RENSEIGNER')) blockers.push('legal-placeholders');
if (privacy.includes('[À RENSEIGNER')) blockers.push('privacy-placeholders');
if (status.deploymentAuthorized !== true) blockers.push('deployment-authorization');

if (blockers.length) {
  console.error('Déploiement bloqué :');
  for (const blocker of [...new Set(blockers)]) console.error(`- ${blocker}`);
  process.exit(1);
}

console.log('Feu vert lancement : tous les contrôles obligatoires sont validés.');
