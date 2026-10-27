# witnessd-mcp

**MCP server for [witnessd](https://witnessd.vip) — a neutral third-party witness for the machine-readable web.**

Give your agent the ability to create tamper-evident evidence: witnessd independently fetches any public URL or API endpoint, hashes and timestamps the response, archives it, and issues a signed certificate. Snapshot hashes are Merkle-batched hourly and anchored on Base, so certificates verify forever — by anyone, without trusting the operator.

Use it before transacting with a counterparty ("witness their published price/terms"), before acting on third-party data ("witness what the API returned"), or whenever a dispute might later hinge on *what a URL said at a moment in time*.

## Quick install

| You use | Run this |
|---|---|
| **Claude Code** (skill + MCP server in one step) | `/plugin install witnessd --marketplace jschunter/witnessd-mcp` |
| **Any agent with Agent Skills** (Cursor, Codex, Copilot, Gemini CLI and others) | `npx skills add jschunter/witnessd-mcp` |
| **Any MCP client**, MCP server only | `npx -y witnessd-mcp` (config below) |

The **skill** ([`plugin/skills/witnessd/SKILL.md`](plugin/skills/witnessd/SKILL.md)) teaches an agent *when* a neutral witness is worth two cents: before paying an unfamiliar seller, before acting on third-party data, or when asked to prove what a page said. It also sets spending rules: at most 5 paid calls per task without approval, a one-line report of each call, and no paid retries in a loop. The **MCP server** gives the agent the tools.

On older Claude Code versions, run `/plugin marketplace add jschunter/witnessd-mcp` and then `/plugin install witnessd@witnessd`.

## Tools

| Tool | Price | What it does |
|---|---|---|
| `witness_url` | $0.02 | Independent fetch + hash + timestamp + archive of a URL right now; returns snapshot id + signed certificate |
| `get_certificate` | free | Certificate for any snapshot id: manifest, Ed25519 signature, Merkle proof, Base anchor transaction |
| `retrieve_snapshot` | $0.05 | The archived response body + certificate — works for any snapshot id, any payer (this is how third parties obtain evidence) |

## Install

```bash
npx -y witnessd-mcp
```

Claude Desktop / Cursor config:

```json
{
  "mcpServers": {
    "witnessd": {
      "command": "npx",
      "args": ["-y", "witnessd-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x…"
      }
    }
  }
}
```

## Payment — two options

Set **one** of these environment variables:

- `EVM_PRIVATE_KEY` — a wallet key holding USDC on Base. The server auto-pays each call via [x402](https://x402.org) (the buyer only signs; no ETH needed for gas). Use a small dedicated wallet, never your main one.
- `WITNESSD_API_KEY` — a prepaid credit key (buy a $1 pack via `POST https://witnessd.vip/api/credits`, x402-payable).

Optional: `WITNESSD_URL` to point at a different witnessd instance (default `https://witnessd.vip`).

## Verify without trusting us

Certificates are self-verifying: `leaf_hash = sha256(canonical-json(manifest))`, Ed25519-signed, Merkle-proven into an hourly batch root anchored on Base (calldata `0x` + `wtns1` + root). Standalone checker: [witnessd.vip/verify.js](https://witnessd.vip/verify.js).

## Privacy & scope

Certificates (hashes, timestamps, proofs) are public; archived content is delivered only to paying requesters and never republished. witnessd only witnesses what any stranger can see — no logins, no private networks, bodies ≤10 MB. Machine-readable service docs: [llms.txt](https://witnessd.vip/llms.txt) · [openapi.json](https://witnessd.vip/openapi.json) · [/.well-known/x402](https://witnessd.vip/.well-known/x402).

MIT license.
