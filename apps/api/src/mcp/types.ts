/** Who a request is counted as, and how many tool calls that caller has per day. */
export interface Caller {
  id: string
  dailyCalls: number
  /** Identified by an API key (its account), rather than by network address. */
  keyed: boolean
}
