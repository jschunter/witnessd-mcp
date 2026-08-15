#!/usr/bin/env node
// witnessd MCP server. Env:
//   WITNESSD_URL       base URL of the witnessd service (default: https://witnessd.vip)
//   WITNESSD_API_KEY   prepaid credit key  (one payment door)
//   EVM_PRIVATE_KEY    0x… wallet key for x402 auto-pay in USDC (the other door)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.WITNESSD_URL || 'https://witnessd.vip').replace(/\/$/, '');
const API_KEY = process.env.WITNESSD_API_KEY || '';
const PK = process.env.EVM_PRIVATE_KEY || '';

let fetchFn = fetch;
if (!API_KEY && PK) {
  const { wrapFetchWithPaymentFromConfig } = await import('@x402/fetch');
  const { ExactEvmScheme } = await import('@x402/evm');
  const { privateKeyToAccount } = await import('viem/accounts');
  fetchFn = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: 'eip155:*', client: new ExactEvmScheme(privateKeyToAccount(PK)) }],
  });
}
const headers = () => (API_KEY ? { 'x-api-key': API_KEY, 'content-type': 'application/json' } : { 'content-type': 'application/json' });

async function call(method, path, body) {
  const res = await fetchFn(`${BASE}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok && res.status !== 201) throw new Error(`witnessd ${res.status}: ${text.slice(0, 500)}`);
  return data;
}

const server = new McpServer({ name: 'witnessd', version: '0.1.1' });

server.tool(
  'witness_url',
  'Have witnessd — a neutral third party — independently fetch a URL or API endpoint right now, hash and timestamp the response, archive it, and return a signed certificate. The snapshot is Merkle-anchored on Base within the hour. Use before/after transacting with a counterparty to create dispute evidence of what their endpoint said.',
  { url: z.string().url().describe('The http(s) URL or API endpoint to witness') },
  async ({ url }) => {
    const r = await call('POST', '/api/witness', { url });
    return { content: [{ type: 'text', text: JSON.stringify({ id: r.id, certificate_url: r.certificate_url, retrieve_url: r.retrieve_url, leaf_hash: r.certificate?.leaf_hash, fetched_at: r.certificate?.manifest?.fetched_at, status: r.certificate?.manifest?.status }, null, 2) }] };
  }
);

server.tool(
  'get_certificate',
  'Fetch the (free) signed certificate for a witnessd snapshot id, including the Merkle inclusion proof and Base anchor transaction once batched. Anyone can verify it independently.',
  { id: z.string().describe('witnessd snapshot id, e.g. ws_ab12…') },
  async ({ id }) => {
    const r = await call('GET', `/api/certificate/${encodeURIComponent(id)}`);
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  }
);

server.tool(
  'retrieve_snapshot',
  'Retrieve the archived response body (base64) plus certificate for a witnessd snapshot id. Paid endpoint; works for any snapshot id, including ones witnessed by other parties — this is how you obtain evidence of what an endpoint said at a past moment.',
  { id: z.string().describe('witnessd snapshot id') },
  async ({ id }) => {
    const r = await call('GET', `/api/retrieve/${encodeURIComponent(id)}`);
    const body = Buffer.from(r.body_base64 || '', 'base64');
    const preview = body.slice(0, 4000).toString('utf8');
    return { content: [{ type: 'text', text: JSON.stringify({ certificate: r.certificate, body_bytes: body.length, body_preview: preview }, null, 2) }] };
  }
);

await server.connect(new StdioServerTransport());
