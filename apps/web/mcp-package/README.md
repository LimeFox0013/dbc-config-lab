# dbc-config-lab-mcp

[DBC Config Lab](https://github.com/LimeFox0013/dbc-config-lab) as a Model Context Protocol server: an AI agent designs, simulates and checks [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) launch configs on Solana, and proposes deploys, token launches, launchpad branding and fee claims that the owner signs in their own wallet.

```bash
claude mcp add dbc-config-lab -- npx -y dbc-config-lab-mcp
```

Any MCP client takes the same command (`npx -y dbc-config-lab-mcp`, stdio). Node 22 or later. Set `DBC_LAB_URL` to the lab's site so share and hand-off links open there.

**It never signs or sends a transaction, and never asks for a key.** A `preview_*` tool dry-runs the action for the owner's address on the target network and returns the summary the owner will sign plus a hand-off link; the lab rebuilds the action in the owner's browser and only that wallet can sign it. Mainnet actions are refused unless the agent passes `acknowledgeMainnet: true`.

Tools: `list_options`, `compare_configs`, `recommend_config`, `load_onchain_config`, `export_config`, `find_launchpads`, `preview_deploy_config`, `preview_partner_branding`, `preview_token_launch`, `find_earnings`, `preview_fee_claim`, `read_operator_dashboard`. The lab's README documents each one's input and output.

MIT
