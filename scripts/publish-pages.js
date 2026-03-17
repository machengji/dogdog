const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const webBuildIndex = path.join(rootDir, 'build', 'web-desktop', 'index.html');
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

if (!fs.existsSync(webBuildIndex)) {
  console.error('[pages:publish] 未找到 build/web-desktop/index.html');
  console.error('[pages:publish] 请先在 Cocos Creator 中构建 Web Desktop。');
  process.exit(1);
}

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
    console.error('[pages:publish] 无法检查工作区变更。');
    process.exit(1);
  }

  const changedFiles = (preview.stdout || '').trim();
  if (!changedFiles) {
    console.log('[pages:publish] 没有可发布的变更，已跳过。');
    process.exit(0);
  }

  console.log('[pages:publish] DRY RUN 模式，以下文件将被提交:');
  console.log(changedFiles);
  console.log(`[pages:publish] commit message: ${message}`);
  console.log(`[pages:publish] push target: origin ${branch}`);
  process.exit(0);
}

run('git', ['add', ...filesToAdd]);

const check = runQuiet('git', ['diff', '--cached', '--name-only', '--', ...filesToAdd]);
if (check.status !== 0) {
  console.error('[pages:publish] 无法检查暂存区变更。');
  process.exit(1);
}

const changedFiles = (check.stdout || '').trim();
if (!changedFiles) {
  console.log('[pages:publish] 没有可提交的变更，已跳过。');
  process.exit(0);
}

run('git', ['commit', '-m', message, '--', ...filesToAdd]);
run('git', ['push', 'origin', branch]);

console.log(`[pages:publish] 已推送到 ${branch}，GitHub Actions 将自动部署 Pages。`);
