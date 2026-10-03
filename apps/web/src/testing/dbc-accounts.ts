/**
 * Test support: DBC account bytes exactly as the program stores them, for tests that answer
 * RPC reads. Anchor's own account encoder writes into a fixed 1000-byte buffer (upstream
 * TODO), too small for a PoolConfig, so accounts are encoded with the IDL layout directly.
 */
import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import { BorshAccountsCoder } from '@coral-xyz/anchor'
import { IdlCoder } from '@coral-xyz/anchor/dist/cjs/coder/borsh/idl'
import { createDbcProgram } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type {
  ConfigParameters,
  VirtualPool,
} from '@meteora-ag/dynamic-bonding-curve-sdk'
import { connectionFor } from '../core/config-deploy'
import { toInitialPool, toPoolConfig } from '../core/launch-simulator/utils'
import { QUOTE_TOKENS, QuoteToken } from '../core/quote-token'
import { SolanaNetwork } from '../core/shared'
import { DbcAccount } from '../features/onchain-config'

/** Stored curves are fixed arrays of 20 points; unused ones are zero. */
const STORED_CURVE_POINTS = 20
const FIXTURE_BUFFER_BYTES = 8192

const { program } = createDbcProgram(connectionFor(SolanaNetwork.Devnet))
const accountsCoder = new BorshAccountsCoder(program.idl)

/** Account bytes: discriminator, then the Borsh layout. */
export const encodeAccount = (name: DbcAccount, value: unknown): Buffer => {
  const typeDef = program.idl.types?.find((t) => t.name === name)
  if (!typeDef) throw new Error(`no IDL type ${name}`)
  const layout = IdlCoder.typeDefLayout({
    typeDef,
    types: program.idl.types ?? [],
  })
  const buffer = Buffer.alloc(FIXTURE_BUFFER_BYTES)
  const length = layout.encode(value, buffer)
  return Buffer.concat([
    accountsCoder.accountDiscriminator(name),
    buffer.subarray(0, length),
  ])
}

export const SOL_MINT = new PublicKey(
  QUOTE_TOKENS[QuoteToken.Sol].mints[SolanaNetwork.Mainnet],
)

export const configAccountData = (
  parameters: ConfigParameters,
  quoteMint = SOL_MINT,
): Buffer => {
  const config = { ...toPoolConfig(parameters), quoteMint }
  const padding = Array.from(
    { length: STORED_CURVE_POINTS - config.curve.length },
    () => ({ sqrtPrice: new BN(0), liquidity: new BN(0) }),
  )
  return encodeAccount(DbcAccount.PoolConfig, {
    ...config,
    curve: [...config.curve, ...padding],
  })
}

/** A fresh pool on `configAddress`, with any pool-state fields overridden. */
export const poolAccountData = (
  parameters: ConfigParameters,
  configAddress: PublicKey,
  state: Partial<VirtualPool['poolState']> = {},
): Buffer => {
  const pool = toInitialPool(parameters)
  return encodeAccount(DbcAccount.VirtualPool, {
    poolState: { ...pool.poolState, config: configAddress, ...state },
  })
}
