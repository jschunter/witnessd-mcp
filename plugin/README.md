# witnessd plugin

Installs two things into Claude Code:

- **The `witnessd` skill** (`skills/witnessd/SKILL.md`): tells Claude *when* it's worth getting a neutral witness. Typical cases: before paying an unfamiliar seller, before acting on third-party data, or when you ask it to prove what a page said. It also sets spending rules: at most 5 paid calls per task without your approval, and a one-line report of each call.
- **The witnessd MCP server** (`npx -y witnessd-mcp`) with three tools: `witness_url` ($0.02), `get_certificate` (free), and `retrieve_snapshot` ($0.05).

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

More: https://witnessd.vip · https://github.com/jschunter/witnessd-mcp
