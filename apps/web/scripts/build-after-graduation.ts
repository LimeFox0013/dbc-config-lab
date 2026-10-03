/**
 * Adds income after graduation to the launchpad economics snapshot. A launchpad earns after
 * graduation only through the liquidity position the program gives its fee claimer; this
 * reads, for every fee claimer that keeps a share, its position NFTs, an even sample of up
 * to 500 positions, and each position's quote-token fees — claimed so far plus pending —
 * as one graduated launch's income. Fees taken in the launched token are not counted (a
 * stated lower bound). Read-only, public RPC.
 *
 *   npx tsx apps/web/scripts/build-after-graduation.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { PublicKey } from '@solana/web3.js'
import { createDbcProgram } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { PoolConfig } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../src/core/config-deploy'
import { heldPositionFees } from '../src/core/graduated-positions'
import { quoteTokenOfMint, solFromQuoteUnits } from '../src/core/quote-token'
import { errorMessage, SolanaNetwork } from '../src/core/shared'
import { AfterGraduationBasis } from '../src/features/launchpad-economics'
import type {
  AfterGraduation,
  LaunchpadSnapshot,
} from '../src/features/launchpad-economics'
import { DbcAccount } from '../src/features/onchain-config'
import { percentile } from '../src/features/real-launches'
import { sleep } from './utils'

const SNAPSHOT = fileURLToPath(
  new URL(
    '../src/features/launchpad-economics/launchpads.json',
    import.meta.url,
  ),
)
const POSITION_SAMPLE = 500
const REQUEST_GAP_MS = 1500
const MEDIAN = 0.5
const P75 = 0.75

const main = async () => {
  const connection = connectionFor(SolanaNetwork.Mainnet)
  const { program } = createDbcProgram(connection)
  const snapshot: LaunchpadSnapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))

  /** Per-launch quote fees (SOL) of the positions a fee claimer still holds, priced in `quoteMint`. */
  const incomeOf = async (
    feeClaimer: PublicKey,
    quoteMint: PublicKey,
  ): Promise<number[]> => {
    const quoteToken = quoteTokenOfMint(
      quoteMint.toBase58(),
      SolanaNetwork.Mainnet,
    )
    if (!quoteToken) return []
    const held = await heldPositionFees(
      connection,
      feeClaimer,
      quoteMint,
      POSITION_SAMPLE,
      () => sleep(REQUEST_GAP_MS),
    )
    return held.quoteFees.map((fees) => solFromQuoteUnits(fees, quoteToken))
  }

  const byClaimer = new Map<string, Promise<number[]>>()
  const launchpads = []
  for (const launchpad of snapshot.launchpads) {
    const config: PoolConfig = program.coder.accounts.decode(
      DbcAccount.PoolConfig,
      Buffer.from(launchpad.configBase64, 'base64'),
    )
    const share =
      config.partnerLiquidityPercentage +
      config.partnerPermanentLockedLiquidityPercentage +
      config.partnerLiquidityVestingInfo.vestingPercentage
    let afterGraduation: AfterGraduation
    if (share === 0) afterGraduation = { basis: AfterGraduationBasis.NoShare }
    else {
      const claimer = config.feeClaimer.toBase58()
      const key = `${claimer}:${config.quoteMint.toBase58()}`
      if (!byClaimer.has(key))
        byClaimer.set(key, incomeOf(config.feeClaimer, config.quoteMint))
      const values = await (byClaimer.get(key) ?? Promise.resolve([]))
      afterGraduation =
        values.length === 0
          ? { basis: AfterGraduationBasis.NotHeld }
          : {
              basis: AfterGraduationBasis.Positions,
              sampledPositions: values.length,
              median: percentile(values, MEDIAN),
              p75: percentile(values, P75),
            }
    }
    console.log(launchpad.configAddress, JSON.stringify(afterGraduation))
    launchpads.push({ ...launchpad, afterGraduation })
  }
  writeFileSync(
    SNAPSHOT,
    JSON.stringify({ ...snapshot, launchpads }, null, 1) + '\n',
  )
  console.log(
    `wrote income after graduation for ${launchpads.length} launchpads`,
  )
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
