import type { ArbitraryPodDeployConfig, ArbitraryPodSpec, DeployResult, ExistingPod } from './types.js';
/**
 * Declares or redeploys a single `lime-fox-infra` arbitrary-workload pod via
 * its arbitrary-pod API. Pod identity is always resolved server-side, by
 * image-repository match — this template never accepts or persists a
 * caller-supplied pod id (see `deploy-template-library`'s
 * server-side-only-pod-identity constraint: a client-facing repo is never
 * asked to own platform-internal bookkeeping).
 */
export declare const deployArbitraryPod: (cfg: ArbitraryPodDeployConfig) => Promise<DeployResult>;
/**
 * Multiple pods can share the same image repository — every past attempt
 * (rejected scans, crashed boots, since-fixed bugs) leaves its own row
 * behind rather than being cleaned up. Picking the first match risks
 * resurrecting a long-abandoned pod instead of the one actually live today,
 * so among matches this always takes the most recently created.
 */
export declare const resolveExistingPodId: (pod: Pick<ArbitraryPodSpec, "image">, existingPods: ExistingPod[]) => string | undefined;
export declare const getAccessToken: (cfg: ArbitraryPodDeployConfig) => Promise<string>;
export declare const declarePod: (cfg: ArbitraryPodDeployConfig, token: string, podId: string | undefined) => Promise<DeployResult>;
//# sourceMappingURL=deploy.d.ts.map