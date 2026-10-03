/**
 * Opt-in live check against Solana devnet (no real funds): deploys a flat-fee config with
 * the same code the UI uses, then verifies the simulator against the chain —
 * the stored config account, and pool reserve, price and fee totals after real swaps.
 * The throwaway keypair lives in memory only.
 *
 *   npx tsx apps/web/scripts/devnet-verify.ts
 */
import BN from 'bn.js'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import type { Connection, Transaction } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '../src/core/launch-config'
import {
  connectionFor,
  prepareDeployment,
  SolanaNetwork,
} from '../src/core/config-deploy'
import { simulateLaunch, TradeSide } from '../src/core/launch-simulator'
import type { Trade } from '../src/core/launch-simulator'
import { toPoolConfig } from '../src/core/launch-simulator/utils'
import { preparePoolLaunch } from '../src/core/pool-launch'
import { QuoteToken, quoteUnitsFromSol } from '../src/core/quote-token'

const AIRDROP_SOL = 1
const FUNDING_WAIT_MS = 15 * 60 * 1000
const FUNDING_POLL_MS = 5000
const MIN_BALANCE_LAMPORTS = 0.3 * LAMPORTS_PER_SOL
/** The creator's first buy, made in the transaction that creates the pool. */
const FIRST_BUY_SOL = 0.05
const BUYS_SOL = [0.1, 0.05]

const results: Array<{ check: string; ok: boolean; detail: string }> = []
const check = (
  name: string,
  expected: { toString(): string },
  actual: { toString(): string },
) => {
  const ok = expected.toString() === actual.toString()
  results.push({
    check: name,
    ok,
    detail: ok ? String(actual) : `expected ${expected} got ${actual}`,
  })
}

