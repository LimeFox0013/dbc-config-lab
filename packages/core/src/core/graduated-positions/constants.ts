import { getTokenProgram } from '@meteora-ag/cp-amm-sdk'

/** Graduated-pool position NFTs are Token-2022 mints. */
export const POSITION_NFT_PROGRAM = getTokenProgram(1)

/** DAMM v2 account names as the program's own (camel-casing) coder knows them. */
export enum CpAmmAccount {
  Position = 'position',
  Pool = 'pool',
}
