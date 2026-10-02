/**
 * Opt-in, read-only check against a real pool: loads a DBC pool and its config from
 * mainnet, then replays every swap the pool ever executed — from its on-chain swap events —
 * through the simulator's own math, starting from a fresh pool, and compares each swap's
 * fees, output, price and quote reserve with what the program recorded. Given the DAMM v2
 * pool the launch migrated to, it then checks the simulator's migrated pool against the
 * one the program opened and replays that pool's swaps too; liquidity that LPs add or
 * remove later is applied as recorded, since it is a decision, not math. Public RPC only;
 * no keys, no transactions sent.
 *
 *   npx tsx apps/web/scripts/mainnet-replay-verify.ts <pool> [migrated pool]
 */
import BN from 'bn.js'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import {
  CP_AMM_PROGRAM_ID,
  cpAmmCoder,
  getFeeMode as getMigratedFeeMode,
  getSwapResultFromExactInput,
  getSwapResultFromExactOutput,
  getSwapResultFromPartialInput,
  TradeDirection as MigratedTradeDirection,
} from '@meteora-ag/cp-amm-sdk'
import type { SwapResult2 as MigratedSwapResult } from '@meteora-ag/cp-amm-sdk'
import {
  ActivationType,
  createDbcProgram,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  getFeeMode,
  swapQuoteExactIn,
  swapQuoteExactOut,
  swapQuotePartialFill,
  TradeDirection,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  SwapQuote2Result,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor, SolanaNetwork } from '../src/core/config-deploy'
import { toMigratedPool } from '../src/core/migrated-pool'
import type { MigratedPool } from '../src/core/migrated-pool'
import { loadOnChainConfig } from '../src/features/onchain-config'
import {
  nextQuoteReserve,
  toInitialPool,
  toPoolConfig,
  trackerAfterSwap,
  trackerBeforeSwap,
} from '../src/core/launch-simulator/utils'

const SIGNATURE_PAGE = 1000
const MAX_SIGNATURES = 5000
const REQUEST_GAP_MS = 1200
const MAX_ATTEMPTS = 8
const RETRY_BACKOFF_MS = 2000
const HTTP_TOO_MANY_REQUESTS = 429
const PROGRAM_DATA_PREFIX = 'Program data: '
/** Anchor's self-CPI event instructions start with this 8-byte tag. */
const EVENT_IX_TAG = Buffer.from('e445a52e51cb9a1d', 'hex')
const LEGACY_SWAP_EVENT = 'evtSwap'
const SWAP_EVENTS = new Set([
  LEGACY_SWAP_EVENT,
  'evtSwap2',
  'evtSwap2WithTransferHook',
])
const REPORTED_MISMATCHES = 12
/** Newest transaction format the RPC returns when asked. */
const MAX_TRANSACTION_VERSION = 1
const MIGRATED_SWAP_EVENT = 'EvtSwap2'
const MIGRATED_INIT_EVENT = 'EvtInitializePool'
const MIGRATED_LIQUIDITY_EVENT = 'EvtLiquidityChange'

/** DAMM v2 EvtLiquidityChange.change_type. */
enum LiquidityChange {
  Add = 0,
  Remove = 1,
}

enum SwapMode {
  ExactIn = 0,
  PartialFill = 1,
  ExactOut = 2,
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const field = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined

const bnField = (value: unknown, key: string): BN => {
  const found = field(value, key)
  if (BN.isBN(found)) return found
  throw new Error(`Expected a number at ${key}`)
}

const numberField = (value: unknown, key: string): number => {
  const found = field(value, key)
  if (typeof found === 'number') return found
  throw new Error(`Expected a number at ${key}`)
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const recordList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const rpc = async (
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<unknown> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      await sleep(RETRY_BACKOFF_MS * attempt)
      continue
    }
    const body: unknown = await response.json()
    const error = field(body, 'error')
    if (error !== undefined)
      throw new Error(`${method}: ${JSON.stringify(error)}`)
    return field(body, 'result')
  }
  throw new Error(
    `${method}: still rate limited after ${MAX_ATTEMPTS} attempts`,
  )
}

