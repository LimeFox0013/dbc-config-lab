import type { ArbitraryPodDeployConfig, ArbitraryPodSpec } from './types.js';
/**
 * Reads the Keycloak/platform connection fields from the environment (the
 * shape every graduated repo's CI passes via its GitHub Actions `env:`
 * block) and pairs them with a caller-supplied pod spec — the spec itself is
 * project-specific, so it's never sourced from env here.
 */
export declare const loadArbitraryPodDeployConfig: (pod: ArbitraryPodSpec) => ArbitraryPodDeployConfig;
//# sourceMappingURL=config.d.ts.map