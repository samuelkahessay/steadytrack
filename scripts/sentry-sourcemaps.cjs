const { execSync } = require('child_process');

const actor = process.env.GITHUB_ACTOR;
const isDependabot = actor === 'dependabot[bot]' || actor === 'dependabot-preview[bot]';
if (isDependabot) {
  console.log('Skipping Sentry sourcemap upload for Dependabot PR');
  process.exit(0);
}

const token = (process.env.SENTRY_AUTH_TOKEN || '').trim();
if (!token) {
  console.log('Skipping Sentry sourcemap upload (no auth token)');
  process.exit(0);
}

const org = process.env.SENTRY_ORG;
const project = process.env.SENTRY_PROJECT;
if (!org || !project) {
  console.log('Skipping Sentry sourcemap upload (SENTRY_ORG or SENTRY_PROJECT not set)');
  process.exit(0);
}

try {
  const env = { ...process.env, SENTRY_AUTH_TOKEN: token };
  // Use local binary on PATH provided by npm scripts
  execSync(
    `sentry-cli sourcemaps inject --org ${org} --project ${project} .next`,
    { stdio: 'inherit', env }
  );
  execSync(
    `sentry-cli sourcemaps upload --org ${org} --project ${project} .next`,
    { stdio: 'inherit', env }
  );
} catch (err) {
  console.error('Sentry sourcemap upload failed');
  // Preserve underlying exit code if present
  process.exit(typeof err?.status === 'number' ? err.status : 1);
}
