import type { Page, Route } from '@playwright/test'
import { DEVNET_RPC, DEVNET_WS, FAKE_BLOCKHASH } from './constants'

export interface RpcMockOptions {
  /** Error the dry run reports; null for a passing dry run. */
  simulationError: string | null
}

interface RpcRequest {
  id: unknown
  method: string
}

const isRpcRequest = (body: unknown): body is RpcRequest =>
  typeof body === 'object' &&
  body !== null &&
  'method' in body &&
  typeof body.method === 'string' &&
  'id' in body

const reply = (route: Route, id: unknown, result: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ jsonrpc: '2.0', id, result }),
  })

/** Answers the deploy flow's devnet RPC calls; any other method fails the test loudly. */
export const mockDevnetRpc = async (
  page: Page,
  options: RpcMockOptions,
): Promise<string[]> => {
  const methods: string[] = []
  await page.route(DEVNET_RPC, async (route) => {
    const body: unknown = route.request().postDataJSON()
    if (!isRpcRequest(body))
      return route.fulfill({ status: 400, body: 'not a JSON-RPC request' })
    const { id, method } = body
    methods.push(method)
    if (method === 'getLatestBlockhash') {
      return reply(route, id, {
        context: { slot: 1 },
        value: { blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: 100 },
      })
    }
    if (method === 'simulateTransaction') {
      return reply(route, id, {
        context: { slot: 1 },
        value: {
          err: options.simulationError,
          logs: options.simulationError
            ? ['Program log: insufficient lamports']
            : [],
          accounts: null,
          unitsConsumed: 0,
          returnData: null,
        },
      })
    }
    if (method === 'getSignatureStatuses') {
      return reply(route, id, {
        context: { slot: 2 },
        value: [
          {
            slot: 2,
            confirmations: null,
            err: null,
            confirmationStatus: 'confirmed',
          },
        ],
      })
    }
    if (method === 'getBlockHeight') return reply(route, id, 50)
    return route.fulfill({
      status: 500,
      body: `unexpected RPC method ${method}`,
    })
  })
  // Confirmation also subscribes over a websocket; answer locally so nothing reaches devnet.
  await page.routeWebSocket(DEVNET_WS, (ws) => {
    ws.onMessage((message) => {
      const body: unknown = JSON.parse(String(message))
      if (isRpcRequest(body))
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: 1 }))
    })
  })
  return methods
}
