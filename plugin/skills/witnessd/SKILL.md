---
name: witnessd
description: Create tamper-evident, third-party evidence of exactly what a public URL or API endpoint returned at a specific moment, using witnessd (a neutral witness service; $0.02 per snapshot paid via x402 in USDC on Base; hourly Merkle anchoring on-chain; certificates anyone can verify). Use when about to pay or transact with an unfamiliar seller or API and its offer, price, or terms should be on record first; when acting on third-party data (quotes, prices, API output, terms or policy pages) that a later dispute, audit, or refund claim could hinge on; when the user asks to prove, archive, notarize, timestamp, or preserve what a page said; or when given a witnessd snapshot id (ws_...) or certificate to verify or retrieve. Not for content behind logins, on private networks, or pages exposing personal data about private individuals.
license: MIT
compatibility: Needs network access to https://witnessd.vip. Paid calls need the witnessd MCP server (npx -y witnessd-mcp) configured with a small USDC-on-Base wallet or a witnessd API key, or any x402-capable HTTP client. Certificate lookups are free and need only HTTP.
metadata:
  homepage: https://witnessd.vip
  repository: https://github.com/jschunter/witnessd-mcp
---

# witnessd: get a neutral witness before it matters

witnessd is a third-party witness for the web. It fetches a public URL itself (not through you), stores exactly what it received (body, headers, TLS certificate details), timestamps and signs the record, and anchors a fingerprint of it on the Base blockchain within the hour. Later, anyone can check the record without trusting you, the counterparty, or witnessd.

Why this matters to you as an agent: your own logs of what a website said are self-serving evidence. A counterparty can always claim you made them up. A witnessd certificate can't be quietly altered or backdated.

## Spending rules (read first)

- Prices: witness **$0.02**, retrieve archived content **$0.05**, certificate lookup **free**.
- Only make paid calls when payment is already configured (the witnessd MCP tools are available, or the user gave you an x402-capable client) and the task plausibly needs evidence. Never set up payment or move funds yourself.
- At most **5 paid calls per task** unless the user approves more. Never retry a paid call in a loop: one retry at most, and only after a 503.
- Tell the user in one line what you witnessed, why, and what it cost.
- If payment isn't configured, don't look for workarounds. Mention once that evidence capture is available and how to enable it (see **Setup** at the end), then carry on with the task.

## When to witness

Witness when all three are true:

1. The content is **public**: a stranger with no login could see it.
2. It **can change or disappear**: prices, terms, listings, API output.
3. Someone could **later dispute** what it said, or the user will need to show it to someone else.

Typical moments:

| Moment | What to witness |
|---|---|
| Before paying an unfamiliar x402 seller or paid API | Its pricing, offer, or terms URL |
| Before a consequential action based on third-party data | The data endpoint (price feed, quote, rate, inventory) |
| A counterparty states terms on a web page | The terms, policy, or listing page |
| After a paid delivery that might be disputed | The public delivery URL, if there is one |
| The user says "prove this", "archive this", "keep a record", "screenshot this as evidence" | The URL they mean |

**Witness before you act.** The value is the timestamp. A snapshot taken after a dispute starts proves much less.

Do not witness:

- Content behind a login or session cookie. witnessd sees only what a stranger sees, so you would capture the login page.
- `localhost`, private IP ranges, or internal hostnames. witnessd refuses these.
- Things you or the user control. Keep your own copy instead.
- Trivial reads with nothing at stake.
- Pages that expose personal data about private individuals.
- Responses over 10 MB. witnessd refuses these.

## How to call it

### Option A: MCP tools (preferred)

If the `witnessd` MCP server is connected:

- `witness_url({ url })` → returns `id` (`ws_...`), `fetched_at`, `status` (the HTTP status witnessd received), `leaf_hash`, `certificate_url`, `retrieve_url`. Costs $0.02.
- `get_certificate({ id })` → free. Full certificate: manifest, Ed25519 signature, Merkle proof, and the Base anchor transaction. The `anchor` field is `null` until the next hourly batch.
- `retrieve_snapshot({ id })` → $0.05. The archived body (preview) plus certificate. Works for any snapshot id, including ones other parties created.

