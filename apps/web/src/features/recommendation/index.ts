export { GOAL_OBJECTIVES, LaunchGoal, PROPOSAL_COUNT } from './constants'
export type {
  Proposal,
  Recommendation,
  RecommendOptions,
  RecommendRequest,
  RecommendResponse,
  VersusFlat,
} from './types'
export { createRecommender } from './worker-client'
export { matchingPreset, recommend, versusFlat } from './utils'
