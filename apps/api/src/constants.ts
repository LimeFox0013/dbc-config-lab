/** The port the platform routes to (the pod declares it). */
export const DEFAULT_PORT = 8080

/** Overrides `DEFAULT_PORT` when set. */
export const PORT_ENV = 'PORT'

/** One proxy hop: lime-fox-infra's ingress in front of the pod. */
export const TRUSTED_PROXY_HOPS = 1
