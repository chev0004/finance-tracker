#!/usr/bin/env bun
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const projectName = process.argv[2]?.trim();
if (!projectName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
  console.error(
    'Usage: bun run init <project-name>\n\nProject name must be lowercase with hyphens (e.g. new-website)',
  );
  process.exit(1);
}

const displayName = projectName
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

if (existsSync(join(root, '.git'))) {
  rmSync(join(root, '.git'), { recursive: true });
}
execSync('git init', { cwd: root, stdio: 'inherit' });

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as Record<
  string,
  unknown
>;
pkg.name = projectName;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2));

const readmePath = join(root, 'README.md');
let readme = await readFile(readmePath, 'utf-8');
readme = readme.replace(/^# Next\.js Template by chev\n/, `# ${displayName}\n`);
readme = readme.replace(
  /A modern Next\.js template with/,
  'A modern Next.js project with',
);
await writeFile(readmePath, readme);

const layoutPath = join(root, 'src/app/layout.tsx');
let layout = await readFile(layoutPath, 'utf-8');
layout = layout.replace(
  /title: 'Next\.js Template'/,
  `title: '${displayName}'`,
);
layout = layout.replace(
  /description: 'A Next\.js template project'/,
  `description: '${displayName}'`,
);
await writeFile(layoutPath, layout);

execSync('git checkout -b develop', { cwd: root, stdio: 'inherit' });
execSync('git add -A', { cwd: root, stdio: 'inherit' });
execSync('git commit -m "Initial commit"', { cwd: root, stdio: 'inherit' });

console.log(
  `\nInitialized "${displayName}" (${projectName}) with fresh git history.`,
);
console.log('Run `bun install` then `bun dev` to start.\n');
