const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const webBuildDir = path.join(rootDir, 'build', 'web-desktop');
const webBuildIndex = path.join(webBuildDir, 'index.html');
const webBuildStyle = path.join(webBuildDir, 'style.css');
const branch = process.env.PAGES_BRANCH || 'master';
const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runQuiet(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf8',
    shell: false,
  });
}

function ensureViewportFit(content) {
  if (content.includes('viewport-fit=cover')) {
    return content;
  }
  return `${content},viewport-fit=cover`;
}

function patchWebBuildForMobile() {
  if (!fs.existsSync(webBuildIndex) || !fs.existsSync(webBuildStyle)) {
    return;
  }

  const indexContent = fs.readFileSync(webBuildIndex, 'utf8');
  let nextIndex = indexContent;

  nextIndex = nextIndex.replace(
    /<meta name="viewport" content="([^"]*)"\s*\/>/,
    (_m, viewport) => `<meta name="viewport" content="${ensureViewportFit(viewport)}"/>`
  );
  nextIndex = nextIndex.replace(/<h1 class="header">[\s\S]*?<\/h1>\s*/m, '');
  nextIndex = nextIndex.replace(/<p class="footer">[\s\S]*?<\/p>\s*/m, '');
  nextIndex = nextIndex.replace(/<div id="GameDiv"[^>]*>/, '<div id="GameDiv" cc_exact_fit_screen="true">');

  if (nextIndex !== indexContent) {
    fs.writeFileSync(webBuildIndex, nextIndex, 'utf8');
    console.log('[pages:publish] patched web index for mobile fullscreen.');
  }

  const styleContent = fs.readFileSync(webBuildStyle, 'utf8');
  const marker = '/* mobile-fullscreen override */';

  if (!styleContent.includes(marker)) {
    const extraCss = `

${marker}
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

body {
  text-align: left;
}

.header, .footer {
  display: none !important;
}

#GameDiv {
  position: fixed;
  inset: 0;
  margin: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

@supports (height: 100dvh) {
  #GameDiv {
    height: 100dvh !important;
  }
}

#Cocos3dGameContainer, #GameCanvas {
  width: 100% !important;
  height: 100% !important;
}
`;

    fs.writeFileSync(webBuildStyle, `${styleContent}${extraCss}`, 'utf8');
    console.log('[pages:publish] patched web style for mobile fullscreen.');
  }
}

if (!fs.existsSync(webBuildIndex)) {
  console.error('[pages:publish] Missing build/web-desktop/index.html');
  console.error('[pages:publish] Please build Web Desktop in Cocos Creator first.');
  process.exit(1);
}

patchWebBuildForMobile();

const filesToAdd = [
  '.github/workflows/deploy-pages.yml',
  '.gitignore',
  'package.json',
  'scripts/publish-pages.js',
  'scripts/serve-web.js',
  'docs/GitHub-Pages一键部署.md',
  'docs/网页试玩说明.md',
  'build/web-desktop',
];

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const message = `chore: publish web build for pages (${now})`;

if (dryRun) {
  const preview = runQuiet('git', ['status', '--porcelain', '--', ...filesToAdd]);
  if (preview.status !== 0) {
    console.error('[pages:publish] Unable to inspect workspace changes.');
    process.exit(1);
  }

  const changedFiles = (preview.stdout || '').trim();
  if (!changedFiles) {
    console.log('[pages:publish] No releasable changes found.');
    process.exit(0);
  }

  console.log('[pages:publish] DRY RUN, files to be committed:');
  console.log(changedFiles);
  console.log(`[pages:publish] commit message: ${message}`);
  console.log(`[pages:publish] push target: origin ${branch}`);
  process.exit(0);
}

run('git', ['add', ...filesToAdd]);

const check = runQuiet('git', ['diff', '--cached', '--name-only', '--', ...filesToAdd]);
if (check.status !== 0) {
  console.error('[pages:publish] Unable to inspect staged changes.');
  process.exit(1);
}

const changedFiles = (check.stdout || '').trim();
if (!changedFiles) {
  console.log('[pages:publish] No staged changes found.');
  process.exit(0);
}

run('git', ['commit', '-m', message, '--', ...filesToAdd]);
run('git', ['push', 'origin', branch]);

console.log(`[pages:publish] Pushed to ${branch}; GitHub Actions will deploy Pages automatically.`);

