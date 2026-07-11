'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const rows = [];
const functionRegex = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm;

for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.js')).sort()) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  let match;
  while ((match = functionRegex.exec(text)) !== null) {
    if (/SmokeTest/i.test(match[1])) rows.push({ functionName: match[1], file });
  }
}

const lines = [
  '# Smoke-Test Source Inventory',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '| Function | Source file |',
  '|---|---|',
  ...rows.map((row) => `| \`${row.functionName}\` | \`${row.file}\` |`),
  '',
  `Total smoke-test entry points: **${rows.length}**`,
  '',
  '> This inventory confirms source presence only. Execute release-critical smoke tests inside Google Apps Script and record the results separately.'
];

fs.writeFileSync(path.join(artifactDir, 'smoke-test-summary.md'), lines.join('\n') + '\n');
console.log(`Generated artifacts/smoke-test-summary.md with ${rows.length} entries.`);
