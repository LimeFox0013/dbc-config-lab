export interface OneTimeSecretProps {
  /** The disclosed secret; nothing is shown once it is null. */
  secret: string | null
  /** What the secret is for, e.g. the new key's label. */
  title: string
}
