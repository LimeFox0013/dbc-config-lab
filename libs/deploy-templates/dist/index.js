// libs/deploy-templates/src/arbitrary-pod/deploy.ts
var deployArbitraryPod = async (cfg) => {
  const token = await getAccessToken(cfg);
  const existingPods = await listExistingPods(cfg, token);
  const podId = resolveExistingPodId(cfg.pod, existingPods);
  return declarePod(cfg, token, podId);
};
var stripImageTag = (image) => {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  return lastColon > lastSlash ? image.slice(0, lastColon) : image;
};
var resolveExistingPodId = (pod, existingPods) => {
  const target = stripImageTag(pod.image);
  const matches = existingPods.filter((p) => stripImageTag(p.image) === target);
  if (matches.length === 0) return void 0;
  return matches.reduce(
    (newest, candidate) => new Date(candidate.createdAt) > new Date(newest.createdAt) ? candidate : newest
  ).id;
};
var listExistingPods = async (cfg, token) => {
  const res = await fetch(`${cfg.apiUrl}/arbitrary-pods`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(
      `[deploy-templates arbitrary-pod] Listing existing pods failed: ${res.status} ${await res.text()}`
    );
  }
  const body = await res.json();
  return body.pods ?? [];
};
var getAccessToken = async (cfg) => {
  const tokenUrl = `${cfg.keycloakUrl}/realms/${cfg.keycloakRealm}/protocol/openid-connect/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "client_credentials"
    }).toString()
  });
  if (!res.ok) {
    throw new Error(
      `[deploy-templates arbitrary-pod] Keycloak token request failed (${tokenUrl}): ${res.status} ${await res.text()}`
    );
  }
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(
      "[deploy-templates arbitrary-pod] Token response missing access_token"
    );
  }
  return body.access_token;
};
var declarePod = async (cfg, token, podId) => {
  const pod = cfg.pod;
  const url = podId ? `${cfg.apiUrl}/arbitrary-pods/${podId}/redeploy` : `${cfg.apiUrl}/arbitrary-pods`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      image: pod.image,
      ports: pod.ports,
      env: pod.env,
      persistenceKind: pod.persistenceKind,
      resourceTier: pod.resourceTier,
      assignSubdomain: pod.assignSubdomain
    })
  });
  if (!res.ok) {
    throw new Error(
      `[deploy-templates arbitrary-pod] "${pod.name}" ${podId ? "redeploy" : "create"} failed (${url}): ${res.status} ${await res.text()}`
    );
  }
  const body = await res.json();
  const resultId = podId ?? body.id ?? body.podId;
  if (!resultId) {
    throw new Error(
      `[deploy-templates arbitrary-pod] "${pod.name}" response missing pod id`
    );
  }
  return { name: pod.name, podId: resultId, action: podId ? "redeployed" : "created" };
};

// libs/deploy-templates/src/arbitrary-pod/config.ts
var requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};
var loadArbitraryPodDeployConfig = (pod) => ({
  apiUrl: requireEnv("LFI_API_URL"),
  keycloakUrl: requireEnv("LFI_KEYCLOAK_URL"),
  keycloakRealm: requireEnv("LFI_KEYCLOAK_REALM"),
  clientId: requireEnv("LFI_DEPLOY_CLIENT_ID"),
  clientSecret: requireEnv("LFI_DEPLOY_CLIENT_SECRET"),
  pod
});
export {
  declarePod,
  deployArbitraryPod,
  getAccessToken,
  loadArbitraryPodDeployConfig,
  resolveExistingPodId
};
