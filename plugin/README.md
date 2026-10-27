# witnessd plugin

Installs two things into Claude Code:

- **The `witnessd` skill** (`skills/witnessd/SKILL.md`): tells Claude *when* it's worth getting a neutral witness. Typical cases: before paying an unfamiliar seller, before acting on third-party data, or when you ask it to prove what a page said. It also sets spending rules: at most 5 paid calls per task without your approval, and a one-line report of each call.
- **The witnessd MCP server** (`npx -y witnessd-mcp@0.1.1`, source in this repository) with three tools: `witness_url` ($0.02), `get_certificate` (free), and `retrieve_snapshot` ($0.05).

## Install

```
/plugin install witnessd --marketplace jschunter/witnessd-mcp
```

On older Claude Code versions, add the marketplace first:

```
/plugin marketplace add jschunter/witnessd-mcp
/plugin install witnessd@witnessd
```

You'll be asked for a wallet key, or a witnessd API key as an alternative. Both are stored in secure storage. Use a small dedicated wallet with a few dollars of USDC on Base; it needs no ETH. If you leave both empty, only free certificate lookups work.

## What it runs, sends and stores

- **Runs:** the npm package `witnessd-mcp` version 0.1.1, started with `npx` on your machine. The skill also includes `scripts/verify.mjs`, an offline checker that reads a snapshot record you give it and makes no network calls.
- **Sends:** only to https://witnessd.vip. When Claude uses a tool, the server sends the URL to witness, or the snapshot id to look up. witnessd then fetches that public URL from its own server.
- **Payments:** each paid call is signed on your machine with your wallet key and sent to witnessd.vip, which settles it in USDC on Base through the x402 payment facilitator. Your private key never leaves your machine. If you use an API key instead, it is sent to witnessd.vip with each call.
- **Stores:** the plugin keeps only your two optional settings, in Claude Code's secure storage. witnessd keeps the content it fetched for each snapshot and publishes the certificate (hash, timestamp, signature, Merkle proof, Base transaction). Certificates are public; archived content goes only to paying requesters.
- No telemetry. No other service is contacted.

More: https://witnessd.vip · https://github.com/jschunter/witnessd-mcp
