import { SetMetadata } from '@nestjs/common'
import { REQUIRE_PERMISSION_METADATA_KEY } from './constants.js'

export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_METADATA_KEY, permission)
