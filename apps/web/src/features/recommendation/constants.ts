import { Criterion, objectiveOf } from '../../core/config-search'
import type { Objective } from '../../core/config-search'

export enum LaunchGoal {
  FairLaunch = 'fair-launch',
  SniperDeterrent = 'sniper-deterrent',
  FeeIncome = 'fee-income',
  GraduateFast = 'graduate-fast',
  MaxRaise = 'max-raise',
  StablePrice = 'stable-price',
  EarlyFairness = 'early-fairness',
  FairPrice = 'fair-price',
}

/** Each goal weighs the criteria it is about; every goal keeps some weight on human buyers. */
export const GOAL_OBJECTIVES: Record<LaunchGoal, Objective> = {
  [LaunchGoal.FairLaunch]: objectiveOf({
    [Criterion.HumanOutcome]: 1,
    [Criterion.BotDeterrence]: 0.3,
    [Criterion.EarlyFairness]: 0.5,
    [Criterion.FeeIncome]: 0.1,
  }),
  [LaunchGoal.SniperDeterrent]: objectiveOf({
    [Criterion.BotDeterrence]: 1,
    [Criterion.HumanOutcome]: 0.3,
  }),
  [LaunchGoal.FeeIncome]: objectiveOf({
    [Criterion.FeeIncome]: 1,
    [Criterion.HumanOutcome]: 0.2,
  }),
  [LaunchGoal.GraduateFast]: objectiveOf({
    [Criterion.Graduation]: 1,
    [Criterion.HumanOutcome]: 0.2,
  }),
  [LaunchGoal.MaxRaise]: objectiveOf({
    [Criterion.Raise]: 1,
    [Criterion.Graduation]: 0.3,
    [Criterion.HumanOutcome]: 0.2,
  }),
  [LaunchGoal.StablePrice]: objectiveOf({
    [Criterion.PriceStability]: 1,
    [Criterion.HumanOutcome]: 0.3,
  }),
  [LaunchGoal.FairPrice]: objectiveOf({
    [Criterion.FairPrice]: 1,
    [Criterion.Graduation]: 0.5,
    [Criterion.HumanOutcome]: 0.2,
  }),
  [LaunchGoal.EarlyFairness]: objectiveOf({
    [Criterion.EarlyFairness]: 1,
    [Criterion.HumanOutcome]: 0.3,
  }),
}

/** How many ranked proposals to show. */
export const PROPOSAL_COUNT = 3
