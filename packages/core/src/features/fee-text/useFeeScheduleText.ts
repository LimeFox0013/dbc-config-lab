import { useI18n } from 'vue-i18n'
import { percentFromBps } from '../../core/shared'
import type { ScheduleMode } from '../../core/launch-config'
import type { FeeScheduleFigures } from './types'

/**
 * One wording for a fee schedule wherever it is shown: "1% throughout" or "90% falling to
 * 1% over 10 s", naming the fall's shape when a screen compares shapes.
 */
export const useFeeScheduleText = () => {
  const { t } = useI18n()
  return (
    { startingFeeBps, endingFeeBps, windowSeconds }: FeeScheduleFigures,
    mode?: ScheduleMode,
  ): string => {
    if (startingFeeBps === endingFeeBps || windowSeconds === 0)
      return t('common.feeSchedule.flat', {
        fee: percentFromBps(endingFeeBps),
      })
    const falling = t('common.feeSchedule.falling', {
      start: percentFromBps(startingFeeBps),
      end: percentFromBps(endingFeeBps),
      seconds: windowSeconds,
    })
    return mode === undefined
      ? falling
      : t('common.feeSchedule.shaped', {
          schedule: falling,
          shape: t(`common.feeSchedule.shapes.${mode}`),
        })
  }
}
