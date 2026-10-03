/**
 * Opt-in live check that preset royalties are split on chain as the app says: deploys a
 * flat-fee config whose fees go to a Meteora fee-sharing vault (the deployer keeps 90%, a
 * fresh author wallet gets 10%) through the same code the UI uses, launches a token on it
 * with a first buy, has the vault claim the launchpad's trading fees, then has the author
 * claim their share — every amount compared to the lamport. Devnet only; the keypair file
 * must already hold devnet SOL.
 *
 *   npx tsx apps/web/scripts/devnet-royalty-verify.ts <keypair.json>
 */
import { readFileSync } from 'node:fs'
import BN from 'bn.js'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { DynamicFeeSharingClient } from '@meteora-ag/dynamic-fee-sharing-sdk'
import {
  connectionFor,
  prepareParametersDeployment,
} from '../src/core/config-deploy'
import {
  compileLaunchConfig,
  DEFAULT_LAUNCH_CONFIG,
} from '../src/core/launch-config'
import { preparePoolLaunch } from '../src/core/pool-launch'
import { QuoteToken } from '../src/core/quote-token'
import { errorMessage, SolanaNetwork } from '../src/core/shared'

const AUTHOR_PERCENT = 10
const FIRST_BUY_SOL = 0.05
/** Enough for the author to pay for their own claim. */
const AUTHOR_FUNDING_SOL = 0.01
const COMMITMENT = 'confirmed'

const results: Array<{ check: string; ok: boolean; detail: string }> = []
const check = (name: string, expected: BN, actual: BN) => {
  const ok = expected.eq(actual)
  results.push({
    check: name,
    ok,
    detail: ok ? actual.toString() : `expected ${expected} got ${actual}`,
  })
}

const send = (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
): Promise<string> =>
  sendAndConfirmTransaction(connection, transaction, signers, {
    commitment: COMMITMENT,
  })

