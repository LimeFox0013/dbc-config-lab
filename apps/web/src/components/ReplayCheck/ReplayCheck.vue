<template>
  <details class="replay-check">
    <summary class="replay-check__summary">
      {{ t('components.replayCheck.summary', totals) }}
    </summary>
    <p class="replay-check__text">
      {{ t('components.replayCheck.explanation') }}
    </p>
    <ul class="replay-check__launches">
      <li
        v-for="launch in REPLAYED_LAUNCHES"
        :key="launch.curvePool"
        class="replay-check__launch"
      >
        <span>
          {{ t(`components.replayCheck.feeSetup.${launch.feeSetup}`) }}:
          <a
            :href="explorerAddressUrl(launch.curvePool, SolanaNetwork.Mainnet)"
            target="_blank"
            rel="noopener noreferrer"
            class="replay-check__link"
          >{{ t('components.replayCheck.curveSwaps', launch.curveSwaps) }}</a>
          <template v-if="launch.migrated">
            ·
            <a
              :href="explorerAddressUrl(launch.migrated.pool, SolanaNetwork.Mainnet)"
              target="_blank"
              rel="noopener noreferrer"
              class="replay-check__link"
            >{{ t('components.replayCheck.migratedSwaps', launch.migrated.swaps) }}</a>
          </template>
        </span>
        <code class="replay-check__command">{{ replayCommand(REPLAY_COMMAND, launch) }}</code>
      </li>
    </ul>
  </details>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl, SolanaNetwork } from '../../core/config-deploy'
import {
  REPLAY_COMMAND,
  REPLAYED_LAUNCHES,
  replayCommand,
  replayTotals,
} from '../../features/replay-check'

const { t } = useI18n()
const totals = replayTotals(REPLAYED_LAUNCHES)
</script>

<style lang="scss">
.replay-check {
  padding: var(--space-3) var(--space-4);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  color: var(--color-surface-foreground);
}

.replay-check__summary {
  cursor: pointer;
  font-size: var(--font-size-2);
}

.replay-check__text {
  margin: var(--space-3) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.replay-check__launches {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-2);
}

.replay-check__launch {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.replay-check__link {
  color: inherit;
}

.replay-check__command {
  overflow-wrap: anywhere;
  font-family: var(--font-family-mono);
  color: var(--color-muted-foreground);
}
</style>
