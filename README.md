# DBC Config Lab

Design, simulate and deploy [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) launch configs — and see who profits and who pays before a single token is launched.

A DBC config sets the rules of a token launch: curve shape, fee schedule, graduation threshold, fee split, what happens after graduation. Getting it wrong is expensive and visible only after launch. DBC Config Lab replays a launch offline with **the same swap math the DBC and DAMM v2 programs use**, models sniper bots against human buyers, searches for the config that best serves a stated goal, and deploys the result from the builder's own wallet.

## What it does

| | |
|---|---|
| **Simulate the whole launch** | Trades run through the DBC SDK's own quote math on an in-memory pool. When the curve graduates, trading continues on a DAMM v2 pool opened the way the DBC program opens it (full range, migrated SOL after the migration fee, at the migration price) and priced with the DAMM v2 SDK. Deterministic per seed, no network. |
| **Bots vs humans** | Four launch situations — typical, hype, slow burn, patient bots — with first-second snipers, *patient* bots that wait until the program's own fee for their buy has fallen, and human buyers. Every config sees the same traders and random draws. |
| **Compare** | Built-in, recommended, edited, shared and on-chain configs side by side: sniper and patient-bot profit, human profit, fees paid, partner + creator fees (with the post-graduation share), and when the launch graduated. |
| **Recommend for a goal** | Seven goals — fair launch, punish bots, fee income, graduate fast, raise the most, stable price, keep early supply out of bots' hands — or your own weights. Each measure is scaled across the candidates before weighting, so no unit dominates; when a measure cannot tell candidates apart in the current situation, the tool says so. Optionally also searches curve shapes and graduation thresholds. Runs in a Web Worker; every figure is simulated. |
| **Edit any config** | Token, curve (standard, market cap, two segments, liquidity weights), fee schedule, graduation pool fee, migration fee, LP split — each change validated by the DBC program's own rules as you type. |
| **Share and reuse** | A share link reopens the config (it travels in the URL fragment, never sent to a server). "Show code" gives ready-to-run TypeScript that calls the right SDK builder and `createConfig`. |
| **Inspect a live config** | Paste a DBC config address — or the address of a token's bonding-curve pool — to load that launchpad's rules from chain and test them against the same traders, read-only. |
| **Deploy** | Publishes the config on devnet or mainnet with `createConfig`, signed by your own wallet (any Wallet Standard wallet: Phantom, Solflare, Backpack). |

## What the simulations show

Averages over 20 seeded scenarios. Profit counts tokens still held at what each group would get by selling them all at the end.

**Typical launch** — 5 first-second snipers buying 1–3 SOL, 60 humans buying 0.1–2 SOL over ten minutes:

| Fee schedule | Sniper profit | Human profit | Partner + creator fees |
|---|---|---|---|
| Flat 1% | +0.85 SOL | −2.30 SOL | 0.67 SOL |
| 90% → 1% over 5–10 s, linear | −6.8 to −7.7 SOL | ≈ −1.78 SOL | 6.3–7.1 SOL |
| 50% → 1% over 60 s, linear | −5.7 SOL | −2.98 SOL | 6.45 SOL |

**A short, steep fee window beats first-second snipers** and leaves later buyers better off than a flat fee; a long window punishes bots too, but early humans pay for it.

**It does not beat patient bots.** With bots that wait for the fee to fall, every fee schedule loses its edge — the sniper shield leaves humans slightly worse off than a flat fee (−3.06 vs −2.59 SOL), because the window then only taxes the humans who arrive during it.

**Hype launches graduate** (20 of 20 runs). After graduation, fast snipers dump into the migrated pool: +26 SOL under a flat fee, −21 SOL under the sniper shield. With 200 holders, selling everything at the end is a fire sale, so human profit is strongly negative under every schedule.

## Limitations

