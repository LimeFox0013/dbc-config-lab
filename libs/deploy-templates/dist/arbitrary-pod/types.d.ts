export interface ArbitraryPodSpec {
    name: string;
    image: string;
    ports: number[];
    env: Record<string, string>;
    persistenceKind: 'DATABASE' | 'VOLUME';
    resourceTier?: string;
    assignSubdomain?: boolean;
}
export interface ArbitraryPodDeployConfig {
    apiUrl: string;
    keycloakUrl: string;
    keycloakRealm: string;
    clientId: string;
    clientSecret: string;
    pod: ArbitraryPodSpec;
}
export interface DeployResult {
    name: string;
    podId: string;
    action: 'created' | 'redeployed';
}
export interface ExistingPod {
    id: string;
    image: string;
    createdAt: string;
}
//# sourceMappingURL=types.d.ts.map