/** A fee that may fall over a window; flat when it does not change. */
export interface FeeScheduleFigures {
  startingFeeBps: number
  endingFeeBps: number
  windowSeconds: number
}
