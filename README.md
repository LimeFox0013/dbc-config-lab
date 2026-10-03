# DBC Config Lab

Design, simulate and deploy [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) launch configs — and see who profits and who pays before a single token is launched.

A DBC config sets the rules of a token launch: curve shape, fee schedule, graduation threshold, fee split, what happens after graduation. Getting it wrong is expensive and visible only after launch. DBC Config Lab replays a launch offline with **the same swap math the DBC and DAMM v2 programs use**, models sniper bots against human buyers, searches for the config that best serves a stated goal, and deploys the result from the builder's own wallet.

## What it does

| | |
|---|---|
| **Simulate the whole launch** | Trades run through the DBC SDK's own quote math on an in-memory pool, including the volatility fee, whose state the program carries from swap to swap. When the curve graduates, trading continues on a DAMM v2 pool opened the way the DBC program opens it — full-range concentrated, or compounding, with part of every LP fee kept in the pool's own reserves — and priced with the DAMM v2 SDK. Deterministic per seed, no network. |
| **Bots vs humans** | Five launch situations — typical, hype, slow burn, patient bots, tokenized stock listing — with first-second snipers, *patient* bots that wait until the program's own fee for their buy has fallen, and human buyers — optionally with whoever holds unlocked liquidity pulling it right after graduation. Every config sees the same traders and random draws. |
| **Price discovery for tokenized names** | A launch with an outside price — a newly tokenized stock, say — adds arbitrage traders who know it and trade the launch toward it, decided against the live price at each moment on the curve or the migrated pool. The comparison shows how far each config ends from that price and what the arbitrage traders made. |
| **Priced in SOL or USDC** | Any config can be priced in USDC: amounts re-price at a stated rate (1 SOL = 150 USDC), deploys use the network's USDC mint, and on-chain configs are simulated in the token their quote mint says. Every config is checked against Meteora's migration-keeper minimums (10 SOL, 750 USDC): below them, pools would not graduate on their own. |
| **Compare** | Built-in, recommended, edited, shared and on-chain configs side by side: sniper and patient-bot profit, human profit, fees paid, partner + creator fees (with the post-graduation share), and when the launch graduated — plus a chart of each config's price over the launch, graduation marked. Configs whose graduation-pool liquidity is not fully locked say how much can be pulled. |
| **Recommend for a goal** | Seven goals — fair launch, punish bots, fee income, graduate fast, raise the most, stable price, keep early supply out of bots' hands — or your own weights. Each measure is scaled across the candidates before weighting, so no unit dominates; when a measure cannot tell candidates apart in the current situation, the tool says so. Optionally also searches curve shapes and graduation thresholds. Runs in a Web Worker; every figure is simulated. |
| **Edit any config** | Token, curve (standard, market cap, two segments, liquidity weights), quote token (SOL or USDC), fee schedule, volatility fee, fees taken in the quote token or in the launched token, graduation pool fee, migration fee, LP split — each change validated by the DBC program's own rules as you type. |
| **Share and reuse** | A share link reopens the config (it travels in the URL fragment, never sent to a server). "Show code" gives ready-to-run TypeScript that calls the right SDK builder and `createConfig`. |
| **Inspect a live config** | Paste a DBC config address — or the address of a token's bonding-curve pool — to load that launchpad's rules from chain and test them against the same traders, read-only. The lab also reads the pools already launched on it (up to 500, sampled evenly beyond that) and shows how they really went: share that completed the curve, reached 10% of it or never traded, median raised, curve fees per launch, time to complete — next to what the simulation predicts. |
| **Preset catalogue** | The built-in configs and the eight most-graduated real launchpad configs on mainnet (from the launchpad economics snapshot), each with its on-chain record and its simulated outcome under the situation you picked. Edit a copy of a preset, or put a launchpad's config in the comparison. Of those eight launchpads, every one leaves 89–100% of the graduation pool's liquidity unlocked for the creator. |
| **Deploy** | Publishes the config on devnet or mainnet with `createConfig`, signed by your own wallet (any Wallet Standard wallet: Phantom, Solflare, Backpack). |
| **Launch a token** | Creates a token and its bonding-curve pool on any config — the one just deployed or any address — with your wallet as pool creator, and an optional first buy in the same transaction so nobody buys before you. The first buy is quoted by the simulator before you sign; a config's opening anti-sniper fee would hit your own first buy too, unless the config's "first buy at the minimum fee" option (`enableFirstSwapWithMinFee`) is on, and the panel says so. |
| **Claim your fees** | Connect a wallet to see every pool owing it trading fees — as the fee claimer of configs it deployed, and as creator of pools it launched — and claim each with one signature after a dry run. |
| **Launchpad economics** | What the 200 most-graduated launchpad configs on mainnet actually earn: per-launch partner income (median and top quarter), launches and share graduated, read from their pools. Sort by income, graduation or volume; narrow by quote token, graduation threshold, fee shape and creator share; put any of them in the comparison. Bonding-curve fees only. |
| **Clone and tune** | Copy any real config into one your wallet owns — same curve, same terms, your wallet as fee claimer — and adjust its fee schedule, creator share, liquidity split and locks, or first-buy fee. Untouched clones are exact: three mainnet configs cloned on devnet came out identical byte for byte apart from the fee wallet. 61 of the top 200 launchpads could not be created today as they are (they lock under 10% of graduation liquidity); the clone says so and lets you lock enough. |
| **Your launch page** | `/launch/<config>?network=…` — a shareable page for creators: your launchpad's name, website and logo (published on chain by your fee wallet from the deploy panel), its terms in plain language, a simulated typical launch, and the token-launch form for that config. |
| **Income forecast** | For any config in the comparison and a number of launches: the range real launchpads with the same terms earned, with how many launchpads and launches it rests on and when they were read. What comparable launchpads earned — not a promise. |

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