/** Successful signatures touching `address`, oldest first. */
const signaturesOf = async (
  endpoint: string,
  address: string,
): Promise<string[]> => {
  const collected: string[] = []
  let before: string | undefined
  while (collected.length < MAX_SIGNATURES) {
    const page = recordList(
      await rpc(endpoint, 'getSignaturesForAddress', [
        address,
        { limit: SIGNATURE_PAGE, ...(before ? { before } : {}) },
      ]),
    )
    collected.push(
      ...page
        .filter((entry) => entry.err === null)
        .map((entry) => String(entry.signature)),
    )
    if (page.length < SIGNATURE_PAGE) break
    before = String(page[page.length - 1]?.signature)
    await sleep(REQUEST_GAP_MS)
  }
  return collected.reverse()
}

interface SwapEvent {
  name: string
  data: unknown
  slot: number
}

/**
 * One program's events in a transaction, in emission order. Programs emit each event both
 * as a log line and as a self-CPI; the self-CPI copy is used when present (logs can be
 * truncated).
 */
const eventsOf = (
  transaction: unknown,
  programId: PublicKey,
  decode: (base64: string) => { name: string; data: unknown } | null,
): SwapEvent[] => {
  const slot = numberField(transaction, 'slot')
  const meta = field(transaction, 'meta')
  const message = field(field(transaction, 'transaction'), 'message')
  const loaded = field(meta, 'loadedAddresses')
  const keys = [
    ...stringList(field(message, 'accountKeys')),
    ...stringList(field(loaded, 'writable')),
    ...stringList(field(loaded, 'readonly')),
  ]
  const program = programId.toBase58()

  const fromLogs = stringList(field(meta, 'logMessages'))
    .filter((line) => line.startsWith(PROGRAM_DATA_PREFIX))
    .map((line) => decode(line.slice(PROGRAM_DATA_PREFIX.length)))

  const fromCpi = recordList(field(meta, 'innerInstructions'))
    .flatMap((group) => recordList(group.instructions))
    .filter((ix) => keys[Number(ix.programIdIndex)] === program)
    .map((ix) => Buffer.from(bs58.decode(String(ix.data))))
    .filter((data) =>
      data.subarray(0, EVENT_IX_TAG.length).equals(EVENT_IX_TAG),
    )
    .map((data) =>
      decode(data.subarray(EVENT_IX_TAG.length).toString('base64')),
    )

  return (fromCpi.length > 0 ? fromCpi : fromLogs)
    .filter((event): event is { name: string; data: unknown } => event !== null)
    .map((event) => ({ ...event, slot }))
}

const quoteFor = (
  pool: VirtualPool,
  config: ReturnType<typeof toPoolConfig>,
  event: SwapEvent,
  point: BN,
): SwapQuote2Result => {
  const baseForQuote =
    numberField(event.data, 'tradeDirection') === TradeDirection.BaseToQuote
  const hasReferral = field(event.data, 'hasReferral') === true
  if (event.name === LEGACY_SWAP_EVENT) {
    const amountIn = bnField(field(event.data, 'params'), 'amountIn')
    return swapQuoteExactIn(
      pool,
      config,
      baseForQuote,
      amountIn,
      0,
      hasReferral,
      point,
      false,
    )
  }
  const parameters = field(event.data, 'swapParameters')
  const amount = bnField(parameters, 'amount0')
  switch (numberField(parameters, 'swapMode')) {
    case SwapMode.ExactIn:
      return swapQuoteExactIn(
        pool,
        config,
        baseForQuote,
        amount,
        0,
        hasReferral,
        point,
        false,
      )
    case SwapMode.PartialFill:
      return swapQuotePartialFill(
        pool,
        config,
        baseForQuote,
        amount,
        0,
        hasReferral,
        point,
        false,
      )
    case SwapMode.ExactOut:
      return swapQuoteExactOut(
        pool,
        config,
        baseForQuote,
        amount,
        0,
        hasReferral,
        point,
        false,
      )
    default:
      throw new Error('Unknown swap mode')
  }
}

