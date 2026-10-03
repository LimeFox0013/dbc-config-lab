/** One registry entry: a share link's payload, named. */
export interface CommunityPresetEntry {
  id: string
  name: string
  intent: string
  /** A share link, or just its encoded config (what follows `#config=`). */
  link: string
}

export interface CommunityPresetRegistry {
  presets: CommunityPresetEntry[]
}