**Locked liquidity protects buyers.** In a hype launch with 90% of the graduation pool's liquidity left unlocked, pulling it right after graduation takes human profit from −47.60 to −81.04 SOL (20 seeds), while the withdrawal takes about 153 SOL at the graduation price — half in SOL, half in tokens it could only partly sell; with the liquidity locked, nothing changes. A real launch did exactly this: its creator withdrew the unlocked 89% of the pool right after graduation.

**Open a tokenized name near its outside price.** In the stock-listing situation (outside price 300 SOL market cap, 10 seeds), the four meme-style presets open near 20 SOL market cap and hand arbitrage traders 131–145 SOL — about twice what the curve raises — and never graduate. A market-cap curve from 250 to 300 SOL (the built-in "Stock listing (USDC)": 37,500 → 45,000 USDC) leaves them 11.8 SOL and graduates every time; one graduating well above the outside price never graduates, because arbitrage sales cap the price.

**Compounding trades fee payouts for depth.** With the graduated pool compounding all its LP fees, a hype launch moves 2.36 SOL from partner + creator payouts into the pool's liquidity, and human buyers come out about 1.7 SOL better because they sell into a deeper pool (5 seeds).

**The volatility fee is a small fee-income lever, not a sniper defence.** Switched on for each built-in schedule, it adds 0.03–0.41 SOL of partner + creator fees per launch, humans pay 0.02–0.23 SOL more in fees, and sniper profit barely moves (10 seeds × 4 situations).

## Limitations

- **Trader behaviour.** Bots are modelled as first-second snipers and as patient bots that react to the fee; arbitrage traders react to the live price against a fixed outside price. Traders reacting to volume or to other wallets are not modelled, and the outside price does not move during a launch.
- **Quote tokens.** SOL and USDC. USDC figures are converted to SOL at a fixed 1 SOL = 150 USDC; on-chain configs priced in any other token are refused for simulation, naming the mint.
- **Refused rather than approximated.** Configs whose fees the simulator cannot reproduce exactly are refused with a reason: the dynamic fee on the migrated pool.
- **Rate-limiter fee mode** is deprecated for new configs and not offered.
- **Slot-based configs** (often from other launchpads) count time in slots; scenario seconds are converted at 400 ms per slot.
- **Exit values** assume each group sells all remaining tokens at the end.
- **Checked against real pools:** the full swap history of five mainnet launches replays with every fee, output, price and pool balance equal to what the programs recorded (`apps/web/scripts/mainnet-replay-verify.ts`): 335 bonding-curve swaps, covering the volatility fee and fees taken in SOL and in the token, and — for the four launches that graduated — each migrated DAMM v2 pool's opening state, its 919 swaps since (two of the pools compounding, with their reserves checked after every swap) and a creator's liquidity withdrawal. Liquidity providers adding or removing liquidity after graduation is modelled only as the option above (all unlocked liquidity pulled at once); the replay applies it as recorded.
- **Fees in either token:** a fee a config collects in the launched token is reported in SOL, valued at the price of the trade that paid it. Real pools' fees in the launched token (launchpad economics, live configs) are valued at the curve's average price — what it raises ÷ the tokens it sells — because a curve can end far above what its tokens sold for.
- **Launchpad income is curve-only.** Fees after graduation go to liquidity positions, not to the config, and are not counted.

## Security

