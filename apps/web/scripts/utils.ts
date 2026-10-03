/** Waits `ms` milliseconds — scripts space out public RPC calls with it. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
