import { PublicKey } from '@solana/web3.js'
import { z } from 'zod'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import { MAX_THRESHOLD_SOL, WatchKind } from './constants'

const address = z.string().refine((value) => {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
})

export const AddWatchBody = z.object({
  kind: z.nativeEnum(WatchKind),
  target: address,
  network: z.nativeEnum(SolanaNetwork).default(SolanaNetwork.Mainnet),
  thresholdSol: z.number().positive().max(MAX_THRESHOLD_SOL).optional(),
})
export const PauseBody = z.object({ paused: z.boolean() })
