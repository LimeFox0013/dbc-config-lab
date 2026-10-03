/**
 * Declares or redeploys the static web app on lime-fox-infra's arbitrary-workload
 * hosting via @lf/deploy-templates. Pod identity is resolved server-side by image
 * match; this repo never stores a pod id.
 *
 * Usage: tsx ops/deploy.mts
 */
import { deployArbitraryPod, loadArbitraryPodDeployConfig } from '@lf/deploy-templates'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// The nginx mainnet RPC proxy's provider key. Optional: without it the site serves, but
// mainnet reads in the page fail.
const heliusApiKey = process.env['HELIUS_API_KEY']

const result = await deployArbitraryPod(
  loadArbitraryPodDeployConfig({
    name: 'web',
    image: `${requireEnv('REGISTRY_URL')}/limefox0013/dbc-config-lab-web:${requireEnv('IMAGE_TAG')}`,
    ports: [8080],
    env: heliusApiKey ? { HELIUS_API_KEY: heliusApiKey } : {},
    // Static site: nothing persisted. The platform only accepts DATABASE/VOLUME and
    // provisions no database for it — it is a label on the declaration.
    persistenceKind: 'DATABASE',
    assignSubdomain: true,
  }),
)
console.log(`[deploy] ${JSON.stringify(result)}`)
