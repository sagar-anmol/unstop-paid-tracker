// Guards against shipping credentials to the browser.
//
// Anything matching these patterns in the built bundle is a leak: a database
// password, an admin API key, or the data.json payload being inlined into JS.
//
//   node scripts/check_bundle.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');

const FORBIDDEN = [
  { label: 'Neon database password', pattern: /npg_[A-Za-z0-9]{8,}/ },
  { label: 'postgres connection string', pattern: /postgres(ql)?:\/\/[^\s"']*neon\.tech/ },
  { label: 'techfest26 admin api key', pattern: /fest26_super_secret|ADMIN_API_KEY\s*[:=]\s*['"][A-Za-z0-9_]{16,}/ },
  { label: 'techfest26 bearer token', pattern: /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/ },
  { label: 'Unstop token', pattern: /UNSTOP_TOKEN\s*[:=]\s*['"][A-Za-z0-9._-]{24,}/ }
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(ASSETS_DIR);
} catch {
  console.error('No assets/ directory found. Run the build first.');
  process.exit(1);
}

const problems = [];
let totalBytes = 0;

for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  totalBytes += contents.length;

  for (const { label, pattern } of FORBIDDEN) {
    const match = contents.match(pattern);
    if (match) {
      problems.push({
        file: path.relative(ROOT, file),
        label,
        sample: match[0].slice(0, 24)
      });
    }
  }
}

const megabytes = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`Scanned ${files.length} bundled file(s), ${megabytes} MB.`);

if (problems.length > 0) {
  console.error('\nCredential leak detected in the bundle:');
  for (const p of problems) {
    console.error(`  ${p.file}: ${p.label} (matched "${p.sample}...")`);
  }
  console.error('\nMove the value to a GitHub Actions secret or an env var read at runtime.');
  process.exit(1);
}

console.log('No credentials found in the bundle.');