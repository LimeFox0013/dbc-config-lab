import type { Type } from '@nestjs/common'
import type { Request } from 'express'
import type {
  AgenticAccountRow,
  IAgenticAccountRepository,
} from './agentic-account.ports.js'

export interface AgenticAccountModuleOptions {
  /**
   * Concrete persistence implementation (class or value) of the repository
   * port. Must satisfy `IAgenticAccountRepository`.
   */
  repository: Type<IAgenticAccountRepository> | IAgenticAccountRepository
}

/** Returned once, at mint time — the only moment the raw key is ever visible. */
export interface MintedAgenticAccount {
  rawKey: string
  id: AgenticAccountRow['id']
  tenantId: AgenticAccountRow['tenantId']
  externalSystem: AgenticAccountRow['externalSystem']
  externalRef: AgenticAccountRow['externalRef']
  keyPrefix: AgenticAccountRow['keyPrefix']
  createdAt: AgenticAccountRow['createdAt']
}

/** An authenticated caller with its role's live permission set. */
export interface AuthenticatedAgenticAccount {
  id: AgenticAccountRow['id']
  tenantId: AgenticAccountRow['tenantId']
  roleId: AgenticAccountRow['roleId']
  externalSystem: AgenticAccountRow['externalSystem']
  externalRef: AgenticAccountRow['externalRef']
  permissions: string[]
}

export interface RequestWithAgenticAccount extends Request {
  agenticAccount: AuthenticatedAgenticAccount
}
