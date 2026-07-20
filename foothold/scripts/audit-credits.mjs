import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetsDir = path.join(root, 'assets');
const creditsPath = path.join(assetsDir, 'CREDITS.md');

function enumerateFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return enumerateFiles(fullPath);
    }

    return path.resolve(fullPath) === path.resolve(creditsPath)
      ? []
      : [fullPath];
  });
}

function filenameFragments(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  // Insert boundaries before camelCase capitals, then split on punctuation.
  const segments = basename
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\-\s]+/)
    .filter((segment) => segment.length >= 2);

  return [basename, ...segments]
    .map((fragment) => fragment.toLowerCase())
    .filter((fragment, index, all) => all.indexOf(fragment) === index);
}

if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
  console.error('ERROR: assets/ was not found. Run this script from the Foothold directory.');
  process.exit(1);
}

if (!fs.existsSync(creditsPath)) {
  console.error('ERROR: assets/CREDITS.md was not found.');
  process.exit(1);
}

const credits = fs.readFileSync(creditsPath, 'utf8').toLowerCase();
const results = enumerateFiles(assetsDir)
  .sort((a, b) => a.localeCompare(b))
  .map((filePath) => {
    const referenced = filenameFragments(filePath).some((fragment) =>
      credits.includes(fragment),
    );

    return {
      asset: path.relative(root, filePath).split(path.sep).join('/'),
      referenced,
    };
  });

const failed = results.some(({ referenced }) => !referenced);
const assetWidth = Math.max('Asset'.length, ...results.map(({ asset }) => asset.length));

console.log(`CREDITS AUDIT: ${failed ? 'FAIL' : 'PASS'}`);
console.log('');
console.log(`| ${'Asset'.padEnd(assetWidth)} | Status          |`);
console.log(`|-${'-'.repeat(assetWidth)}-|-----------------|`);

for (const { asset, referenced } of results) {
  const status = referenced ? '✓ referenced' : '⚠ NOT FOUND';
  console.log(`| ${asset.padEnd(assetWidth)} | ${status.padEnd(15)} |`);
}

console.log('');
console.log(
  'Note: "referenced" only proves that a filename fragment appears somewhere in CREDITS.md.',
);
console.log(
  'It does not verify that a license is present, correct, or permits commercial use.',
);
console.log(
  'Final license-permission judgment - including CC BY-NC, unknown, or missing licenses - still requires a human/LLM review of the matched section.',
);

process.exitCode = failed ? 1 : 0;
