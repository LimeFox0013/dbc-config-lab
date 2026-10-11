# DBC Config Lab

Design, simulate and deploy [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) launch configs — and see who profits and who pays before a single token is launched.

A DBC config sets the rules of a token launch: curve shape, fee schedule, graduation threshold, fee split, what happens after graduation. Getting it wrong is expensive and visible only after launch. DBC Config Lab replays a launch offline with **the same swap math the DBC and DAMM v2 programs use**, models sniper bots against human buyers, searches for the config that best serves a stated goal, and deploys the result from the builder's own wallet.

## What it does

| | |
|---|---|
| **Simulate the whole launch** | Trades run through the DBC SDK's own quote math on an in-memory pool, including the volatility fee, whose state the program carries from swap to swap. When the curve graduates, trading continues on a DAMM v2 pool opened the way the DBC program opens it — full-range concentrated, or compounding, with part of every LP fee kept in the pool's own reserves — and priced with the DAMM v2 SDK, including the graduated pool's own volatility fee and a fee that falls as the price rises. Deterministic per seed, no network. |
| **Bots vs humans** | Five launch situations — typical, hype, slow burn, patient bots, tokenized stock listing — with first-second snipers, *patient* bots that wait until the program's own fee for their buy has fallen, and human buyers — optionally with whoever holds unlocked liquidity pulling it right after graduation. Every config sees the same traders and random draws. |
| **Price discovery for tokenized names** | A launch with an outside price — a newly tokenized stock, say — adds arbitrage traders who know it and trade the launch toward it, decided against the live price at each moment on the curve or the migrated pool. The comparison shows how far each config ends from that price and what the arbitrage traders made. |
| **Priced in SOL or USDC** | Any config can be priced in USDC: amounts re-price at a stated rate (1 SOL = 150 USDC), deploys use the network's USDC mint, and on-chain configs are simulated in the token their quote mint says. Every config is checked against Meteora's migration-keeper minimums (10 SOL, 750 USDC): below them, pools would not graduate on their own. |
| **Compare** | Built-in, recommended, edited, shared and on-chain configs side by side: sniper and patient-bot profit, human profit, fees paid, partner + creator fees (with the post-graduation share), and when the launch graduated — plus a chart of each config's price over the launch, graduation marked. Configs whose graduation-pool liquidity is not fully locked say how much can be pulled. |
| **Recommend for a goal** | Eight goals — fair launch, punish bots, fee income, graduate fast, raise the most, stable price, keep early supply out of bots' hands, price close to an outside price — or your own weights. Each measure is scaled across the candidates before weighting, so no unit dominates; when a measure cannot tell candidates apart in the current situation, the tool says so. Optionally also searches curve shapes and graduation thresholds — in a situation with arbitrage traders, curves placed relative to their outside price (opening at 80–95% of it, graduating at 95–100%). Runs in a Web Worker; every figure is simulated. |
| **Edit any config** | Token, curve (standard, market cap, two segments, liquidity weights), quote token (SOL or USDC), fee schedule, volatility fee, fees taken in the quote token or in the launched token, graduation pool fee — with its volatility fee and a fee that falls linearly or exponentially as the price rises — migration fee, LP split, tokens locked for the creator and their unlock schedule — each change validated by the DBC program's own rules as you type. |
| **Share and reuse** | A share link reopens the config (it travels in the URL fragment, never sent to a server). "Show code" gives ready-to-run TypeScript that calls the right SDK builder and `createConfig`. |
| **Inspect a live config** | Paste a DBC config address — or the address of a token's bonding-curve pool — to load that launchpad's rules from chain and test them against the same traders, read-only. The lab also reads the pools already launched on it (up to 500, sampled evenly beyond that) and shows how they really went: share that completed the curve, reached 10% of it or never traded, median raised, curve fees per launch, time to complete — next to what the simulation predicts. |
| **Preset catalogue** | The built-in configs and the eight most-graduated real launchpad configs on mainnet (from the launchpad economics snapshot), each with its on-chain record and its simulated outcome under the situation you picked. Edit a copy of a preset, or put a launchpad's config in the comparison. Of those eight launchpads, every one leaves 89–100% of the graduation pool's liquidity unlocked for the creator. |
| **Deploy** | Publishes the config on devnet or mainnet with `createConfig`, signed by your own wallet (any Wallet Standard wallet: Phantom, Solflare, Backpack). |
| **Launch a token** | Creates a token and its bonding-curve pool on any config — the one just deployed or any address — with your wallet as pool creator, and an optional first buy in the same transaction so nobody buys before you. The first buy is quoted by the simulator before you sign; a config's opening anti-sniper fee would hit your own first buy too, unless the config's "first buy at the minimum fee" option (`enableFirstSwapWithMinFee`) is on, and the panel says so. |
| **Claim your fees** | Connect a wallet to see every pool owing it trading fees — as the fee claimer of configs it deployed, and as creator of pools it launched — and claim each with one signature after a dry run. |
| **Launchpad economics** | What the 200 most-graduated launchpad configs on mainnet actually earn: per-launch partner income (median and top quarter), launches and share graduated, read from their pools. Sort by income, graduation or volume; narrow by quote token, graduation threshold, fee shape and creator share; put any of them in the comparison. Fees after graduation are shown apart: none for a launchpad that keeps no graduation liquidity, measured from the positions its fee wallet holds (up to 500 sampled), or marked not measurable when it no longer holds them. |
| **Clone and tune** | Copy any real config into one your wallet owns — same curve, same terms, your wallet as fee claimer — and adjust its fee schedule, creator share, liquidity split and locks, or first-buy fee. Untouched clones are exact: three mainnet configs cloned on devnet came out identical byte for byte apart from the fee wallet. 61 of the top 200 launchpads could not be created today as they are (they lock under 10% of graduation liquidity); the clone says so and lets you lock enough. |
| **Your launch page** | `/launch/<config>?network=…` — a shareable page for creators: your launchpad's name, website and logo (published on chain by your fee wallet from the deploy panel), its terms in plain language, a simulated typical launch, and the token-launch form for that config. |
| **Preset royalties** | Publish a preset with your wallet and a share (1–50%), by share link or in the community registry. Every launchpad deployed from it makes a Meteora Dynamic Fee Sharing vault its fee claimer, created in the same transaction, which splits each fee claim between the launchpad and you. Each side claims its own share from the earnings panel; nothing is held by this tool. Verified on devnet to the lamport. |
| **Your launchpad, live** | Paste a fee wallet to watch every config it collects fees for — launches, graduations, its lifetime curve fees and what is still unclaimed, read from all of the config's pools — and what its graduated-pool positions have earned (claimed plus pending; up to 1,000 positions read, an even sample scaled up beyond that). Refreshes every minute while open; read-only. |
| **Income forecast** | For any config in the comparison and a number of launches: the range real launchpads with the same terms earned, with how many launchpads and launches it rests on and when they were read, plus a separate range for fees after graduation where comparables could be measured. When fewer than three launchpads share every term, it sets aside the creator's share, then the fee shape, then the graduation threshold — never the quote token — and says which. What comparable launchpads earned — not a promise. |
| **Config report** | `/config/<config or pool>?network=…` — a read-only page for anyone deciding whether to buy or launch on a config, no wallet: the risks its terms leave open (graduation liquidity that can be withdrawn and by whom, mint or metadata authority kept, no automatic graduation, terms Meteora's SDK no longer accepts for new configs), its terms, how the real launches on it went, and a simulated typical launch — each figure labelled read or simulated. Downloads as JSON; the agent tools return the same report. Over the 200 most-graduated mainnet launchpads it finds withdrawable liquidity on 199. |
| **Report feed** | The report for every one of the 200 launchpads in the snapshot, published with the site as JSON any terminal or script can fetch, no key: `/data/launchpads/index.json` lists each with the risks its terms leave open, its launches, graduation rate and partner income, and links its full entry (`/data/launchpads/<config>.json` — terms, risks, a simulated typical launch, the snapshot record). Each entry says what it does not carry (branding, royalty split, the page's live read of every pool). Regenerated from the snapshot on every build. |
| **For AI agents (MCP)** | The lab as a Model Context Protocol server: an agent lists the presets, situations and goals, compares any configs (built-in, shared, edited or on chain), asks for a recommendation by goal or by its own criterion weights, reads an on-chain config with its real launches, searches the launchpad economics snapshot, and exports a config as a share link and SDK code. In agent mode it also proposes deploying a config or an adjusted copy of a real one, publishing launchpad branding, launching a token and claiming fees: it dry-runs each for the owner's address and returns a hand-off link where the owner checks the same summary and signs in their own wallet. Same simulator, same validation as the UI; it never signs or sends a transaction. `npx dbc-config-lab-mcp`. |
| **Account** | `/account` — your account on the lab's hosted service. Sign in by signing the service's challenge with your wallet (no password; the session is the service's own cookie). See your plan and today's tool calls, and pay for Pro in USDC from your wallet — shown as paid only once the service credits the transfer. Create API keys for agents (each shown once, then listed by label and prefix; revoke any), watch configs or fee wallets for new pools, graduations, risk changes or unclaimed fees (pause, resume, delete; the changes seen are listed), and register webhook addresses (signing secret shown once; send a test; read the delivery log). Refusals are shown in the service's own words. |

## Reference

### Pages

| Path                                 | For                                                                                                                                                                                                                                                | Wallet                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/`                                  | The lab: launch situation, comparison and price chart, recommender, editor, preset catalogue, on-chain lookup and real launches, launchpad economics and income forecast, clone, deploy and branding, token launch, fee claims, operator dashboard | Only to deploy, launch, publish branding or claim |
| `/launch/<config>?network=…`         | Creators launching on one launchpad: its name and logo (marked unverified), terms, a simulated typical launch, the launch form                                                                                                                     | To launch                                         |
| `/config/<config or pool>?network=…` | Anyone deciding whether to trade or launch on a config: its risks, terms, real launches and a simulated typical launch; downloads as JSON                                                                                                          | None                                              |
| `/act#action=…`                      | The owner of an action an agent proposed: the action rebuilt in the browser, dry-run, with the same summary as the lab's own screens; only the wallet the agent named can sign | To sign the proposed action |
| `/account`                           | Anyone using the hosted service: sign-in, plan and usage, Pro payment, API keys, watches, webhook addresses | To sign in and to pay |
| `#config=…` on any page              | A shared config, decoded in the browser and never sent to a server                                                                                                                                                                                 | —                                                 |

`network` is `devnet` or `mainnet-beta` (default).

### Launch situations

| Id              | Name                    | Who trades                                                                                      |
| --------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `typical`       | Typical meme launch     | A handful of first-second snipers and a steady trickle of human buyers over ten minutes         |
| `hype`          | Hype launch             | Many snipers, patient bots and two hundred buyers in the first three minutes; usually graduates |
| `slow-burn`     | Slow burn               | Little bot interest; buyers spread over an hour                                                 |
| `patient-bots`  | Patient bots            | No first-second snipers; bots wait for the fee to drop before buying                            |
| `stock-listing` | Tokenized stock listing | Thin human demand over half an hour, and arbitrage traders who know an outside price            |

Every situation takes a seed, the counts and sizes of each trader group, an optional pull of unlocked liquidity right after graduation, an optional creator vesting sale, and (for `stock-listing`) the outside market cap.

### Built-in presets

| Id              | Name                 | Intent                                                                               |
| --------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `flat`          | Flat 1%              | The same fee for everyone, as on most meme launchpads                                |
| `sniper-shield` | Sniper shield        | Fee falls 90% → 1% over the first 10 seconds                                         |
| `soft-open`     | Soft open            | Fee falls 50% → 1% over 5 seconds, exponentially: a milder deterrent                 |
| `long-tax`      | Long tax             | Fee falls 50% → 1% over a minute; a warning: early humans pay too                    |
| `stock-listing` | Stock listing (USDC) | Opens at a 37,500 USDC market cap, just under a ~45,000 USDC (300 SOL) outside price |

Community presets live in `packages/core/src/features/community-presets/presets.json` (a share link's encoded config, a name, an intent and an optional royalty); add one by pull request.

### Recommender goals and criteria

| Goal                                                    | Weighs mostly                     |
| ------------------------------------------------------- | --------------------------------- |
| `fair-launch` — Fair launch for early buyers            | human outcome                     |
| `sniper-deterrent` — Punish bots hardest                | bot deterrence                    |
| `fee-income` — Maximise fee income                      | partner + creator fees            |
| `graduate-fast` — Graduate fast                         | graduation, and how soon          |
| `max-raise` — Raise the most                            | quote raised                      |
| `stable-price` — Keep the price stable                  | price stability                   |
| `early-fairness` — Keep early supply out of bots' hands | share of early supply humans hold |
| `fair-price` — Price close to an outside price          | distance from the outside price   |

Every goal keeps some weight on human buyers. Custom weights (0–1) go on the criteria `human-outcome`, `bot-deterrence`, `fee-income`, `graduation`, `raise`, `price-stability`, `early-fairness`, `fair-price`. Candidates are ranked over several seeds, and each proposal is set against a flat 1% fee.

### Config report risks

| Risk                  | Raised when                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `liquidity-pullable`  | Part of the liquidity the pool graduates with is not locked; the report says how much the launchpad and the creator can each withdraw right after graduation |
| `mint-authority-kept` | The launchpad or the creator keeps the authority to mint more of the token and change its metadata                                                           |
| `metadata-mutable`    | The launchpad or the creator can change the token's name, symbol and image after launch                                                                      |
| `no-auto-graduation`  | The threshold is below Meteora's migration keepers' minimum (10 SOL, 750 USDC), so pools will not graduate on their own                                      |
| `refused-today`       | Meteora's SDK would refuse these exact terms for a new config, with its reason                                                                               |

### Agent tools (MCP)

Unless you turn on the [local policy signer](#signing-locally-under-a-policy), nothing is signed, sent or stored, and no tool asks for a key. A config can be given as `{ source: "preset", id }`, `{ source: "shared", link }` (a share link or its encoded part), `{ source: "config", config }` (a full config object, validated by the program's rules) or, where noted, `{ source: "on-chain", address, network }`.

| Tool                  | Input                                                                                              | Returns                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `list_options`        | —                                                                                                  | Presets, situations (with their full trader spec), goals with their weights, criteria                                        |
| `compare_configs`     | `configs` (any source, on-chain included), `situation`, `seed?`, `outsideMarketCapSol?`            | One row per config: sniper, patient-bot, human and arbitrage profit, fees, graduation, raise, price path, pullable liquidity |
| `recommend_config`    | `goal` or `weights`, `base?` (not on-chain), `situation`, `outsideMarketCapSol?`, `includeCurves?` | Ranked proposals with figures, how each compares with a flat fee, and a `shared` string to pass back in                      |
| `load_onchain_config` | `address` (config or pool), `network`, `includeRealLaunches?`                                      | The config report (as on `/config`), its page URL, and a ref to compare it                                                   |
| `export_config`       | a config (not on-chain)                                                                            | The config object, a share link and TypeScript that creates it with the DBC SDK                                              |
| `find_launchpads`     | `sort`, `limit`, and filters on quote token, threshold, fee shape, creator share                   | The snapshot's matching launchpads with their record and report URL                                                          |
| `preview_deploy_config` | `owner`, `config` (not on-chain), `network?`, `acknowledgeMainnet?` | Dry run, the deploy summary (who earns which fees, who can withdraw the graduated liquidity, who controls the token), hand-off link |
| `preview_clone_config` | `owner`, `sourceAddress` (config or pool), `sourceNetwork?` (default mainnet), `adjustments?` (fee schedule, creator share, liquidity split and locks, first buy at the minimum fee), `network?`, `acknowledgeMainnet?` | Dry run of deploying a copy of a real config with the owner as fee claimer — exact unless adjusted, never a different curve — summary, hand-off link |
| `preview_partner_branding` | `owner`, `name`, `website?`, `logo?`, `network?`, `acknowledgeMainnet?` | Dry run of writing the launchpad's name against the owner's fee wallet, hand-off link |
| `preview_token_launch` | `owner`, `configAddress` (config or pool), `name`, `symbol`, `uri?`, `firstBuy?`, `network?`, `acknowledgeMainnet?` | Dry run, the config's terms for creators, the simulated first buy and its fee, hand-off link |
| `find_earnings` | `owner`, `network?` | Every pool owing the wallet trading fees, by role, and a link to the claim page |
| `preview_fee_claim` | `owner`, `pool`, `role`, `network?`, `acknowledgeMainnet?` | Dry run of claiming what one pool owes in one role, hand-off link |
| `read_operator_dashboard` | `feeWallet`, `network` | The live dashboard for any launchpad fee wallet: each config's launches, graduations, lifetime and unclaimed curve fees, graduated-pool earnings, totals |
| `execute_deploy_config`, `execute_clone_config`, `execute_partner_branding`, `execute_token_launch`, `execute_fee_claim` | the matching preview's input, without `owner` and `acknowledgeMainnet` | Local signer only: signs and sends the action within your policy; signatures, explorer links, the new accounts, SOL spent and spent today |

**Agent mode.** The `preview_*` tools take only the owner's address. Each dry-runs the action on the target network (devnet by default) and returns what the owner will sign plus a `handoffLink` to `/act`. The link carries the proposed action, never a transaction — a prepared transaction expires within about a minute and is partly signed by a one-off key that must stay in the owner's browser — so the page builds it again, dry-runs it, shows the same summary as the lab's own screens, and lets only the wallet the agent named sign. The fee claimer, leftover receiver and pool creator are always the owner. Mainnet actions are refused unless the agent passes `acknowledgeMainnet: true`, and the owner still ticks the page's own mainnet acknowledgement. Addresses of one-off accounts (a new config, a new mint and its pool) are assigned when the owner signs. Each preview also reports `ownerBalanceSol`, and a dry run that fails because the owner holds no SOL says so. Config terms come back with the SDK's option names (`tokenAuthority: "Immutable"`) rather than numbers. A proposed clone's link carries only the original's address and the adjustments: the page reads the original from chain and rebuilds the copy itself.

#### Signing locally under a policy

The locally run server can also act on its own, as one wallet you give it and only within limits you write down. Set both variables, each naming a file:

```bash
DBC_LAB_KEYPAIR=~/.config/solana/lab-agent.json   # a Solana keypair file, as solana-keygen writes it
DBC_LAB_POLICY=~/.config/dbc-lab/policy.json
```

```json
{
  "actions": ["execute_token_launch", "execute_fee_claim"],
  "networks": ["devnet"],
  "maxSolPerAction": 0.1,
  "maxSolPerDay": 0.5
}
```

With both set and valid, the server adds the `execute_*` tools for the actions the previews cover. That wallet is the owner: it pays, claims fees and creates pools, and each action is built exactly as its preview builds it. Every transaction is simulated and checked before it is signed, and anything outside the policy is refused with the rule it broke, with nothing signed:

- `actions` — the `execute_*` tools allowed to run;
- `networks` — `devnet`, and `mainnet-beta` only if you list it;
- `maxSolPerAction` and `maxSolPerDay` — SOL leaving the wallet in the simulation, fees included; the day is UTC, and its spend is kept in `<policy file>.spend.json`, so a restart does not reset it;
- `programs` (optional) — the programs a transaction may call, directly or through another program. Without it: DBC, DAMM v2, fee sharing, System, SPL Token, Associated Token, Compute Budget and Token Metadata. A list you give replaces that one.

An action is checked in full before any of it is signed, and actions run one at a time. If only one variable is set, or either file is unreadable or invalid, the server starts with previews only and says why in its log. Use a wallet that holds only what you are willing to let the agent spend. The hosted endpoint never offers these tools, whatever its environment holds.

### Hosted agent API

`apps/api` serves the same agent tools over the network, plus accounts, API keys, paid plans, watches and webhooks. It is a NestJS service with its own Postgres database; migrations run at start-up.

**Agent tools.** `POST /mcp` (and `GET`/`DELETE /mcp` for the session stream) speaks MCP Streamable HTTP and runs the same server as the npm package — the same tools, inputs and figures, previews only. Without a key, calls count against the caller's network address (stored only as a keyed hash). With `Authorization: Bearer <key>`, they count against the key's account and its plan. Only `tools/call` messages count; listing tools is free. A call over the day's allowance gets HTTP 429 with JSON-RPC error `-32001`; a revoked or unknown key gets HTTP 401 with `-32002` and is never served as anonymous. Allowances reset at 00:00 UTC.

**Plans.**

| Plan | Tool calls per UTC day | Watches | Price |
|---|---|---|---|
| Free | 200 | 3 | — |
| Pro | 20,000 | 50 | 49 USDC per 30 days |

A Pro period runs on from the current end while one is active. When it lapses the account is Free again: extra watches stay stored, and only the oldest ones within the Free limit keep being checked.

**Sign-in.** Sign-In With Solana: `POST /auth/challenge { address }` returns a message naming the site; the wallet signs it with `signMessage`; `POST /auth/session { message, signature }` checks the signature, the site's domain and the one-time challenge (5 minutes, burned on first use) and sets an http-only `lab_session` cookie (7 days, only the hash of its token is stored). `DELETE /auth/session` signs out. One account per wallet, created on first sign-in. Only the site's own origin may call with the cookie.

**Account endpoints** (signed in):

| Endpoint | What it does |
|---|---|
| `GET /account` | Wallet, plan, plan end, today's calls and the plan's limits |
| `GET /account/keys`, `POST /account/keys { label }`, `DELETE /account/keys/:id` | API keys. The full key is in the create response only; listings show its label and prefix |
| `POST /account/payments { plan: "pro" }` | A Solana Pay USDC transfer request (a `solana:` URL with a unique reference) for the wallet to sign |
| `GET /account/payments/:reference` | Checks the chain and credits the plan once the transfer is finalized and pays the full amount |
| `GET /account/watches`, `POST /account/watches`, `PATCH /account/watches/:id { paused }`, `DELETE /account/watches/:id` | Watches |
| `GET /account/events` | The last 100 recorded changes, newest first |
| `GET /account/webhooks`, `POST /account/webhooks { url }`, `DELETE /account/webhooks/:id`, `POST /account/webhooks/:id/test` | Webhook addresses, and a test delivery sent at once |
| `GET /account/deliveries` | The last 100 deliveries with every attempt |

The service never signs or sends: the wallet pays, and the service only reads the chain. A transfer credits a plan once, however often it is checked. A background check also credits requests up to 7 days old, so a payer who closes the page is still credited. Paid plans are off until `DBC_LAB_PAY_RECIPIENT` is set.

**Watches.** `POST /account/watches { kind, target, network?, thresholdSol? }`. A `config` watch follows a launch config: new pools, graduations, and changes to its open risks. A `fee-wallet` watch follows a launchpad fee wallet and reports once each time its unclaimed fees rise to `thresholdSol` (required). The first check only records a baseline. Every 3 minutes one instance (a Postgres advisory lock) checks each active watch, records each change once and queues its deliveries in the same transaction. Paused watches count towards the plan's limit.

**Webhooks.** Up to 5 https addresses per account; private, loopback and link-local addresses are refused when registered and again at every send, and redirects are not followed. The signing secret (`whsec_…`) is shown once, at registration, and stored encrypted. Each delivery is a JSON `POST` with:

- `X-Lab-Event` — the change type (`new-pool`, `graduation`, `risks-changed`, `fees-above-threshold`, or `test`);
- `X-Lab-Timestamp` — seconds since the epoch;
- `X-Lab-Signature` — `sha256=` + hex HMAC-SHA256 of `<timestamp>.<body>`, keyed with the secret.

Any 2xx answer is delivered. Otherwise it is retried after 30 s, doubling each time, for 6 attempts in all.

**Configuration.**

| Variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string (required) |
| `CALLER_HASH_KEY` | Secret that keys the address hash and the webhook-secret encryption (required) |
| `DBC_LAB_SITE_ORIGIN` | The site's origin: the sign-in domain and the only CORS origin allowed with a cookie (default: `DBC_LAB_URL`'s origin) |
| `DBC_LAB_PAY_RECIPIENT` | Wallet that receives plan payments; unset turns paid plans off |
| `DBC_LAB_PAY_NETWORK` | `mainnet-beta` (default) or `devnet` |
| `DBC_LAB_URL`, `DBC_LAB_RPC_MAINNET`, `DBC_LAB_RPC_DEVNET` | As for the [local agent server](#use-it-from-an-ai-agent) |
| `PORT` | Listening port (default 8080) |
| `MIGRATIONS_DIR` | Migrations folder (default: `drizzle` next to the bundle) |

`GET /health` answers `{ "status": "ok" }`. Errors other than deliberate refusals reach the caller as a generic message only.

### Report feed format

`/data/launchpads/index.json` (`version` 1; values below are illustrative):

```jsonc
{
  "version": 1,
  "takenAt": "2026-10-03", // when the snapshot read the chain
  "launchpads": [
    {
      "configAddress": "…",
      "risks": ["liquidity-pullable"],
      "pullableLiquidityPercent": 89,
      "launches": 127,
      "graduationRate": 1, // 0–1
      "partnerIncomeMedian": 0.004, // SOL per launch, curve fees
      "entry": "/data/launchpads/<config>.json",
      "reportPage": "/config/<config>?network=mainnet",
    },
  ],
}
```

Each `<config>.json` entry carries the report's `terms`, `risks` and `simulated` typical launch, the fee claimer, the snapshot `record` (launches, graduations, share never traded, median time to complete, partner income median and top quarter, income after graduation, pullable liquidity) and `notCarried` — what the live page has but the feed does not: `branding`, `royalty-split`, `live-real-launches`. `version` changes when the shape does.

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

**Vesting is the other lever.** In a hype launch, a flat-fee config that vests 100M tokens to the creator (10M at a one-month cliff, the rest over a year) leaves buyers about where they are without vesting while the tokens stay locked (human profit −47.77 vs −47.60 SOL). If the creator sells them once unlocked, it falls to −229.82 SOL and the creator receives 183.91 SOL (20 seeds) — so vesting delays a dump; it does not prevent one.

**Open a tokenized name near its outside price.** In the stock-listing situation (outside price 300 SOL market cap, 10 seeds), the four meme-style presets open near 20 SOL market cap and hand arbitrage traders 131–145 SOL — about twice what the curve raises — and never graduate. A market-cap curve from 250 to 300 SOL (the built-in "Stock listing (USDC)": 37,500 → 45,000 USDC) leaves them 11.8 SOL and graduates every time; one graduating well above the outside price never graduates, because arbitrage sales cap the price. Opening closer does better still: 95% → 98% of the outside market cap (285 → 294 SOL) leaves them 3.9 SOL under a flat fee and graduates every time. Asked for "price close to an outside price" with curves on, the recommender lands there and adds a 50% → 1% fee over 30 s, which leaves arbitrage traders about break-even (−0.4 SOL) and still graduates every launch in about two minutes.

**Compounding trades fee payouts for depth.** With the graduated pool compounding all its LP fees, a hype launch moves 2.36 SOL from partner + creator payouts into the pool's liquidity, and human buyers come out about 1.7 SOL better because they sell into a deeper pool (5 seeds).

**Most launchpads earn nothing after graduation; for a few it is most of their income.** Of the 200 most-graduated launchpads, 133 keep no graduation liquidity, so the curve is all they earn. Of the 55 whose positions could be measured, 9 earn more per launch after graduation than on the curve — one 49× more (0.180 vs 0.0037 SOL) — while the median earns about 0.03% of its curve income after graduation (quote-token fees only; 2026-10-03).

**The volatility fee is a small fee-income lever, not a sniper defence.** Switched on for each built-in schedule, it adds 0.03–0.41 SOL of partner + creator fees per launch, humans pay 0.02–0.23 SOL more in fees, and sniper profit barely moves (10 seeds × 4 situations).

## Limitations

- **Trader behaviour.** Bots are modelled as first-second snipers and as patient bots that react to the fee; arbitrage traders react to the live price against a fixed outside price. Traders reacting to volume or to other wallets are not modelled, and the outside price does not move during a launch.
- **Quote tokens.** SOL and USDC. USDC figures are converted to SOL at a fixed 1 SOL = 150 USDC; on-chain configs priced in any other token are refused for simulation, naming the mint.
- **Refused rather than approximated.** Configs whose fees the simulator cannot reproduce exactly are refused with a reason: those graduating to DAMM v1.
- **Rate-limiter fee mode** is deprecated for new configs and not offered.
- **Slot-based configs** (often from other launchpads) count time in slots; scenario seconds are converted at 400 ms per slot.
- **Exit values** assume each group sells all remaining tokens at the end.
- **Vested tokens** are sold in one sale after the last trade: nobody trades between unlocks in this model, so the unlock schedule itself does not change the outcome.
- **Checked against real pools:** the full swap history of eight mainnet launches replays with every fee, output, price and pool balance equal to what the programs recorded (`packages/core/scripts/mainnet-replay-verify.ts`): 386 bonding-curve swaps, covering the volatility fee, fees taken in SOL and in the token and a creator's first buy at the minimum fee, and — for the seven launches that graduated — each migrated DAMM v2 pool's opening state, its 970 swaps since (four of the pools compounding, with their reserves checked after every swap; three with the graduated pool's own volatility fee; two with a fee falling as the price rises) and liquidity added and withdrawn. Liquidity providers adding or removing liquidity after graduation is modelled only as the option above (all unlocked liquidity pulled at once); the replay applies it as recorded.
- **Fees in either token:** a fee a config collects in the launched token is reported in SOL, valued at the price of the trade that paid it. Real pools' fees in the launched token (launchpad economics, live configs) are valued at the curve's average price — what it raises ÷ the tokens it sells — because a curve can end far above what its tokens sold for.
- **Income after graduation** counts quote-token fees on the positions a launchpad's fee wallet still holds (claimed plus pending, up to 500 sampled); fees taken in the launched token are not counted, and launchpads sharing one fee wallet share one figure.

## Security

- **No keys handled.** Your wallet signs; the config account's one-off keypair is generated in the browser, signs once and is discarded. The fee claimer and leftover receiver are always the connected wallet.
- **Agents propose, owners sign.** The agent tools never hold a key or send a transaction — unless you run the server yourself with the [local policy signer](#signing-locally-under-a-policy) turned on, and then only within your policy. A hand-off link is untrusted input, decoded and checked like a share link; the page rebuilds the action itself and refuses any wallet but the one the agent named.
- **The hosted API stores no secrets in the clear.** Session tokens and API keys are kept as hashes, callers' network addresses as keyed hashes, and webhook signing secrets encrypted. It holds no wallet key and never signs.
- **Dry run before signing.** Every deployment is simulated on the target network first; a failing transaction is reported instead of being offered for signature. Before signing you see every setting that decides who earns fees, who can withdraw the graduated liquidity and who controls the token, read from the exact parameters in the transaction. Changing the config, network or wallet discards a prepared transaction — including one still being prepared; mainnet requires an explicit acknowledgement, and unticking it withdraws the transaction. A config opened from someone else's link is never the preselected one.
- **Royalties hold no funds.** A royalty is split by Meteora's fee-sharing program; this tool only builds the transactions. A royalty config's vault also receives the launchpad's position in the graduated pool (the program gives it to the fee claimer), so that liquidity cannot be withdrawn — said before signing.
- **Branding from chain is untrusted.** Anyone's wallet can publish any name, so a launch page marks it as unverified and shows the full fee wallet and config it belongs to. Names are shown as plain text with hidden characters removed; websites and logos only when they are plain https URLs, links by the host they open. Logos load from their own host (any https image is allowed by the page's policy, with no referrer sent), so that host sees the viewer's IP address.
- **Untrusted input is validated.** Share links are size-capped, strictly decoded, rebuilt field by field from a typed reader (unknown fields dropped) and checked by the DBC program's rules before use. On-chain lookups accept only valid addresses and only accounts owned by the DBC program.
- **Hardened static hosting.** Unprivileged nginx with a Content-Security-Policy allowing scripts and workers only from the site and network access only to the site and the public devnet RPC; no framing. Base images are pinned by digest and patched at build; the image scans clean of OS vulnerabilities.
- **Mainnet through the site's own proxy.** Solana's public mainnet endpoint refuses requests from browsers, so the page calls `/rpc/mainnet` on its own site, which nginx forwards to Helius with the API key added on the server — the key is a deployment secret and never reaches the page. The proxy strips the page's origin, referrer and cookies and limits each address to 20 requests a second.
- **Pinned supply chain.** Every dependency version is fixed by a committed lockfile (installs use `npm ci`); CI actions pinned to commit SHAs; only `main` is ever published.
- **Known advisories.** `npm audit` reports advisories in the Solana dependency chain (`bigint-buffer`, `jayson`'s `stream-json`) with no fixed versions available. They sit in Node-only code paths (the Node RPC transport) or receive no user-controlled input in this browser app. `uuid` and `toml` are lifted past their advisories with `overrides`.

## Run locally

Requires Node 22.

```bash
npm ci --ignore-scripts
npm run dev          # http://localhost:5180 — mainnet via the public endpoint, or
HELIUS_API_KEY=… npm run dev   # mainnet via Helius; the key stays in the dev server
npm test             # unit tests
npm run e2e          # browser tests (Playwright)
npm run typecheck
npm run build
```

### Run the hosted API

```bash
npm run build -w apps/api
DATABASE_URL=postgres://… CALLER_HASH_KEY=… npm start -w apps/api   # http://localhost:8080
npm test -w apps/api   # unit tests; set TEST_DATABASE_URL to a scratch Postgres to run the database tests too
```

The database tests migrate the database they are given and leave rows in it, so never point `TEST_DATABASE_URL` at real data. See [Hosted agent API](#hosted-agent-api) for the other variables.

### Fetch the report feed

`npm run build` writes the feed into `apps/web/dist/data/launchpads/`; the site serves it from any origin:

```bash
curl https://<site>/data/launchpads/index.json            # every launchpad, its risks and record
curl https://<site>/data/launchpads/<config address>.json # one launchpad's full entry
```

### Use it from an AI agent

The MCP server runs locally over stdio. For Claude Code, from npm:

```bash
claude mcp add dbc-config-lab -- npx -y dbc-config-lab-mcp
```

or from a clone of this repo:

```bash
claude mcp add dbc-config-lab -- npx tsx packages/core/src/mcp/server.ts
```

Any other MCP client takes the same command. Set `DBC_LAB_URL` to the lab's site so share and hand-off links open there (default: the live site, `https://lf-aw-pod.dbc-lab.at.lime-fox.net/`; use `http://localhost:5180/` with `npm run dev`). Chain reads use Solana's public endpoints, which rate-limit heavy reads (earnings, dashboards, real launches); set `DBC_LAB_RPC_MAINNET` and/or `DBC_LAB_RPC_DEVNET` to a provider's http(s) URL to use it instead — the URL is never echoed back to the agent. The tools are listed under [Agent tools](#agent-tools-mcp).

To use the hosted endpoint instead, point an MCP client that speaks Streamable HTTP at `https://<api host>/mcp`, adding `Authorization: Bearer <key>` for a key's plan. See [Hosted agent API](#hosted-agent-api).

`npm run build:mcp -w packages/core` bundles the server, its dependencies and the launchpad snapshot into `packages/core/mcp-package/server.mjs`, the file the npm package publishes.

### Replay a real pool

```bash
npx tsx packages/core/scripts/mainnet-replay-verify.ts <pool address>
```

Read-only, over the public mainnet RPC. Loads a DBC pool and its config, then replays every swap the pool ever executed — from its on-chain swap events — through the simulator's math from a fresh pool, and compares each swap's fees, output, price and quote reserve with what the program recorded. Add the address of the DAMM v2 pool the launch migrated to (`<pool> <migrated pool>`) to also check the simulator's migrated pool against the one the program opened and replay that pool's swaps.

### Verify the simulator against devnet

```bash
npx tsx packages/core/scripts/devnet-verify.ts
```

Generates a throwaway keypair in memory, funds it (faucet airdrop, or prints the address to fund from https://faucet.solana.com), deploys a flat-fee config through the same code path as the UI, creates a pool, makes real swaps, and compares the stored config, pool reserve, price and fee totals with the simulator's numbers.

### Check that cloning reproduces a real config

```bash
npx tsx packages/core/scripts/devnet-clone-verify.ts <devnet keypair.json> <mainnet config>...
```

Reads each mainnet config, clones it unchanged onto devnet through the same code the UI uses (the keypair file must hold some devnet SOL), and compares the two accounts byte for byte — only the fee claimer, the leftover receiver and, for USDC, the quote mint may differ.

### Check royalties on devnet

```bash
npx tsx packages/core/scripts/devnet-royalty-verify.ts <devnet keypair.json>
```

Deploys a royalty config through the UI's code path (deployer 90%, a fresh author 10%), launches a token on it with a first buy, has the vault claim the launchpad's fees and the author claim their share, and compares every amount to the lamport.

### Rebuild the launchpad economics snapshot

```bash
npx tsx packages/core/scripts/build-launchpad-economics.ts
```

Read-only and slow (public mainnet RPC, about 40 minutes): ranks every DBC config by graduated launches and reads the top 200's pools into `src/features/launchpad-economics/launchpads.json`.

## Project layout

```
packages/core/                the lab's engine, shared by the site and the agent server
  src/core/launch-config      config ↔ SDK parameters, curve shapes, fee schedules, presets
  src/core/launch-simulator   offline replay with the DBC SDK's swap math, through graduation
  src/core/migrated-pool      the post-graduation DAMM v2 pool, priced with the DAMM v2 SDK
  src/core/sniper-scenario    seeded traders (snipers, patient bots, humans) and launch metrics
  src/core/config-search      goal-weighted search over fee schedules and curves
  src/core/config-deploy      createConfig + dry run
  src/core/onchain-config     on-chain config account → simulation parameters
  src/core/config-clone       a real config's parameters, adjusted and checked, for a new owner
  src/core/partner-branding   a launchpad's on-chain name, website and logo
  src/core/preset-royalty     an author's share of a launchpad's fees, through a Meteora fee-sharing vault
  src/core/pool-launch        a token launched on an existing config, with the creator's first buy
  src/core/fee-claim          claiming a pool's trading fees as partner, creator or royalty recipient
  src/core/…                  quote tokens, the volatility-fee tracker, graduated positions, shared math
                              (packages/core/README.md lists every module)
  src/features/config-report  a config's open risks, terms, real and simulated launches, as one report
  src/features/report-feed    the report for every snapshot launchpad, as static JSON files
  src/features/agent-handoff  the link an agent hands an owner, and its untrusted-input decoder
  src/features/…              comparison, editor, recommendation, sharing, wallet, on-chain lookup,
                              launchpad economics and income forecast, launch page
  src/workers                 the recommender's Web Worker
  src/mcp                     the lab's tools for AI agents, as an MCP server over stdio
  mcp-package/                the npm package that runs the bundled MCP server with npx
  scripts/build-mcp.ts        bundles the MCP server into mcp-package/server.mjs
  scripts/mainnet-replay-verify.ts  replays a real pool's swap history and compares it swap by swap
  scripts/devnet-verify.ts    live check against devnet
  scripts/devnet-clone-verify.ts        clones mainnet configs on devnet and compares them byte for byte
  scripts/devnet-royalty-verify.ts      deploys a royalty config on devnet and checks the split to the lamport
  scripts/build-launchpad-economics.ts  rebuilds the launchpad economics snapshot
  scripts/build-after-graduation.ts     adds each launchpad's income after graduation to that snapshot
apps/web/                     the single-page site (views, components, router), built on packages/core
  scripts/build-report-feed.ts  writes the report feed into the built site
apps/web-e2e/                 Playwright browser tests (fake wallet, mocked RPC)
apps/api/                     the hosted agent API (NestJS, Postgres), built on packages/core
  src/mcp                     the agent tools over MCP Streamable HTTP, with daily allowances
  src/accounts                wallet sign-in, accounts, API keys, plans and USDC payments
  src/watches                 watches and the background poller
  src/webhooks                webhook addresses, signed deliveries and retries
  src/usage                   tool calls per caller per UTC day
  drizzle/                    database migrations
libs/deploy-templates         vendored deploy trigger for the hosting platform (build output)
ops/deploy.mts                CI deploy step
```

## Built with

[Meteora DBC SDK](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk) · [Meteora DAMM v2 SDK](https://github.com/MeteoraAg/damm-v2-sdk) · `@solana/web3.js` · Wallet Standard · Vue 3 · Vite · Vitest · Playwright

Built for the Superteam Earn track *Best use of Meteora's Dynamic Bonding Curve* (Crypto World's Fair).

## License

MIT
