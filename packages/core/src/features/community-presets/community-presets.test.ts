import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LAUNCH_CONFIG } from '../../core/launch-config'
import { encodeSharedConfig, shareLink } from '../config-sharing'
import { communityPresets } from '.'

const author = Keypair.generate().publicKey.toBase58()
const encoded = encodeSharedConfig({
  config: DEFAULT_LAUNCH_CONFIG,
  royalty: { author, sharePercent: 10 },
})

describe('communityPresets', () => {
  it('reads an entry given as the encoded config or as a whole share link, royalty included', () => {
    const presets = communityPresets({
      presets: [
        { id: 'a', name: 'A', intent: 'Encoded', link: encoded },
        {
          id: 'b',
          name: 'B',
          intent: 'Link',
          link: shareLink(
            {
              config: DEFAULT_LAUNCH_CONFIG,
              royalty: { author, sharePercent: 10 },
            },
            'https://example.com/',
          ),
        },
      ],
    })
    expect(presets.map((p) => p.id)).toEqual(['a', 'b'])
    presets.forEach((p) =>
      expect(p).toMatchObject({
        config: DEFAULT_LAUNCH_CONFIG,
        royalty: { author, sharePercent: 10 },
      }),
    )
  })

  it('leaves out an entry that does not decode', () => {
    expect(
      communityPresets({
        presets: [{ id: 'x', name: 'X', intent: '', link: 'not-a-config' }],
      }),
    ).toEqual([])
  })

  it('ships an empty registry until presets are added', () => {
    expect(communityPresets()).toEqual([])
  })
})
