import { ref, shallowRef, watch } from 'vue'
import { PublicKey } from '@solana/web3.js'
import { connectionFor } from '../../core/config-deploy'
import { prepareFeeClaim } from '../../core/fee-claim'
import type { PreparedClaim } from '../../core/fee-claim'
import { useSignedTransaction } from '../deployment'
import type { WalletSessionRefs } from '../wallet'
import { findEarnings } from './find'
import type { EarningsResult, EarningsRow } from './types'

/**
 * Finds the pools whose trading fees the connected wallet can claim, and claims one at a
 * time: prepare and dry-run, show the amounts, then the wallet signs.
 */
export const useEarnings = (session: WalletSessionRefs) => {
  const { network, connected } = session
  const result = shallowRef<EarningsResult | null>(null)
  const finding = ref(false)
  /** The row being claimed; the claim itself is the transaction below. */
  const claiming = shallowRef<EarningsRow | null>(null)
  const transaction = useSignedTransaction<PreparedClaim>(session)
  /** Bumped whenever earlier lookups stop applying, so a late answer is dropped. */
  let lookup = 0

  watch([network, connected], () => {
    lookup += 1
    result.value = null
    finding.value = false
    claiming.value = null
  })

  const find = async (): Promise<void> => {
    const wallet = connected.value
    if (!wallet) return
    const current = ++lookup
    finding.value = true
    const found = await findEarnings(
      connectionFor(network.value),
      network.value,
      wallet.owner,
    )
    if (current !== lookup) return
    finding.value = false
    result.value = found
  }

  const prepareClaim = async (row: EarningsRow): Promise<void> => {
    const owner = connected.value?.owner
    if (!owner) return
    claiming.value = row
    await transaction.runPreparation(async () => {
      const claim = await prepareFeeClaim(connectionFor(network.value), {
        pool: new PublicKey(row.pool),
        role: row.role,
        network: network.value,
        owner,
        maxQuoteAmount: row.unclaimedQuote,
        maxBaseAmount: row.unclaimedBase,
      })
      return claim.ok
        ? { ok: true, prepared: claim.claim }
        : { ok: false, reason: claim.reason }
    })
  }

  return {
    result,
    finding,
    claiming,
    prepared: transaction.prepared,
    step: transaction.step,
    busy: transaction.busy,
    error: transaction.error,
    signature: transaction.signature,
    find,
    prepareClaim,
    signAndSend: transaction.signAndSend,
  }
}