const main = async () => {
  const [keypairPath] = process.argv.slice(2)
  if (!keypairPath)
    throw new Error('usage: devnet-royalty-verify.ts <keypair.json>')
  const deployer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))),
  )
  const author = Keypair.generate()
  const connection = connectionFor(SolanaNetwork.Devnet)
  const dbc = new DynamicBondingCurveClient(connection, COMMITMENT)
  const dfs = new DynamicFeeSharingClient(connection, COMMITMENT)

  await send(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: deployer.publicKey,
        toPubkey: author.publicKey,
        lamports: AUTHOR_FUNDING_SOL * LAMPORTS_PER_SOL,
      }),
    ),
    [deployer],
  )

  // 1. Vault and config in one transaction, through the UI's code path.
  const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
  if (!compiled.ok) throw new Error(compiled.reason)
  const prepared = await prepareParametersDeployment(connection, {
    parameters: compiled.parameters,
    quoteToken: QuoteToken.Sol,
    network: SolanaNetwork.Devnet,
    owner: deployer.publicKey,
    royalty: {
      author: author.publicKey.toBase58(),
      sharePercent: AUTHOR_PERCENT,
    },
  })
  if (!prepared.ok) throw new Error(`prepare failed: ${prepared.reason}`)
  const { transaction, summary } = prepared.deployment
  if (!summary.royalty) throw new Error('summary shows no royalty')
  transaction.partialSign(deployer)
  const deploySig = await connection.sendRawTransaction(transaction.serialize())
  await connection.confirmTransaction(deploySig, COMMITMENT)
  const configAddress = new PublicKey(summary.configAddress)
  const vault = new PublicKey(summary.royalty.vault)
  console.log(
    'config',
    configAddress.toBase58(),
    'vault',
    vault.toBase58(),
    'tx',
    deploySig,
  )

  const config = await dbc.state.getPoolConfig(configAddress)
  if (!config) throw new Error('config not found')
  results.push({
    check: 'config.feeClaimer is the vault',
    ok: config.feeClaimer.equals(vault),
    detail: config.feeClaimer.toBase58(),
  })
  const vaultState = await dfs.getFeeVault(vault)
  results.push({
    check: 'vault shares are deployer 90 / author 10',
    ok:
      vaultState.users[0]?.address.equals(deployer.publicKey) === true &&
      vaultState.users[0]?.share === 100 - AUTHOR_PERCENT &&
      vaultState.users[1]?.address.equals(author.publicKey) === true &&
      vaultState.users[1]?.share === AUTHOR_PERCENT,
    detail: vaultState.users
      .slice(0, 2)
      .map((u) => `${u.address.toBase58()}:${u.share}`)
      .join(' '),
  })

  // 2. A token on that config, with a first buy that pays the launchpad's fee.
  const launched = await preparePoolLaunch(connection, {
    configAddress,
    parameters: compiled.parameters,
    quoteToken: QuoteToken.Sol,
    network: SolanaNetwork.Devnet,
    owner: deployer.publicKey,
    metadata: { name: 'Royalty check', symbol: 'RYLCHK', uri: '' },
    firstBuy: FIRST_BUY_SOL,
  })
  if (!launched.ok) throw new Error(`launch failed: ${launched.reason}`)
  launched.launch.transaction.partialSign(deployer)
  const launchSig = await connection.sendRawTransaction(
    launched.launch.transaction.serialize(),
  )
  await connection.confirmTransaction(launchSig, COMMITMENT)
  const poolAddress = new PublicKey(launched.launch.summary.poolAddress)
  console.log('pool', poolAddress.toBase58(), 'tx', launchSig)

  // 3. The vault claims the launchpad's fees; the deployer signs as a recipient.
  const before = await dbc.state.getPool(poolAddress)
  if (!before) throw new Error('pool not found')
  const owed = before.poolState.partnerQuoteFee
  const fund = await dfs.fundByClaimDbcPartnerTradingFee({
    signer: deployer.publicKey,
    feeClaimer: vault,
    feeVault: vault,
    poolConfig: configAddress,
    virtualPool: poolAddress,
  })
  const fundSig = await send(connection, fund, [deployer])
  console.log('vault funded from the pool, tx', fundSig)
  const funded = await dfs.getFeeBreakdown(vault)
  check(
    'vault received exactly what the pool owed the launchpad',
    owed,
    funded.totalFundedFee,
  )
  const after = await dbc.state.getPool(poolAddress)
  check(
    'pool owes the launchpad nothing after the claim',
    new BN(0),
    after?.poolState.partnerQuoteFee ?? new BN(-1),
  )

  // 4. The author claims their 10% with their own wallet.
  const authorShare = funded.userFees.find((u) =>
    u.address.equals(author.publicKey),
  )
  check(
    'author is owed 10% of the funded fees',
    owed.muln(AUTHOR_PERCENT).divn(100),
    authorShare?.feeUnclaimed ?? new BN(-1),
  )
  const authorBefore = await connection.getBalance(author.publicKey, COMMITMENT)
  const claim = await dfs.claimUserFee({
    feeVault: vault,
    user: author.publicKey,
    payer: author.publicKey,
  })
  const claimSig = await send(connection, claim, [author])
  const fee =
    (
      await connection.getTransaction(claimSig, {
        commitment: COMMITMENT,
        maxSupportedTransactionVersion: 0,
      })
    )?.meta?.fee ?? 0
  const authorAfter = await connection.getBalance(author.publicKey, COMMITMENT)
  console.log('author claimed, tx', claimSig)
  check(
    'author wallet received its share (net of the network fee)',
    authorShare?.feeUnclaimed ?? new BN(-1),
    new BN(authorAfter - authorBefore + fee),
  )

  results.forEach((r) =>
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.check}: ${r.detail}`),
  )
  console.log(
    `${results.filter((r) => r.ok).length}/${results.length} checks passed`,
  )
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
