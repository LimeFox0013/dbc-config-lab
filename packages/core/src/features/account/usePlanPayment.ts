import { computed, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { connectionFor, readyForWallet } from '../../core/config-deploy'
import type { PreparedTransaction } from '../../core/config-deploy'
import { SolanaNetwork } from '../../core/shared'
import { DeployStep, useSignedTransaction } from '../deployment'
import type { ConnectedWallet } from '../wallet'
import type { AccountClient } from './client'
import {
  PAYMENT_POLL_ATTEMPTS,
  PAYMENT_POLL_INTERVAL_MS,
  PaymentConfirmation,
  PlanId,
} from './constants'
import type { ApiFailure, PaymentRequestView } from './types'
import { pollUntilCredited, usdcTransferTransaction } from './utils'

export interface PlanPaymentOptions {
  client: AccountClient
  connected: Readonly<Ref<ConnectedWallet | null>>
  /** Called once the service reports the payment credited. */
  onCredited: () => void
  pollIntervalMs?: number
  pollAttempts?: number
}

/**
 * `usdc-plan-payment`: asks the service for a transfer request, has the connected wallet
 * pay it through the site's usual dry-run → sign cycle, then waits — bounded — for the
 * service to find the transfer and credit the plan. The plan counts as paid only then.
 */
export const usePlanPayment = ({
  client,
  connected,
  onCredited,
  pollIntervalMs = PAYMENT_POLL_INTERVAL_MS,
  pollAttempts = PAYMENT_POLL_ATTEMPTS,
}: PlanPaymentOptions) => {
  const payment = shallowRef<PaymentRequestView | null>(null)
  const failure = shallowRef<ApiFailure | null>(null)
  const requesting = ref(false)
  const confirmation = ref<PaymentConfirmation>(PaymentConfirmation.Idle)
  const network = computed(() => payment.value?.network ?? SolanaNetwork.Devnet)
  const mainnetAcknowledged = ref(false)
  const transaction = useSignedTransaction<PreparedTransaction>({
    network,
    connected,
    mainnetAcknowledged,
  })

  const request = async (): Promise<void> => {
    requesting.value = true
    failure.value = null
    confirmation.value = PaymentConfirmation.Idle
    transaction.discard()
    const result = await client.requestPayment(PlanId.Pro)
    requesting.value = false
    if (result.ok) payment.value = result.value
    else failure.value = result.failure
  }

  const prepare = async (): Promise<void> => {
    const requested = payment.value
    const owner = connected.value?.owner
    if (!requested || !owner) return
    await transaction.runPreparation(() =>
      readyForWallet(
        connectionFor(requested.network),
        usdcTransferTransaction(requested, owner),
        owner,
        [],
      ),
    )
  }

  const confirm = async (): Promise<void> => {
    const requested = payment.value
    if (!requested) return
    failure.value = null
    confirmation.value = PaymentConfirmation.Waiting
    const result = await pollUntilCredited(
      () => client.checkPayment(requested.reference),
      pollAttempts,
      pollIntervalMs,
    )
    if (!result.ok) {
      failure.value = result.failure
      confirmation.value = PaymentConfirmation.NotYet
      return
    }
    payment.value = result.value
    confirmation.value = result.value.credited
      ? PaymentConfirmation.Credited
      : PaymentConfirmation.NotYet
    if (result.value.credited) onCredited()
  }

  const pay = async (): Promise<void> => {
    await transaction.signAndSend()
    if (transaction.step.value === DeployStep.Done) await confirm()
  }

  return {
    payment,
    failure,
    requesting,
    confirmation,
    mainnetAcknowledged,
    step: transaction.step,
    error: transaction.error,
    signature: transaction.signature,
    busy: transaction.busy,
    canSign: transaction.canSign,
    request,
    prepare,
    pay,
    confirm,
  }
}