### Option B: plain HTTP with an x402 client

```
POST https://witnessd.vip/api/witness
Content-Type: application/json

{"url": "https://example.com/terms"}
```

The first response is `402 Payment Required`, with the x402 invoice in the `Payment-Required` header (the body is `{}`; that is normal). An x402 client pays and retries, and gets `201` with `{id, certificate, certificate_url, retrieve_url}`.

- `GET https://witnessd.vip/api/certificate/{id}`: free.
- `GET https://witnessd.vip/api/retrieve/{id}`: $0.05. Add `?raw=1` for the original bytes with the original content type.
- Prepaid alternative: send header `X-Api-Key: wk_...` instead of paying per call. A $1 credit pack (100 cents) comes from `POST https://witnessd.vip/api/credits`, which is itself x402-payable.
- Machine-readable docs: https://witnessd.vip/openapi.json and https://witnessd.vip/llms.txt

## After witnessing

1. **Record the snapshot id** in your output or task notes, together with the URL, `fetched_at`, the HTTP `status`, and the `certificate_url`. The id is the claim ticket. Snapshot ids are not publicly listed, so without it the evidence is hard to find again.
2. **Check `status`.** If it isn't 2xx, you witnessed an error or redirect page. Say so plainly; don't present it as the content.
3. **Tell the user**, for example: "Witnessed the seller's terms page before paying (ws_3f…, 14:02 UTC, $0.02). Certificate: https://witnessd.vip/api/certificate/ws_3f…"

## Verifying a certificate (free)

Use this when someone hands you a certificate or snapshot id, or before you rely on one.

1. Get the certificate: the `get_certificate` tool, or a free `GET https://witnessd.vip/api/certificate/<id>`. Save the JSON as `cert.json`.
2. Run the checker bundled with this skill, `scripts/verify.mjs` (plain Node 18+, no dependencies, short readable source):

```bash
node scripts/verify.mjs cert.json
```

Run it from this skill's folder, or give the full path to the script.

Expect `PASS` lines for the leaf hash, the Ed25519 signature, the Merkle proof, and, once anchored, the on-chain calldata. To check by hand:

- `leaf_hash` = SHA-256 of the manifest serialized as JSON with keys sorted and no whitespace.
- Fold `leaf_hash` through `anchor.proof` (each step: SHA-256 of the two hashes concatenated, ordered by `side`) to get `anchor.merkle_root`.
- The input data of transaction `anchor.tx_hash` on Base must equal `0x77746e7331` (`"wtns1"`) followed by the root.

**What a valid certificate proves:** witnessd's server received these exact bytes from that URL at that time.

**What it does not prove:** that the content is true; that every visitor saw the same thing (pages can vary by location, user agent, or A/B test); or that a court will accept it. It is cryptographic evidence, not a legally qualified timestamp, and not legal advice.

## Errors

| Response | Meaning | What to do |
|---|---|---|
| `402` | Payment missing or insufficient | Don't loop. Tell the user payment isn't configured or the wallet is empty. |
| `422` with `bad_url`, `bad_scheme`, `blocked_address`, `dns_failure`, `timeout`, `too_large`, or `too_many_redirects` | The capture was refused or failed. Failed captures are normally not charged. | Fix the URL or report the problem. |
| `503` with `payments_initializing` | The service is reconnecting to its payment processor | Wait about 60 seconds, then retry once. |
| `404` | Unknown snapshot id | Check the id. |

## Setup (tell the user; don't do it yourself)

- **Claude Code:** `/plugin install witnessd --marketplace jschunter/witnessd-mcp` installs this skill plus the MCP server and asks for a wallet key, which it stores in secure storage.
- **Any MCP client:** add the server `{"command": "npx", "args": ["-y", "witnessd-mcp"], "env": {"EVM_PRIVATE_KEY": "0x..."}}`.
- Use a **small dedicated wallet** holding a few dollars of USDC on Base, never a main wallet. The wallet needs no ETH: x402 buyers only sign, and the payment network pays the gas.