- **Bot behaviour.** Bots are modelled as first-second snipers and as patient bots that react to the fee. Bots reacting to other signals — price, volume, other wallets — are not modelled.
- **Refused rather than approximated.** Configs whose fees the simulator cannot reproduce exactly are refused with a reason: the DBC dynamic (volatility) fee, and compounding or dynamic fees on the migrated pool.
- **Rate-limiter fee mode** is deprecated for new configs and not offered.
- **Slot-based configs** (often from other launchpads) count time in slots; scenario seconds are converted at 400 ms per slot.
- **Exit values** assume each group sells all remaining tokens at the end.
- **Live checks:** the on-chain loader has been run against live mainnet configs and pools; one simulated partner fee matched the real pool's to the lamport. Pool balance bookkeeping between swaps follows the SDK's fee modes and has not yet been compared with a real devnet pool (`apps/web/scripts/devnet-verify.ts` does that).
- **Fees in either token:** a fee a config collects in the launched token is reported in SOL, valued at the price of the trade that paid it.

## Security

- **No keys handled.** Your wallet signs; the config account's one-off keypair is generated in the browser, signs once and is discarded. The fee claimer and leftover receiver are always the connected wallet.
- **Dry run before signing.** Every deployment is simulated on the target network first; a failing transaction is reported instead of being offered for signature. Changing the config, network or wallet discards a prepared transaction; mainnet requires an explicit acknowledgement.
- **Untrusted input is validated.** Share links are size-capped, strictly decoded, rebuilt field by field from a typed reader (unknown fields dropped) and checked by the DBC program's rules before use. On-chain lookups accept only valid addresses and only accounts owned by the DBC program.
- **Hardened static hosting.** Unprivileged nginx with a Content-Security-Policy allowing scripts and workers only from the site and network access only to the site and the public Solana RPC endpoints; no framing.
- **Known advisories.** `npm audit` reports advisories in the Solana/Anchor dependency chain (`toml`, `jayson`/`stream-json`, `uuid`, `bigint-buffer`) with no fixed versions available. They sit in Node-only code paths (Anchor config parsing, the Node RPC transport) or receive no user-controlled input in this browser app.

## Run locally

Requires Node 22.

```bash
npm ci --ignore-scripts
npm run dev          # http://localhost:5180
npm test             # unit tests
npm run e2e          # browser tests (Playwright)
npm run typecheck
npm run build
```

### Verify the simulator against devnet

```bash
npx tsx apps/web/scripts/devnet-verify.ts
```

Generates a throwaway keypair in memory, funds it (faucet airdrop, or prints the address to fund from https://faucet.solana.com), deploys a flat-fee config through the same code path as the UI, creates a pool, makes real swaps, and compares the stored config, pool reserve, price and fee totals with the simulator's numbers.

## Project layout

```
apps/web/
  src/core/launch-config      config ↔ SDK parameters, curve shapes, fee schedules, presets
  src/core/launch-simulator   offline replay with the DBC SDK's swap math, through graduation
  src/core/migrated-pool      the post-graduation DAMM v2 pool, priced with the DAMM v2 SDK
  src/core/sniper-scenario    seeded traders (snipers, patient bots, humans) and launch metrics
  src/core/config-search      goal-weighted search over fee schedules and curves
  src/core/config-deploy      createConfig + dry run
  src/core/onchain-config     on-chain config account → simulation parameters
  src/features/…              comparison, editor, recommendation (Web Worker), sharing, wallet, on-chain lookup
  src/views, src/components   the single-page UI
  scripts/devnet-verify.ts    live check against devnet
apps/web-e2e/                 Playwright browser tests (fake wallet, mocked RPC)
libs/deploy-templates         vendored deploy trigger for the hosting platform (build output)
ops/deploy.mts                CI deploy step
```

## Built with

[Meteora DBC SDK](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk) · [Meteora DAMM v2 SDK](https://github.com/MeteoraAg/damm-v2-sdk) · `@solana/web3.js` · Wallet Standard · Vue 3 · Vite · Vitest · Playwright

Built for the Superteam Earn track *Best use of Meteora's Dynamic Bonding Curve* (Crypto World's Fair).

## License

MIT
