import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { Keypair } from '@solana/web3.js'
import type { WalletAccount } from '@wallet-standard/base'
import {
  connectionFor,
  prepareDeployment,
  SolanaChain,
  SolanaNetwork,
} from '../../core/config-deploy'
import type { PrepareResult } from '../../core/config-deploy'
import { LAUNCH_PRESETS } from '../../core/launch-config'
import type { LaunchPreset } from '../../core/launch-config'
import type * as ConfigDeploy from '../../core/config-deploy'
import type * as Wallet from '../wallet'
import type { DeployWallet } from '../wallet'
import { DeployStep } from './constants'
import { useDeployment } from './useDeployment'

const owner = Keypair.generate().publicKey

const account: WalletAccount = {
  address: owner.toBase58(),
  publicKey: owner.toBytes(),
  chains: [SolanaChain.Devnet, SolanaChain.Mainnet],
  features: [],
}

const wallet: DeployWallet = {
  version: '1.0.0',
  name: 'Test',
  icon: 'data:image/svg+xml;base64,',
  chains: [SolanaChain.Devnet, SolanaChain.Mainnet],
  accounts: [account],
  features: {
    'standard:connect': {
      version: '1.0.0',
      connect: async () => ({ accounts: [account] }),
    },
    'solana:signAndSendTransaction': {
      version: '1.0.0',
      supportedTransactionVersions: ['legacy', 0],
      signAndSendTransaction: async () => [],
    },
  },
}

vi.mock('../wallet', async (importOriginal) => ({
  ...(await importOriginal<typeof Wallet>()),
  listDeployWallets: () => [],
  onWalletsChanged: () => () => undefined,
  signAndSendPrepared: vi.fn(async () => 'signature'),
}))

vi.mock('../../core/config-deploy', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigDeploy>()),
  prepareDeployment: vi.fn(),
}))

/** A real preparation against a dry run that passes, released only when the test says so. */
const heldPreparation = async () => {
  const actual = await vi.importActual<typeof ConfigDeploy>(
    '../../core/config-deploy',
  )
  const connection = connectionFor(SolanaNetwork.Devnet)
  vi.spyOn(connection, 'getLatestBlockhash').mockResolvedValue({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 1,
  })
  vi.spyOn(connection, 'simulateTransaction').mockResolvedValue({
    context: { slot: 1 },
    value: {
      err: null,
      logs: [],
      accounts: null,
      unitsConsumed: 0,
      returnData: null,
    },
  })
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.mocked(prepareDeployment).mockImplementation(
    async (_connection, request): Promise<PrepareResult> => {
      await released
      return actual.prepareDeployment(connection, request)
    },
  )
  return release
}

const [first, second] = LAUNCH_PRESETS
if (!first || !second) throw new Error('needs two built-in presets')

const setUp = async (network: SolanaNetwork) => {
  const scope = effectScope()
  const preset = ref<LaunchPreset>(first)
  const deployment = scope.run(() => useDeployment(preset))
  if (!deployment) throw new Error('scope did not run')
  deployment.network.value = network
  await nextTick()
  await deployment.connect(wallet)
  return { scope, preset, deployment }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.mocked(prepareDeployment).mockReset()
})

describe('useDeployment', () => {
  it('drops a preparation that finishes after the config changed', async () => {
    const release = await heldPreparation()
    const { scope, preset, deployment } = await setUp(SolanaNetwork.Devnet)

    const preparing = deployment.prepare()
    expect(deployment.step.value).toBe(DeployStep.Preparing)
    expect(deployment.inputsLocked.value).toBe(true)
    preset.value = second
    await nextTick()
    release()
    await preparing
    await settle()

    expect(deployment.prepared.value).toBeNull()
    expect(deployment.step.value).toBe(DeployStep.Idle)
    scope.stop()
  })

  it('keeps a preparation whose inputs did not change', async () => {
    const release = await heldPreparation()
    const { scope, deployment } = await setUp(SolanaNetwork.Devnet)

    const preparing = deployment.prepare()
    release()
    await preparing

    expect(deployment.step.value).toBe(DeployStep.Ready)
    expect(deployment.prepared.value?.summary.payer).toBe(owner.toBase58())
    scope.stop()
  })

  it('withdraws a mainnet transaction when the acknowledgement is taken back', async () => {
    const release = await heldPreparation()
    const { scope, deployment } = await setUp(SolanaNetwork.Mainnet)
    deployment.mainnetAcknowledged.value = true
    await nextTick()

    const preparing = deployment.prepare()
    release()
    await preparing
    expect(deployment.step.value).toBe(DeployStep.Ready)

    deployment.mainnetAcknowledged.value = false
    await nextTick()
    await deployment.signAndSend()

    expect(deployment.prepared.value).toBeNull()
    expect(deployment.signature.value).toBeNull()
    scope.stop()
  })
})
