// Local sanity checks for the SHA-256 helpers in src/utils/auth.js.
//
// The pure-JS SHA-256 only runs when crypto.subtle is unavailable, which is the
// case on insecure origins such as plain-http Pages hosting. If the two paths
// disagree, a password set on one origin could never be verified on the other,
// so both are checked against Node's crypto here.
//
//   node scripts/test_password_hashing.mjs

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authSource = readFileSync(path.join(__dirname, '..', 'src', 'utils', 'auth.js'), 'utf8');

// Pull the two implementations out of the module without importing it, since it
// touches localStorage and imports the Neon driver.
function extract(name) {
  const marker = `function ${name}(`;
  const fnStart = authSource.indexOf(marker);
  if (fnStart === -1) throw new Error(`Could not find ${name} in auth.js`);

  // Include a preceding `async ` so the extracted source stays valid on its own.
  const before = authSource.slice(Math.max(0, fnStart - 6), fnStart);
  const start = before.endsWith('async ') ? fnStart - 6 : fnStart;

  let depth = 0;
  let started = false;
  for (let i = start; i < authSource.length; i++) {
    const ch = authSource[i];
    if (ch === '{') {
      depth++;
      started = true;
    } else if (ch === '}') {
      depth--;
      if (started && depth === 0) {
        return authSource.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unbalanced braces in ${name}`);
}

const webcryptoImpl = extract('sha256Hex');
const fallbackImpl = extract('sha256HexFallback');
const hashImpl = extract('hashPassword');
const saltImpl = extract('generateSalt');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Fail loudly if an extraction ever produces something unparseable, rather than
// surfacing as a confusing "not a function" further down.
for (const [label, impl] of [
  ['sha256Hex', webcryptoImpl],
  ['sha256HexFallback', fallbackImpl],
  ['hashPassword', hashImpl],
  ['generateSalt', saltImpl]
]) {
  if (!impl.trim().startsWith('function') && !impl.trim().startsWith('async function')) {
    console.error(`Extraction of ${label} produced no function declaration.`);
    process.exit(1);
  }
}

// eslint-disable-next-line no-new-func
const fallback = new Function(`${fallbackImpl}; return sha256HexFallback;`)();

// The async function constructor returns a promise when invoked, so await it to
// get at the assembled function itself. HASH_ALGO is a module constant in
// auth.js, so it has to be supplied alongside.
const viaWebCrypto = await new AsyncFunction(
  'crypto',
  'HASH_ALGO',
  `${webcryptoImpl}; return sha256Hex;`
)(globalThis.crypto, 'SHA-256');

// The public helpers, assembled the same way so the salted form is exercised
// through the real code path rather than a reconstruction of it.
// eslint-disable-next-line no-new-func
const generateSalt = new Function('crypto', `${saltImpl}; return generateSalt;`)(globalThis.crypto);
const hashPassword = await new AsyncFunction(
  'crypto',
  'sha256Hex',
  `${hashImpl}; return hashPassword;`
)(globalThis.crypto, viaWebCrypto);

// Edge cases that historically break hand-rolled SHA-256 implementations:
// block boundaries, multi-byte input, and the empty string.
const cases = [
  'Techfest@2026',
  'techfest@123',
  'sliet@2026',
  'Paisa@123',
  'a',
  'correct horse battery staple',
  'unicode: ₹599 • SLIET — café',
  'é'.repeat(200),
  'x'.repeat(55), // one byte short of padding to a second block
  'x'.repeat(56), // exact block boundary
  'x'.repeat(64), // exact two blocks
  'x'.repeat(1000),
  ''
];

let failures = 0;
let checked = 0;

for (const message of cases) {
  const expected = createHash('sha256').update(message, 'utf8').digest('hex');
  const fromFallback = fallback(message);
  const fromWebCrypto = await viaWebCrypto(message);
  checked++;

  if (fromFallback !== expected) {
    console.error(`FAIL fallback  ${JSON.stringify(message.slice(0, 30))}`);
    console.error(`  expected ${expected}`);
    console.error(`  actual   ${fromFallback}`);
    failures++;
  }

  if (fromWebCrypto !== expected) {
    console.error(`FAIL webcrypto ${JSON.stringify(message.slice(0, 30))}`);
    console.error(`  expected ${expected}`);
    console.error(`  actual   ${fromWebCrypto}`);
    failures++;
  }
}

// The public helper must apply the salt: hashPassword('secret', salt) has to
// differ from the bare SHA-256 of 'secret'.
const salt = 'abc123';
const bare = await viaWebCrypto('secret');
const salted = await hashPassword('secret', salt);
checked++;
if (bare === salted) {
  console.error('FAIL salt is not being applied by hashPassword');
  failures++;
}

// The same salt and password must always produce the same digest, or a user
// could never sign in twice.
checked++;
const repeat = await hashPassword('secret', salt);
if (repeat !== salted) {
  console.error('FAIL hashPassword is not deterministic for a fixed salt');
  failures++;
}

// Two users with the same password must not share a digest.
checked++;
const otherSalt = generateSalt();
const otherHash = await hashPassword('secret', otherSalt);
if (otherSalt === salt) {
  console.error('FAIL generateSalt produced a repeated value');
  failures++;
}
if (otherHash === salted) {
  console.error('FAIL distinct salts produced the same digest');
  failures++;
}

// The real code prefers WebCrypto and only falls back when crypto.subtle is
// missing, so verify the fallback path is actually reachable and correct.
const expectedFor2026 = createHash('sha256').update('Techfest@2026', 'utf8').digest('hex');

const fromWebcryptoOnly = await viaWebCrypto('Techfest@2026');
if (fromWebcryptoOnly !== expectedFor2026) {
  console.error('FAIL WebCrypto path produced the wrong digest');
  failures++;
}

// With no subtle API the fallback must take over and still be correct.
const noSubtleCrypto = {
  getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto)
};
const noSubtle = await new AsyncFunction(
  'crypto',
  'HASH_ALGO',
  `${webcryptoImpl}; ${fallbackImpl}; return sha256Hex;`
)(noSubtleCrypto, 'SHA-256');
const fromNoSubtle = await noSubtle('Techfest@2026');
if (fromNoSubtle !== expectedFor2026) {
  console.error('FAIL fallback path disagrees with the WebCrypto path');
  console.error(`  webcrypto ${fromWebcryptoOnly}`);
  console.error(`  fallback  ${fromNoSubtle}`);
  failures++;
}
checked += 2;

if (failures > 0) {
  console.error(`\n${failures} of ${checked} checks failed.`);
  process.exit(1);
}

console.log(`All ${checked} hashing checks passed.`);