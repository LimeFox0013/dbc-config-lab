import { z } from 'zod'
import { MAX_WEBHOOK_URL_LENGTH } from './constants'

export const AddWebhookBody = z.object({
  url: z.string().url().max(MAX_WEBHOOK_URL_LENGTH),
})
