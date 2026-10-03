import type { LaunchPreset } from '../../core/launch-config'
import { decodeSharedConfig, sharedFromHash } from '../config-sharing'
import registry from './presets.json'
import type { CommunityPresetRegistry } from './types'

export type { CommunityPresetEntry } from './types'

/**
 * The community presets that decode and pass the program's checks, as ordinary presets
 * (royalty included). Entries are untrusted like any share link: one that fails is left out.
 */
export const communityPresets = (
  source: CommunityPresetRegistry = registry,
): LaunchPreset[] =>
  source.presets.flatMap((entry) => {
    // A full share URL or just the part after `#config=`: both are accepted.
    const encoded = URL.canParse(entry.link)
      ? sharedFromHash(new URL(entry.link).hash)
      : entry.link
    if (!encoded) return []
    const decoded = decodeSharedConfig(encoded)
    if (!decoded.ok) return []
    return [
      {
        id: entry.id,
        name: entry.name,
        intent: entry.intent,
        config: decoded.shared.config,
        ...(decoded.shared.royalty ? { royalty: decoded.shared.royalty } : {}),
      },
    ]
  })
