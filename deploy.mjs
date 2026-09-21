import fs from 'fs';
import path from 'path';

let TOKEN = process.env.GITHUB_TOKEN;
let REPO = process.env.GITHUB_REPO || 'nikitakoncik34-stack/FinKaif-7';
const BASE = path.resolve('.');

// Load from .env if present
const envPath = path.join(BASE, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      const val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'GITHUB_TOKEN') TOKEN = val;
      if (key === 'GITHUB_REPO') REPO = val;
    }
  }
}
if (!TOKEN) {
  console.error('❌ GITHUB_TOKEN is missing. Add it to .env or the environment.');
  process.exit(1);
}

const filesToDeploy = [
  { path: 'public/style.css', msg: 'style(ui): update styles' },
  { path: 'public/app.js', msg: 'feat(ui): update application logic' },
  { path: 'public/index.html', msg: 'chore(release): bump cache-busting version' },
  { path: 'package.json', msg: 'chore: update package.json' },
  { path: 'db/schema.sql', msg: 'feat(auth): add two-factor authentication schema' },
  { path: '.env.example', msg: 'docs(auth): document 2FA encryption key' },
  { path: 'server.js', msg: 'fix(server): update backend' },
  { path: 'tests/statements.test.mjs', msg: 'test(import): add statement regression coverage' },
  { path: 'deploy.mjs', msg: 'chore(deploy): include statement tests' }
];

async function getGitHubFile(relPath) {
  const url = `https://api.github.com/repos/${REPO}/contents/${relPath}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'Antigravity-Deploy' }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub could not read ${relPath} (HTTP ${r.status}). Check GITHUB_TOKEN and GITHUB_REPO.`);
  return await r.json();
}

async function pushFile(relPath, commitMsg) {
  const fullLocal = path.join(BASE, relPath);
  if (!fs.existsSync(fullLocal)) {
    console.log(`⚠️ Local file not found: ${relPath}`);
    return null;
  }
  const contentBuf = fs.readFileSync(fullLocal);
  const b64 = contentBuf.toString('base64');

  const remote = await getGitHubFile(relPath);
  const sha = remote ? remote.sha : undefined;

  // Check if content is actually different
  if (remote && remote.content) {
    const remoteNorm = remote.content.replace(/\s+/g, '');
    const localNorm = b64.replace(/\s+/g, '');
    if (remoteNorm === localNorm) {
      console.log(`⏩ ${relPath} is already up to date on GitHub.`);
      return remote.sha;
    }
  }

  const url = `https://api.github.com/repos/${REPO}/contents/${relPath}`;
  const body = {
    message: commitMsg,
    content: b64,
    branch: 'main'
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Antigravity-Deploy'
    },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`✅ Pushed ${relPath}: commit ${data.commit.sha.slice(0, 7)}`);
    return data.commit.sha;
  } else {
    throw new Error(`GitHub could not push ${relPath} (HTTP ${res.status}). Check token permissions and the main branch.`);
  }
}

async function main() {
  console.log('🚀 Deploying FinKaif authentication and 2FA update to GitHub...');
  for (const item of filesToDeploy) {
    await pushFile(item.path, item.msg);
  }
  console.log('🎉 Push complete. Checking Railway deployment trigger...');
}

main().catch(error => {
  console.error(`❌ Deployment failed: ${error.message}`);
  process.exitCode = 1;
});