const migratedQuoteFor = (
  pool: MigratedPool,
  data: unknown,
  point: BN,
): MigratedSwapResult => {
  const direction =
    numberField(data, 'trade_direction') === MigratedTradeDirection.AtoB
      ? MigratedTradeDirection.AtoB
      : MigratedTradeDirection.BtoA
  const feeMode = getMigratedFeeMode(
    pool.collectFeeMode,
    direction,
    field(data, 'has_referral') === true,
  )
  const recorded = field(data, 'swap_result')
  // The amounts the swap math saw, after any token transfer fee.
  const amountIn = bnField(recorded, 'included_fee_input_amount').add(
    bnField(recorded, 'amount_left'),
  )
  switch (numberField(field(data, 'params'), 'swap_mode')) {
    case SwapMode.ExactIn:
      return getSwapResultFromExactInput(
        pool,
        amountIn,
        feeMode,
        direction,
        point,
      )
    case SwapMode.PartialFill:
      return getSwapResultFromPartialInput(
        pool,
        amountIn,
        feeMode,
        direction,
        point,
      )
    case SwapMode.ExactOut:
      return getSwapResultFromExactOutput(
        pool,
        bnField(recorded, 'output_amount'),
        feeMode,
        direction,
        point,
      )
    default:
      throw new Error('Unknown swap mode')
  }
}

/**
 * Replays the DAMM v2 pool a launch migrated to, starting from the simulator's own migrated
 * pool: its liquidity must equal the program's once the migration transaction completes,
 * and every swap after that must match.
 */
const replayMigratedPool = async (
  endpoint: string,
  address: string,
  pool: MigratedPool,
): Promise<{ swaps: number; mismatches: string[] }> => {
  const decode = (base64: string) => {
    try {
      return cpAmmCoder.events.decode(base64)
    } catch {
      return null
    }
  }
  const signatures = await signaturesOf(endpoint, address)
  console.log(
    `Migrated pool ${address}: ${signatures.length} successful transactions; fetching…`,
  )

  const mismatches: string[] = []
  let state = pool
  let chainLiquidity: BN | null = null
  let opened = false
  let swaps = 0

  for (const signature of signatures) {
    await sleep(REQUEST_GAP_MS)
    const transaction = await rpc(endpoint, 'getTransaction', [
      signature,
      {
        encoding: 'json',
        maxSupportedTransactionVersion: MAX_TRANSACTION_VERSION,
        commitment: 'confirmed',
      },
    ])
    const events = eventsOf(transaction, CP_AMM_PROGRAM_ID, decode).filter(
      (event) => String(field(event.data, 'pool')) === address,
    )
    const opensHere = events.some((event) => event.name === MIGRATED_INIT_EVENT)

    for (const event of events) {
      if (event.name === MIGRATED_INIT_EVENT) {
        chainLiquidity = bnField(event.data, 'liquidity')
        state = {
          ...state,
          activationPoint: bnField(event.data, 'activation_point'),
        }
        continue
      }
      if (event.name === MIGRATED_LIQUIDITY_EVENT) {
        const delta = bnField(event.data, 'liquidity_delta')
        const signed =
          numberField(event.data, 'change_type') === LiquidityChange.Remove
            ? delta.neg()
            : delta
        chainLiquidity = (chainLiquidity ?? new BN(0)).add(signed)
        // Liquidity added inside the migration itself is part of what the simulator models.
        if (opened) state = { ...state, liquidity: state.liquidity.add(signed) }
        continue
      }
      if (event.name !== MIGRATED_SWAP_EVENT) continue

      swaps++
      const point = bnField(event.data, 'current_timestamp')
      const recorded = field(event.data, 'swap_result')
      try {
        const quote = migratedQuoteFor(state, event.data, point)
        const pairs: Array<[string, BN, BN]> = [
          ['claimingFee', quote.claimingFee, bnField(recorded, 'claiming_fee')],
          ['protocolFee', quote.protocolFee, bnField(recorded, 'protocol_fee')],
          ['referralFee', quote.referralFee, bnField(recorded, 'referral_fee')],
          [
            'outputAmount',
            quote.outputAmount,
            bnField(recorded, 'output_amount'),
          ],
          [
            'nextSqrtPrice',
            quote.nextSqrtPrice,
            bnField(recorded, 'next_sqrt_price'),
          ],
        ]
        pairs
          .filter(([, ours, chain]) => !ours.eq(chain))
          .forEach(([name, ours, chain]) =>
            mismatches.push(
              `migrated swap ${swaps} (${signature.slice(0, 12)}…) ${name}: simulated ${ours} on-chain ${chain}`,
            ),
          )
      } catch (error) {
        mismatches.push(
          `migrated swap ${swaps} (${signature.slice(0, 12)}…): quote failed (${error instanceof Error ? error.message : String(error)})`,
        )
      }
      // Continue from the chain's own price so one mismatch cannot cascade.
      state = { ...state, sqrtPrice: bnField(recorded, 'next_sqrt_price') }
    }

    if (opensHere) {
      opened = true
      if (!chainLiquidity || !state.liquidity.eq(chainLiquidity))
        mismatches.push(
          `migrated pool liquidity after migration: simulated ${state.liquidity} on-chain ${chainLiquidity ?? 'missing'}`,
        )
    }
  }
  if (!opened)
    mismatches.push('migration transaction not found in the pool history')
  return { swaps, mismatches }
}