const send = (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
) =>
  sendAndConfirmTransaction(connection, transaction, signers, {
    commitment: 'confirmed',
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Faucet airdrop when available; otherwise wait for the address to be funded by hand. */
const fund = async (connection: Connection, address: PublicKey) => {
  try {
    const signature = await connection.requestAirdrop(
      address,
      AIRDROP_SOL * LAMPORTS_PER_SOL,
    )
    await connection.confirmTransaction(signature, 'confirmed')
    return
  } catch {
    console.log(
      `Airdrop unavailable. Send >= 0.3 devnet SOL to ${address.toBase58()} (https://faucet.solana.com)`,
    )
  }
  const deadline = Date.now() + FUNDING_WAIT_MS
  while (Date.now() < deadline) {
    if ((await connection.getBalance(address)) >= MIN_BALANCE_LAMPORTS) return
    await sleep(FUNDING_POLL_MS)
  }
  throw new Error('address was not funded in time')
}

const main = async () => {
  const connection = connectionFor(SolanaNetwork.Devnet)
  const client = new DynamicBondingCurveClient(connection, 'confirmed')
  const owner = Keypair.generate()

  await fund(connection, owner.publicKey)
  console.log('funded', owner.publicKey.toBase58())

  // 1. Deploy through the UI's code path.
  const prepared = await prepareDeployment(connection, {
    config: DEFAULT_LAUNCH_CONFIG,
    network: SolanaNetwork.Devnet,
    owner: owner.publicKey,
  })
  if (!prepared.ok) throw new Error(`prepare failed: ${prepared.reason}`)
  const { transaction, summary } = prepared.deployment
  transaction.partialSign(owner)
  const deploySig = await connection.sendRawTransaction(transaction.serialize())
  await connection.confirmTransaction(deploySig, 'confirmed')
  console.log('config', summary.configAddress, 'tx', deploySig)

  // 2. Stored config vs the simulator's PoolConfig.
  const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
  if (!compiled.ok) throw new Error(compiled.reason)
  const local = toPoolConfig(compiled.parameters)
  const configAddress = new PublicKey(summary.configAddress)
  const chain = await client.state.getPoolConfig(configAddress)
  if (!chain) throw new Error('config account not found on chain')
  check('config.sqrtStartPrice', local.sqrtStartPrice, chain.sqrtStartPrice)
  check(
    'config.migrationSqrtPrice',
    local.migrationSqrtPrice,
    chain.migrationSqrtPrice,
  )
  check(
    'config.migrationQuoteThreshold',
    local.migrationQuoteThreshold,
    chain.migrationQuoteThreshold,
  )
  check(
    'config.cliffFeeNumerator',
    local.poolFees.baseFee.cliffFeeNumerator,
    chain.poolFees.baseFee.cliffFeeNumerator,
  )
  check('config.collectFeeMode', local.collectFeeMode, chain.collectFeeMode)
  check(
    'config.creatorTradingFeePercentage',
    local.creatorTradingFeePercentage,
    chain.creatorTradingFeePercentage,
  )
  local.curve.forEach((point, i) => {
    check(
      `config.curve[${i}].sqrtPrice`,
      point.sqrtPrice,
      chain.curve[i].sqrtPrice,
    )
    check(
      `config.curve[${i}].liquidity`,
      point.liquidity,
      chain.curve[i].liquidity,
    )
  })

  // 3. Launch a token through the UI's code path, first buy included, then real swaps
  //    vs the simulator's replay.
  const launched = await preparePoolLaunch(connection, {
    configAddress,
    parameters: compiled.parameters,
    quoteToken: QuoteToken.Sol,
    network: SolanaNetwork.Devnet,
    owner: owner.publicKey,
    metadata: {
      name: 'DBC Config Lab check',
      symbol: 'DCLCHK',
      uri: 'https://example.com/dcl.json',
    },
    firstBuy: FIRST_BUY_SOL,
  })
  if (!launched.ok) throw new Error(`launch failed: ${launched.reason}`)
  launched.launch.transaction.partialSign(owner)
  const launchSig = await connection.sendRawTransaction(
    launched.launch.transaction.serialize(),
  )
  await connection.confirmTransaction(launchSig, 'confirmed')
  const poolAddress = new PublicKey(launched.launch.summary.poolAddress)
  console.log('pool', poolAddress.toBase58(), 'tx', launchSig)

  const trades: Trade[] = []
  const chainStates: Array<{ quoteReserve: BN; sqrtPrice: BN }> = []
  const recordChainState = async () => {
    const pool = await client.state.getPool(poolAddress)
    if (!pool) throw new Error('pool account not found on chain')
    chainStates.push({
      quoteReserve: pool.poolState.quoteReserve,
      sqrtPrice: pool.poolState.sqrtPrice,
    })
  }
  trades.push({
    at: 0,
    side: TradeSide.Buy,
    amountIn: quoteUnitsFromSol(FIRST_BUY_SOL, QuoteToken.Sol),
    trader: 'owner',
  })
  await recordChainState()
  const swap = async (side: TradeSide.Buy | TradeSide.Sell, amountIn: BN) => {
    const tx = await client.pool.swap({
      owner: owner.publicKey,
      amountIn,
      minimumAmountOut: new BN(0),
      swapBaseForQuote: side === TradeSide.Sell,
      pool: poolAddress,
      referralTokenAccount: null,
    })
    await send(connection, tx, [owner])
    trades.push({ at: trades.length, side, amountIn, trader: 'owner' })
    await recordChainState()
  }

  for (const sol of BUYS_SOL)
    await swap(TradeSide.Buy, new BN(sol * LAMPORTS_PER_SOL))
  const replayBuys = simulateLaunch(compiled.parameters, trades)
  const half = replayBuys.holdings['owner'].divn(2)
  await swap(TradeSide.Sell, half)

  const replay = simulateLaunch(compiled.parameters, trades)
  replay.outcomes.forEach((outcome, i) => {
    check(
      `swap[${i}].quoteReserve`,
      chainStates[i].quoteReserve,
      outcome.quoteReserveAfter,
    )
    check(
      `swap[${i}].sqrtPrice`,
      chainStates[i].sqrtPrice,
      outcome.sqrtPriceAfter,
    )
  })
  const finalPool = await client.state.getPool(poolAddress)
  if (!finalPool) throw new Error('pool account not found on chain')
  check(
    'fees.partnerQuote',
    finalPool.poolState.partnerQuoteFee,
    replay.fees.quote.partner,
  )
  check(
    'fees.creatorQuote',
    finalPool.poolState.creatorQuoteFee,
    replay.fees.quote.creator,
  )
  check(
    'fees.protocolQuote',
    finalPool.poolState.protocolQuoteFee,
    replay.fees.quote.protocol,
  )

  console.table(results)
  const failed = results.filter((r) => !r.ok)
  console.log(
    failed.length === 0
      ? `ALL ${results.length} CHECKS PASSED`
      : `${failed.length} CHECKS FAILED`,
  )
  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
