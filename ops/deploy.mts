/**
 * Declares or redeploys the lab's two workloads on lime-fox-infra's arbitrary-workload
 * hosting via @lf/deploy-templates: the static site and the hosted agent-tools API. Pod
 * identity is resolved server-side by image match; this repo never stores a pod id.
 *
 * Only this step knows which platform hosts the lab: the workloads themselves read their
 * settings from the environment (hosting-portability).
 *
 * Usage: tsx ops/deploy.mts
 */
import { deployArbitraryPod, loadArbitraryPodDeployConfig } from '@lf/deploy-templates'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const optionalEnv = (name: string): Record<string, string> => {
  const value = process.env[name]
  return value ? { [name]: value } : {}
}

const image = (name: string): string =>
  `${requireEnv('REGISTRY_URL')}/limefox0013/dbc-config-lab-${name}:${requireEnv('IMAGE_TAG')}`

// The RPC provider key. Optional: without it the site serves but its mainnet reads fail,
// and the API falls back to the public endpoints.
const heliusApiKey = process.env['HELIUS_API_KEY']

const web = await deployArbitraryPod(
  loadArbitraryPodDeployConfig({
    name: 'web',
    image: image('web'),
    ports: [8080],
    // Handed to the nginx RPC proxy, never to the page.
    env: heliusApiKey ? { HELIUS_API_KEY: heliusApiKey } : {},
    // Static site: nothing persisted.
    persistenceKind: 'NONE',
    assignSubdomain: true,
    // Fixed label, so the site is lf-aw-pod.dbc-lab.at.lime-fox.net — the URL the agent
    // tools link to. Creation only; redeploys keep it.
    subdomainLabel: 'dbc-lab',
  }),
)
console.log(`[deploy] web ${JSON.stringify(web)}`)

const api = await deployArbitraryPod(
  loadArbitraryPodDeployConfig({
    name: 'api',
    image: image('api'),
    ports: [8080],
    env: {
      // Keys the stored caller hashes (and the webhook-secret key derived from it);
      // rotating it resets every anonymous allowance and voids stored webhook secrets.
      CALLER_HASH_KEY: requireEnv('CALLER_HASH_KEY'),
      // Paid plans: the operator's USDC receiving wallet and its network. Without a
      // recipient the service runs on free plans only.
      ...optionalEnv('DBC_LAB_PAY_RECIPIENT'),
      ...optionalEnv('DBC_LAB_PAY_NETWORK'),
      ...(heliusApiKey
        ? {
            DBC_LAB_RPC_MAINNET: `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
            DBC_LAB_RPC_DEVNET: `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`,
          }
        : {}),
    },
    // The platform provisions the database and hands it over as DATABASE_URL; it is kept
    // across redeploys and released with the pod.
    persistenceKind: 'DATABASE',
    assignSubdomain: true,
    // lf-aw-pod.dbc-lab-api.at.lime-fox.net/mcp
    subdomainLabel: 'dbc-lab-api',
  }),
)
console.log(`[deploy] api ${JSON.stringify(api)}`)
