import { setupBuffer } from '../plugins/buffer'
import type {
  RecommendRequest,
  RecommendResponse,
} from '../features/recommendation'

// The Solana SDKs read the Buffer global while their modules load, and static imports are
// evaluated before this module's body — so the global is installed first and the
// recommendation code is loaded afterwards, explicitly.
setupBuffer()
const recommendation = import('../features/recommendation')

self.addEventListener(
  'message',
  async (event: MessageEvent<RecommendRequest>) => {
    const { id, base, objective, scenario, options } = event.data
    let response: RecommendResponse
    try {
      const { recommend } = await recommendation
      response = {
        id,
        ok: true,
        recommendation: recommend(base, objective, scenario, options),
      }
    } catch (error) {
      response = {
        id,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
    self.postMessage(response)
  },
)