const main = async () => {
  const address = process.argv[2]
  if (!address)
    throw new Error('Usage: mainnet-replay-verify.ts <pool address>')
  const connection = connectionFor(SolanaNetwork.Mainnet)
  const { program } = createDbcProgram(connection)

  const loaded = await loadOnChainConfig(
    connection,
    SolanaNetwork.Mainnet,
    address,
  )
  if (!loaded.ok) throw new Error(`Load refused: ${loaded.rejection}`)
  const parameters = loaded.loaded.parameters
  const config = toPoolConfig(parameters)
  const poolInfo = await connection.getAccountInfo(new PublicKey(address))
  if (!poolInfo) throw new Error('Pool not found')
  const chainPool: VirtualPool = program.coder.accounts.decode(
    'virtualPool',
    poolInfo.data,
  )
  const dynamicFee = config.poolFees.dynamicFee.initialized !== 0
  console.log(
    `Pool ${address} · config ${loaded.loaded.configAddress} · dynamic fee ${dynamicFee ? 'on' : 'off'} · collect fee mode ${config.collectFeeMode}`,
  )

  const decode = (base64: string) => {
    try {
      return program.coder.events.decode(base64)
    } catch {
      return null
    }
  }

  const signatures = await signaturesOf(connection.rpcEndpoint, address)
  console.log(`${signatures.length} successful transactions; fetching…`)

  const initial = toInitialPool(parameters)
  let pool: VirtualPool = {
    poolState: {
      ...initial.poolState,
      activationPoint: chainPool.poolState.activationPoint,
    },
  }
  const mismatches: string[] = []
  let swaps = 0

  for (const signature of signatures) {
    await sleep(REQUEST_GAP_MS)
    const transaction = await rpc(connection.rpcEndpoint, 'getTransaction', [
      signature,
      {
        encoding: 'json',
        maxSupportedTransactionVersion: MAX_TRANSACTION_VERSION,
        commitment: 'confirmed',
      },
    ])
    const poolEvents = eventsOf(
      transaction,
      DYNAMIC_BONDING_CURVE_PROGRAM_ID,
      decode,
    ).filter(
      (event) =>
        SWAP_EVENTS.has(event.name) &&
        String(field(event.data, 'pool')) === address,
    )
    // Current program versions emit the legacy EvtSwap alongside EvtSwap2 for each swap.
    const hasSwap2 = poolEvents.some(
      (event) => event.name !== LEGACY_SWAP_EVENT,
    )
    const events = poolEvents.filter(
      (event) => !hasSwap2 || event.name !== LEGACY_SWAP_EVENT,
    )
    for (const event of events) {
      swaps++
      const timestamp = bnField(event.data, 'currentTimestamp')
      const point =
        config.activationType === ActivationType.Timestamp
          ? timestamp
          : new BN(event.slot)
      const state = pool.poolState
      const tracker = dynamicFee
        ? trackerBeforeSwap(
            state.volatilityTracker,
            config.poolFees.dynamicFee,
            state.sqrtPrice,
            timestamp,
          )
        : state.volatilityTracker
      const before: VirtualPool = {
        poolState: { ...state, volatilityTracker: tracker },
      }
      const recorded = field(event.data, 'swapResult')
      let quoteReserve = state.quoteReserve
      let quote: SwapQuote2Result | null = null
      try {
        quote = quoteFor(before, config, event, point)
      } catch (error) {
        mismatches.push(
          `swap ${swaps} (${signature.slice(0, 12)}…) ${event.name}: quote failed (${error instanceof Error ? error.message : String(error)}) at simulated sqrt price ${state.sqrtPrice}`,
        )
      }
      if (quote) {
        const pairs: Array<[string, BN, BN]> = [
          ['tradingFee', quote.tradingFee, bnField(recorded, 'tradingFee')],
          ['protocolFee', quote.protocolFee, bnField(recorded, 'protocolFee')],
          ['referralFee', quote.referralFee, bnField(recorded, 'referralFee')],
          [
            'outputAmount',
            quote.outputAmount,
            bnField(recorded, 'outputAmount'),
          ],
          [
            'nextSqrtPrice',
            quote.nextSqrtPrice,
            bnField(recorded, 'nextSqrtPrice'),
          ],
        ]
        const isBuy =
          numberField(event.data, 'tradeDirection') ===
          TradeDirection.QuoteToBase
        const feeMode = getFeeMode(
          config.collectFeeMode,
          isBuy ? TradeDirection.QuoteToBase : TradeDirection.BaseToQuote,
          field(event.data, 'hasReferral') === true,
        )
        quoteReserve = nextQuoteReserve(
          before,
          quote,
          isBuy,
          feeMode.feesOnInput,
        )
        if (event.name !== LEGACY_SWAP_EVENT)
          pairs.push([
            'quoteReserve',
            quoteReserve,
            bnField(event.data, 'quoteReserveAmount'),
          ])
        pairs
          .filter(([, ours, chain]) => !ours.eq(chain))
          .forEach(([name, ours, chain]) =>
            mismatches.push(
              `swap ${swaps} (${signature.slice(0, 12)}…) ${name}: simulated ${ours} on-chain ${chain}`,
            ),
          )
      }

      // Continue from the chain's own price so one mismatch cannot cascade.
      const sqrtPriceAfter = bnField(recorded, 'nextSqrtPrice')
      pool = {
        poolState: {
          ...state,
          sqrtPrice: sqrtPriceAfter,
          quoteReserve:
            event.name === LEGACY_SWAP_EVENT
              ? quoteReserve
              : bnField(event.data, 'quoteReserveAmount'),
          volatilityTracker: dynamicFee
            ? trackerAfterSwap(
                tracker,
                config.poolFees.dynamicFee,
                state.sqrtPrice,
                sqrtPriceAfter,
                timestamp,
              )
            : tracker,
        },
      }
    }
  }

  console.log(
    `${swaps} swaps replayed; ${mismatches.length} mismatching values`,
  )

  const migratedAddress = process.argv[3]
  const migrated = migratedAddress
    ? await replayMigratedPool(
        connection.rpcEndpoint,
        migratedAddress,
        toMigratedPool(parameters, config),
      )
    : { swaps: 0, mismatches: [] }
  if (migratedAddress)
    console.log(
      `${migrated.swaps} migrated-pool swaps replayed; ${migrated.mismatches.length} mismatching values`,
    )

  const all = [...mismatches, ...migrated.mismatches]
  all.slice(0, REPORTED_MISMATCHES).forEach((line) => console.log(`  ${line}`))
  process.exitCode = swaps > 0 && all.length === 0 ? 0 : 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
