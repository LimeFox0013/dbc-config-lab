/**
 * Opt-in live check that cloning reproduces a real launchpad config: reads mainnet config
 * accounts, clones each unchanged onto devnet through the same code the UI uses, then
 * compares the two accounts byte for byte. Only the fee claimer and leftover receiver may
 * differ (they become the cloner's wallet), and the quote mint for tokens whose devnet mint
 * is a different address. Devnet only; the keypair file must already hold devnet SOL.
 *
 *   npx tsx apps/web/scripts/devnet-clone-verify.ts <keypair.json> <mainnet config>...
 */
import { readFileSync } from 'node:fs'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createDbcProgram } from '@meteora-ag/dynamic-bonding-curve-sdk'
import type { PoolConfig } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { clonedParameters } from '../src/core/config-clone'
import {
  connectionFor,
  prepareParametersDeployment,
} from '../src/core/config-deploy'
import {
  ADDRESS_BYTES,
  fromPoolConfig,
  POOL_CONFIG_LAYOUT,
} from '../src/core/onchain-config'
import { quoteTokenOfMint } from '../src/core/quote-token'
import { DbcAccount } from '../src/features/onchain-config'
import { errorMessage, SolanaNetwork } from '../src/core/shared'

/** PoolConfig byte ranges a clone is expected to change. */
const QUOTE_MINT = [
  POOL_CONFIG_LAYOUT.quoteMint,
  POOL_CONFIG_LAYOUT.quoteMint + ADDRESS_BYTES,
] as const
const OWNED_BY_CLONER = [
  POOL_CONFIG_LAYOUT.feeClaimer,
  POOL_CONFIG_LAYOUT.leftoverReceiver + ADDRESS_BYTES,
] as const

const inRange = (offset: number, [start, end]: readonly [number, number]) =>
  offset >= start && offset < end

const main = async () => {
  const [keypairPath, ...addresses] = process.argv.slice(2)
  if (!keypairPath || addresses.length === 0)
    throw new Error(
      'usage: devnet-clone-verify.ts <keypair.json> <mainnet config>...',
    )
  const owner = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))),
  )
  const mainnet = connectionFor(SolanaNetwork.Mainnet)
  const devnet = connectionFor(SolanaNetwork.Devnet)
  const { program } = createDbcProgram(mainnet)

  const results = []
  for (const address of addresses) {
    const original = await mainnet.getAccountInfo(new PublicKey(address))
    if (!original) throw new Error(`${address}: not found on mainnet`)
    const config: PoolConfig = program.coder.accounts.decode(
      DbcAccount.PoolConfig,
      original.data,
    )
    const quoteToken = quoteTokenOfMint(
      config.quoteMint.toBase58(),
      SolanaNetwork.Mainnet,
    )
    if (!quoteToken) throw new Error(`${address}: unsupported quote token`)
    const clone = clonedParameters(fromPoolConfig(config), {})
    if (!clone.ok) {
      results.push({ address, ok: false, detail: `refused: ${clone.reason}` })
      continue
    }
    const prepared = await prepareParametersDeployment(devnet, {
      parameters: clone.parameters,
      quoteToken,
      network: SolanaNetwork.Devnet,
      owner: owner.publicKey,
    })
    if (!prepared.ok) throw new Error(`${address}: ${prepared.reason}`)
    const { transaction, summary } = prepared.deployment
    transaction.partialSign(owner)
    const signature = await devnet.sendRawTransaction(transaction.serialize())
    await devnet.confirmTransaction(signature, 'confirmed')

    const copy = await devnet.getAccountInfo(
      new PublicKey(summary.configAddress),
      'confirmed',
    )
    if (!copy) throw new Error(`${address}: clone not found on devnet`)
    const quoteMintMoved = !config.quoteMint.equals(
      new PublicKey(summary.quoteMint),
    )
    const differing = [...original.data.keys()].filter(
      (offset) =>
        original.data[offset] !== copy.data[offset] &&
        !inRange(offset, OWNED_BY_CLONER) &&
        !(quoteMintMoved && inRange(offset, QUOTE_MINT)),
    )
    const ok =
      copy.data.length === original.data.length && differing.length === 0
    results.push({
      address,
      ok,
      detail: ok
        ? `clone ${summary.configAddress} (tx ${signature}): ${copy.data.length} bytes identical outside the cloner's own fields`
        : `clone ${summary.configAddress}: ${copy.data.length}/${original.data.length} bytes, differing offsets ${differing.slice(0, 20).join(',')}`,
    })
  }
  results.forEach((r) =>
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.address} — ${r.detail}`),
  )
  console.log(
    `${results.filter((r) => r.ok).length}/${results.length} configs cloned exactly`,
  )
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
