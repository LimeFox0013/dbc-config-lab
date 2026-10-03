import { Keypair, PublicKey } from '@solana/web3.js'
import { CollectFeeMode } from '@meteora-ag/dynamic-bonding-curve-sdk'
import {
  deriveFeeVaultPdaAddress,
  DYNAMIC_FEE_SHARING_PROGRAM_ID,
} from '@meteora-ag/dynamic-fee-sharing-sdk'
import { describe, expect, it, vi } from 'vitest'
import { connectionFor } from '../config-deploy'
import { compileLaunchConfig, DEFAULT_LAUNCH_CONFIG } from '../launch-config'
import { SolanaNetwork } from '../shared'
import {
  readRoyaltySplit,
  RoyaltyRejection,
  royaltyRejection,
  royaltyVault,
} from '.'

const compiled = compileLaunchConfig(DEFAULT_LAUNCH_CONFIG)
if (!compiled.ok) throw new Error(compiled.reason)
const parameters = compiled.parameters
const author = Keypair.generate().publicKey.toBase58()

describe('royaltyRejection', () => {
  it('accepts a whole share between 1 and 50% to another wallet', () => {
    expect(
      royaltyRejection({ author, sharePercent: 10 }, parameters),
    ).toBeNull()
  })

  it('accepts an author address off the curve, such as a multisig vault', () => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      DYNAMIC_FEE_SHARING_PROGRAM_ID,
    )
    expect(
      royaltyRejection(
        { author: pda.toBase58(), sharePercent: 10 },
        parameters,
      ),
    ).toBeNull()
  })

  it('names what is wrong', () => {
    expect(
      royaltyRejection({ author: 'nope', sharePercent: 10 }, parameters),
    ).toBe(RoyaltyRejection.AuthorInvalid)
    expect(
      royaltyRejection(
        { author: PublicKey.default.toBase58(), sharePercent: 10 },
        parameters,
      ),
    ).toBe(RoyaltyRejection.AuthorInvalid)
    expect(
      royaltyRejection(
        { author, sharePercent: 10 },
        parameters,
        new PublicKey(author),
      ),
    ).toBe(RoyaltyRejection.AuthorIsDeployer)
    expect(royaltyRejection({ author, sharePercent: 51 }, parameters)).toBe(
      RoyaltyRejection.ShareOutOfRange,
    )
    expect(royaltyRejection({ author, sharePercent: 2.5 }, parameters)).toBe(
      RoyaltyRejection.ShareOutOfRange,
    )
    expect(
      royaltyRejection(
        { author, sharePercent: 10 },
        { ...parameters, collectFeeMode: CollectFeeMode.OutputToken },
      ),
    ).toBe(RoyaltyRejection.FeesInLaunchedToken)
  })
})

describe('royaltyVault', () => {
  it('is derived from the config and pays the deployer the rest', async () => {
    const configKey = Keypair.generate()
    const deployer = Keypair.generate().publicKey
    const quoteMint = new PublicKey(
      'So11111111111111111111111111111111111111112',
    )
    const vault = await royaltyVault(connectionFor(SolanaNetwork.Devnet), {
      configKey,
      quoteMint,
      deployer,
      royalty: { author, sharePercent: 10 },
      commitment: 'confirmed',
    })
    expect(
      vault.vault.equals(
        deriveFeeVaultPdaAddress(configKey.publicKey, quoteMint),
      ),
    ).toBe(true)
    expect(vault.split).toEqual({
      vault: vault.vault.toBase58(),
      deployer: deployer.toBase58(),
      author,
      authorPercent: 10,
      deployerPercent: 90,
    })
    // The config's one-off key signs as the vault's base, alongside the payer.
    const signers = vault.instructions.flatMap((i) =>
      i.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58()),
    )
    expect(signers).toContain(configKey.publicKey.toBase58())
  })
})

describe('readRoyaltySplit', () => {
  it('reads an ordinary wallet as no split', async () => {
    const connection = connectionFor(SolanaNetwork.Devnet)
    vi.spyOn(connection, 'getAccountInfo').mockResolvedValue({
      data: Buffer.alloc(0),
      executable: false,
      lamports: 1,
      owner: PublicKey.default,
      rentEpoch: 0,
    })
    expect(
      await readRoyaltySplit(
        connection,
        Keypair.generate().publicKey,
        'confirmed',
      ),
    ).toBeNull()
  })
})
