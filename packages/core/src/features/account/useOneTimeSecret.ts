import { readonly, ref } from 'vue'

/**
 * A secret the service discloses once (a new API key, a webhook signing secret). It lives
 * only in this page's memory until dismissed — never stored, never fetched again — so a
 * later view of the page, or a reload, cannot show it.
 */
export const useOneTimeSecret = () => {
  const secret = ref<string | null>(null)
  const reveal = (value: string): void => {
    secret.value = value
  }
  const dismiss = (): void => {
    secret.value = null
  }
  return { secret: readonly(secret), reveal, dismiss }
}

export type OneTimeSecret = ReturnType<typeof useOneTimeSecret>
