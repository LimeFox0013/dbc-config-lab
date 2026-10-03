/**
 * Builds the snapshot behind launchpad economics and the preset catalogue: ranks every DBC
 * config on mainnet by how many of its launches graduated, then for the top candidates
 * reads their pools (all, or an evenly spread sample) for launches, graduation, time to
 * graduate and bonding-curve fees per launch. Keeps configs priced in a token the lab can
 * price, with their account bytes so the app decodes them offline. Read-only, public RPC;
 * slow (one large scan of graduated pools, then a few reads per config).
 *
 *   npx tsx apps/web/scripts/build-launchpad-economics.ts
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import {
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { PoolConfig } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../src/core/config-deploy'
import {
  ADDRESS_BYTES,
  fromPoolConfig,
  VIRTUAL_POOL_LAYOUT,
} from '../src/core/onchain-config'
import { quoteTokenOfMint } from '../src/core/quote-token'
import { DbcAccount } from '../src/features/onchain-config'
import { fetchRealLaunches } from '../src/features/real-launches'
import { errorMessage, SolanaNetwork } from '../src/core/shared'
import { sleep } from './utils'

const CANDIDATES = 200
const REQUEST_GAP_MS = 1500
const OUTPUT = fileURLToPath(
  new URL(
    '../src/features/launchpad-economics/launchpads.json',
    import.meta.url,
  ),
)

const main = async () => {
  const connection = connectionFor(SolanaNetwork.Mainnet)
  const { program } = createDbcProgram(connection)
  const poolDiscriminator = program.coder.accounts.memcmp(
    DbcAccount.VirtualPool,
  ).bytes
  if (!poolDiscriminator) throw new Error('No pool discriminator')

  const graduatedPools = await connection.getProgramAccounts(
    DYNAMIC_BONDING_CURVE_PROGRAM_ID,
    {
      dataSlice: { offset: VIRTUAL_POOL_LAYOUT.config, length: ADDRESS_BYTES },
      filters: [
        { memcmp: { offset: 0, bytes: poolDiscriminator } },
        {
          memcmp: {
            offset: VIRTUAL_POOL_LAYOUT.isMigrated,
            bytes: bs58.encode(Uint8Array.from([1])),
          },
        },
      ],
    },
  )
  const graduatedByConfig = graduatedPools.reduce((counts, pool) => {
    const config = new PublicKey(pool.account.data).toBase58()
    return counts.set(config, (counts.get(config) ?? 0) + 1)
  }, new Map<string, number>())
  console.log(
    `${graduatedPools.length} graduated launches over ${graduatedByConfig.size} configs`,
  )

  const ranked = [...graduatedByConfig.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CANDIDATES)
  const kept = []
  for (const [address, graduated] of ranked) {
    await sleep(REQUEST_GAP_MS)
    const info = await connection.getAccountInfo(new PublicKey(address))
    if (!info) continue
    const config: PoolConfig = program.coder.accounts.decode(
      DbcAccount.PoolConfig,
      info.data,
    )
    const quoteToken = quoteTokenOfMint(
      config.quoteMint.toBase58(),
      SolanaNetwork.Mainnet,
    )
    if (!quoteToken) continue
    await sleep(REQUEST_GAP_MS)
    const result = await fetchRealLaunches(
      connection,
      address,
      fromPoolConfig(config),
      quoteToken,
    )
    if (!result.ok) {
      console.log(`skip ${address}: ${result.rejection}`)
      continue
    }
    const { launches } = result
    console.log(
      `${kept.length + 1}. ${address}: ${graduated} graduated of ${launches.totalPools}, median curve fees ${launches.medianCurveFees.toFixed(3)} SOL`,
    )
    kept.push({
      configAddress: address,
      graduated,
      launches: launches.totalPools,
      sampledPools: launches.sampledPools,
      completedShare: launches.completedShare,
      neverTradedShare: launches.neverTradedShare,
      medianSecondsToComplete: launches.medianSecondsToComplete,
      meanCurveFees: launches.meanCurveFees,
      medianCurveFees: launches.medianCurveFees,
      p75CurveFees: launches.p75CurveFees,
      configBase64: info.data.toString('base64'),
    })
  }

  writeFileSync(
    OUTPUT,
    JSON.stringify(
      { takenAt: new Date().toISOString().slice(0, 10), launchpads: kept },
      null,
      1,
    ) + '\n',
  )
  console.log(`wrote ${kept.length} launchpads to ${OUTPUT}`)
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
