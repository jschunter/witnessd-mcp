// Offline checker for a witnessd snapshot record. Makes NO network calls.
// Usage: node scripts/verify.mjs witness.json
//   witness.json = the JSON returned by get_certificate or GET /api/certificate/<id>
// Checks the leaf hash, the Ed25519 signature and the Merkle proof locally, then
// prints the Base transaction and the exact input data it must contain, so the
// on-chain step can be checked on any Base block explorer or node.
import fs from 'node:fs';
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';

function canonicalize(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => canonicalize(x === undefined ? null : x)).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
}
const sha256 = (b) => createHash('sha256').update(b).digest();

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/verify.mjs witness.json'); process.exit(2); }
const record = JSON.parse(fs.readFileSync(file, 'utf8'));
let ok = true;
const say = (label, pass, extra = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' - ' + extra : ''}`); if (!pass) ok = false; };

// 1. leaf hash
const recomputed = sha256(Buffer.from(canonicalize(record.manifest))).toString('hex');
say('leaf_hash = sha256(canonical(manifest))', recomputed === record.leaf_hash);

// 2. signature
try {
  const pub = createPublicKey({ key: Buffer.from(record.manifest.witness.pubkey_spki_b64, 'base64'), format: 'der', type: 'spki' });
  say('ed25519 signature over leaf_hash', edVerify(null, Buffer.from(record.leaf_hash, 'hex'), pub, Buffer.from(record.signature_ed25519_b64, 'base64')));
} catch (e) { say('ed25519 signature over leaf_hash', false, e.message); }

// 3. merkle proof, then what to look up on-chain
if (record.anchor?.proof) {
  let cur = Buffer.from(record.leaf_hash, 'hex');
  for (const s of record.anchor.proof) {
    const sib = Buffer.from(s.hash, 'hex');
    cur = s.side === 'right' ? sha256(Buffer.concat([cur, sib])) : sha256(Buffer.concat([sib, cur]));
  }
  say('merkle proof folds to anchor.merkle_root', cur.toString('hex') === record.anchor.merkle_root);
  if (record.anchor.tx_hash && record.anchor.mode === 'live') {
    console.log(`\nON-CHAIN STEP (do it on any Base explorer or node):`);
    console.log(`  transaction: ${record.anchor.tx_hash} (Base mainnet)`);
    console.log(`  its input data must equal: 0x77746e7331${record.anchor.merkle_root}`);
  } else {
    console.log(`NOTE  anchor mode is "${record.anchor.mode}" - nothing to check on-chain.`);
  }
} else {
  console.log('NOTE  not yet batched - fetch the record again after the next hourly anchor.');
}

console.log(ok ? '\nLocal checks PASSED.' : '\nLocal checks FAILED.');
process.exit(ok ? 0 : 1);
