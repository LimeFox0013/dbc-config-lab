# @dbc-config-lab/core

The lab's engine: everything the site, the hosted API and the MCP server share. It turns an editable launch config into Meteora Dynamic Bonding Curve parameters, simulates launches offline with the SDKs' own swap math, reads real configs and pools from Solana, and builds the transactions an owner signs. Nothing here holds a key except the opt-in local signer under `src/mcp/signer`.

Consumers import one module at a time, through the package's `exports`:

```ts
import { compileLaunchConfig } from '@dbc-config-lab/core/core/launch-config'
import { compareConfigs } from '@dbc-config-lab/core/features/comparison'
import { createLabServer } from '@dbc-config-lab/core/mcp'
```

Each folder's `index.ts` is its public surface; everything else in the folder is internal.

## `src/core` — the engine (framework-free)

| Module | What it does |
|---|---|
| `shared` | Networks, basis-point and token-unit math, number formatting, small helpers (address parsing, sampling, chunking). |
| `quote-token` | The tokens a launch can be priced in (SOL, USDC), their mints and decimals, and SOL ↔ quote-unit conversion at the reference rate. |
| `launch-config` | The editable `LaunchConfig`, its curve shapes and fee schedules, the built-in presets, and compiling a config into on-chain parameters with the SDK's own validation. |
| `launch-simulator` | Replays trades against a fresh pool with the DBC SDK's swap math, through graduation onto the migrated pool; fee splits, holdings and exit values. Offline and deterministic. |
| `migrated-pool` | The DAMM v2 pool a launch graduates into, opened and priced the way the programs do (concentrated or compounding, flat or falling fee, volatility fee). |
| `volatility-tracker` | The dynamic-fee tracker both programs advance between swaps, ported so the volatility fee can be replayed. |
| `sniper-scenario` | Seeded launch situations — snipers, patient bots, humans, arbitrage traders — and the per-group figures and metrics a run produces. |
| `config-search` | Ranks fee schedules (and optionally curves) for a goal by simulating each over several seeds. |
| `config-deploy` | Builds and dry-runs the create-config transaction, summarises the terms being signed, RPC endpoints and explorer links. |
| `config-clone` | A real config's parameters with adjusted fees, liquidity split or first-buy terms, checked against today's program rules. |
| `onchain-config` | Turns a stored PoolConfig account back into config parameters; account byte layouts used by filters. |
| `pool-launch` | Launches a token on an existing config, with the creator's first buy quoted by the simulator. |
| `fee-claim` | Claims a pool's unclaimed trading fees for the partner, the creator, or a royalty vault's recipients. |
| `partner-branding` | A launchpad's on-chain name, website and logo: validation, safe display, and the write transaction. |
| `preset-royalty` | A preset author's share of a launchpad's fees, paid through a Meteora fee-sharing vault. |
| `graduated-positions` | What the graduated-pool positions a wallet holds have earned. |

## `src/features` — what the screens and tools use

Pure feature logic plus thin Vue composables (`use*.ts`) over it:

- **Designing:** `config-editor` (editable fields and their limits), `config-sharing` (share links, untrusted-input decoding, SDK code export), `community-presets`, `recommendation` (goal-based search, run in a Web Worker from `src/workers`).
- **Comparing:** `comparison` (one scenario against several configs), `fee-text`, `replay-check` (real launches the simulator reproduced exactly).
- **Reading chain:** `onchain-config` (a config or pool by address), `real-launches` (how a config's actual launches went), `earnings` (unclaimed fees for a wallet), `operator-dashboard` (a fee wallet's live figures), `launch-page`.
- **Reporting:** `config-report` (terms, open risks, real and simulated launches), `report-feed` (the report for every snapshot launchpad as static JSON), `launchpad-economics` (the mainnet snapshot, rankings and income forecasts).
- **Signing:** `wallet` (Wallet Standard), `deployment` (the shared prepare → dry-run → sign cycle), `pool-launch`, `partner-branding`, `agent-handoff` (the link an agent gives an owner to review and sign), `account` (the hosted service's account API and USDC plan payment).

## `src/mcp` — the agent server

`createLabServer()` registers read-only tools (compare, recommend, load an on-chain config, export, find launchpads) and preview tools that dry-run an action for an owner and return a hand-off link. Only a locally run server given a keypair and a signing policy (`signerFromEnv`) adds `execute_*` tools, which sign within that policy. `npm run build:mcp` bundles it into `mcp-package/` for `npx dbc-config-lab-mcp`.

## Scripts

`scripts/` holds opt-in, network-touching checks and snapshot builders: replaying real mainnet pools through the simulator, devnet deploy/clone/royalty checks, and rebuilding the launchpad economics snapshot. The project README lists the commands.

## Tests

From this package's folder:

```bash
npx vitest run                     # colocated *.test.ts
npx tsc --noEmit -p tsconfig.json  # typecheck
```

Chain-touching code is tested against `Connection` methods stubbed with `vi.spyOn`; `src/testing/dbc-accounts.ts` encodes real DBC account bytes for those stubs.