- **No keys handled.** Your wallet signs; the config account's one-off keypair is generated in the browser, signs once and is discarded. The fee claimer and leftover receiver are always the connected wallet.
- **Dry run before signing.** Every deployment is simulated on the target network first; a failing transaction is reported instead of being offered for signature. Before signing you see every setting that decides who earns fees, who can withdraw the graduated liquidity and who controls the token, read from the exact parameters in the transaction. Changing the config, network or wallet discards a prepared transaction — including one still being prepared; mainnet requires an explicit acknowledgement, and unticking it withdraws the transaction. A config opened from someone else's link is never the preselected one.
- **Branding from chain is untrusted.** Anyone's wallet can publish any name, so a launch page marks it as unverified and shows the full fee wallet and config it belongs to. Names are shown as plain text with hidden characters removed; websites and logos only when they are plain https URLs, links by the host they open. Logos load from their own host (any https image is allowed by the page's policy, with no referrer sent), so that host sees the viewer's IP address.
- **Untrusted input is validated.** Share links are size-capped, strictly decoded, rebuilt field by field from a typed reader (unknown fields dropped) and checked by the DBC program's rules before use. On-chain lookups accept only valid addresses and only accounts owned by the DBC program.
- **Hardened static hosting.** Unprivileged nginx with a Content-Security-Policy allowing scripts and workers only from the site and network access only to the site and the public Solana RPC endpoints; no framing. Base images are pinned by digest and patched at build; the image scans clean of OS vulnerabilities.
- **Pinned supply chain.** Every dependency version is fixed by a committed lockfile (installs use `npm ci`); CI actions pinned to commit SHAs; only `main` is ever published.
- **Known advisories.** `npm audit` reports advisories in the Solana dependency chain (`bigint-buffer`, `jayson`'s `stream-json`) with no fixed versions available. They sit in Node-only code paths (the Node RPC transport) or receive no user-controlled input in this browser app. `uuid` and `toml` are lifted past their advisories with `overrides`.

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

### Replay a real pool

```bash
npx tsx apps/web/scripts/mainnet-replay-verify.ts <pool address>
```

Read-only, over the public mainnet RPC. Loads a DBC pool and its config, then replays every swap the pool ever executed — from its on-chain swap events — through the simulator's math from a fresh pool, and compares each swap's fees, output, price and quote reserve with what the program recorded. Add the address of the DAMM v2 pool the launch migrated to (`<pool> <migrated pool>`) to also check the simulator's migrated pool against the one the program opened and replay that pool's swaps.

### Verify the simulator against devnet

```bash
npx tsx apps/web/scripts/devnet-verify.ts
```

Generates a throwaway keypair in memory, funds it (faucet airdrop, or prints the address to fund from https://faucet.solana.com), deploys a flat-fee config through the same code path as the UI, creates a pool, makes real swaps, and compares the stored config, pool reserve, price and fee totals with the simulator's numbers.

### Check that cloning reproduces a real config

```bash
npx tsx apps/web/scripts/devnet-clone-verify.ts <devnet keypair.json> <mainnet config>...
```

Reads each mainnet config, clones it unchanged onto devnet through the same code the UI uses (the keypair file must hold some devnet SOL), and compares the two accounts byte for byte — only the fee claimer, the leftover receiver and, for USDC, the quote mint may differ.

### Rebuild the launchpad economics snapshot

```bash
npx tsx apps/web/scripts/build-launchpad-economics.ts
```

Read-only and slow (public mainnet RPC, about 40 minutes): ranks every DBC config by graduated launches and reads the top 200's pools into `src/features/launchpad-economics/launchpads.json`.

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
  src/core/config-clone       a real config's parameters, adjusted and checked, for a new owner
  src/core/partner-branding   a launchpad's on-chain name, website and logo
  src/features/…              comparison, editor, recommendation (Web Worker), sharing, wallet, on-chain lookup,
                              launchpad economics and income forecast, launch page
  src/views, src/components   the single-page UI
  scripts/mainnet-replay-verify.ts  replays a real pool's swap history and compares it swap by swap
  scripts/devnet-verify.ts    live check against devnet
  scripts/devnet-clone-verify.ts        clones mainnet configs on devnet and compares them byte for byte
  scripts/build-launchpad-economics.ts  rebuilds the launchpad economics snapshot
apps/web-e2e/                 Playwright browser tests (fake wallet, mocked RPC)
libs/deploy-templates         vendored deploy trigger for the hosting platform (build output)
ops/deploy.mts                CI deploy step
```

## Built with

[Meteora DBC SDK](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk) · [Meteora DAMM v2 SDK](https://github.com/MeteoraAg/damm-v2-sdk) · `@solana/web3.js` · Wallet Standard · Vue 3 · Vite · Vitest · Playwright

Built for the Superteam Earn track *Best use of Meteora's Dynamic Bonding Curve* (Crypto World's Fair).

## License

MIT
