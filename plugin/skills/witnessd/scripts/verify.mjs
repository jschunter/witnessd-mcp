#!/usr/bin/env node
// Standalone certificate verifier — no trust in witnessd required.
// Usage: node scripts/verify.mjs certificate.json [--rpc https://mainnet.base.org]
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
if (!file) { console.error('Usage: node scripts/verify.mjs certificate.json [--rpc URL]'); process.exit(2); }
const rpcIdx = process.argv.indexOf('--rpc');
const RPC = rpcIdx > -1 ? process.argv[rpcIdx + 1] : 'https://mainnet.base.org';
const cert = JSON.parse(fs.readFileSync(file, 'utf8'));
let ok = true;
const say = (label, pass, extra = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`); if (!pass) ok = false; };

// 1. leaf hash
const recomputed = sha256(Buffer.from(canonicalize(cert.manifest))).toString('hex');
say('leaf_hash = sha256(canonical(manifest))', recomputed === cert.leaf_hash);

// 2. signature
try {
  const key = createPublicKey({ key: Buffer.from(cert.manifest.witness.pubkey_spki_b64, 'base64'), format: 'der', type: 'spki' });
  const sigOk = edVerify(null, Buffer.from(cert.leaf_hash, 'hex'), key, Buffer.from(cert.signature_ed25519_b64, 'base64'));
  say('ed25519 signature over leaf_hash', sigOk);
} catch (e) { say('ed25519 signature over leaf_hash', false, e.message); }

// 3. merkle proof
if (cert.anchor?.proof) {
  let cur = Buffer.from(cert.leaf_hash, 'hex');
  for (const s of cert.anchor.proof) {
    const sib = Buffer.from(s.hash, 'hex');
    cur = s.side === 'right' ? sha256(Buffer.concat([cur, sib])) : sha256(Buffer.concat([sib, cur]));
  }
  say('merkle proof folds to anchor.merkle_root', cur.toString('hex') === cert.anchor.merkle_root);

  // 4. on-chain root
  if (cert.anchor.tx_hash && cert.anchor.mode === 'live') {
    const res = await fetch(RPC, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [cert.anchor.tx_hash] }),
    }).then((r) => r.json()).catch((e) => ({ error: e.message }));
    const input = res?.result?.input;
    if (!input) say('on-chain anchor transaction found', false, JSON.stringify(res?.error || 'tx not found'));
    else {
      const expected = '0x' + '77746e7331' + cert.anchor.merkle_root; // "wtns1" + root
      say('tx calldata contains merkle_root', input.toLowerCase() === expected.toLowerCase(), `tx ${cert.anchor.tx_hash}`);
    }
  } else {
    console.log(`NOTE  anchor mode is "${cert.anchor.mode}" — no on-chain check (dry-run or unanchored batch).`);
  }
} else {
  console.log('NOTE  certificate not yet batched — request it again after the next hourly anchor.');
}

console.log(ok ? '\nCertificate VERIFIED (within limits noted above).' : '\nCertificate FAILED verification.');
process.exit(ok ? 0 : 1);
