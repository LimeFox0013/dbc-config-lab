<template>
  <section class="account-watches">
    <h2 class="account-watches__title">
      {{ t('components.accountWatches.title') }}
    </h2>
    <p class="account-watches__hint">
      {{ t('components.accountWatches.intro') }}
    </p>
    <form
      class="account-watches__form"
      @submit.prevent="add"
    >
      <label class="account-watches__field">
        <span class="account-watches__label">{{ t('components.accountWatches.kind') }}</span>
        <select
          v-model="kind"
          class="account-watches__control"
        >
          <option
            v-for="option in Object.values(WatchKind)"
            :key="option"
            :value="option"
          >
            {{ t(`components.accountWatches.kinds.${option}`) }}
          </option>
        </select>
      </label>
      <label class="account-watches__field account-watches__field--wide">
        <span class="account-watches__label">{{ t('components.accountWatches.target') }}</span>
        <input
          v-model.trim="target"
          class="account-watches__control"
          required
        />
      </label>
      <label class="account-watches__field">
        <span class="account-watches__label">{{ t('components.accountWatches.network') }}</span>
        <select
          v-model="network"
          class="account-watches__control"
        >
          <option
            v-for="option in Object.values(SolanaNetwork)"
            :key="option"
            :value="option"
          >
            {{ t(`components.accountWatches.networks.${option}`) }}
          </option>
        </select>
      </label>
      <label
        v-if="kind === WatchKind.FeeWallet"
        class="account-watches__field"
      >
        <span class="account-watches__label">{{ t('components.accountWatches.threshold') }}</span>
        <input
          v-model.number="threshold"
          type="number"
          min="0"
          step="any"
          class="account-watches__control account-watches__number"
          required
        />
      </label>
      <button
        type="submit"
        class="account-watches__control account-watches__button"
        :disabled="working"
      >
        {{ t('components.accountWatches.add') }}
      </button>
    </form>
    <RefusalNotice :failure="failure" />

    <p
      v-if="watches.length === 0"
      class="account-watches__hint"
    >
      {{ t('components.accountWatches.none') }}
    </p>
    <ul
      v-else
      class="account-watches__list"
    >
      <li
        v-for="watch in watches"
        :key="watch.id"
        class="account-watches__row"
      >
        <span class="account-watches__name">{{ t(`components.accountWatches.kindsShort.${watch.kind}`) }}</span>
        <code class="account-watches__target">{{ watch.target }}</code>
        <span class="account-watches__meta">
          {{ t(`components.accountWatches.networks.${watch.network}`) }} ·
          <template v-if="watch.thresholdSol !== null">
            {{ t('components.accountWatches.thresholdValue', { sol: watch.thresholdSol }) }} ·
          </template>
          {{ watch.paused ? t('components.accountWatches.paused') : t('components.accountWatches.active') }} ·
          {{ watch.lastCheckedAt ? t('components.accountWatches.lastChecked', { date: formatUtcTime(watch.lastCheckedAt) }) : t('components.accountWatches.notChecked') }}
        </span>
        <button
          type="button"
          class="account-watches__control account-watches__button"
          :disabled="working"
          @click="setPaused(watch.id, !watch.paused)"
        >
          {{ watch.paused ? t('components.accountWatches.resume') : t('components.accountWatches.pause') }}
        </button>
        <button
          type="button"
          class="account-watches__control account-watches__button"
          :disabled="working"
          @click="remove(watch.id)"
        >
          {{ t('components.accountWatches.delete') }}
        </button>
      </li>
    </ul>

    <h3 class="account-watches__subtitle">
      {{ t('components.accountWatches.eventsTitle') }}
    </h3>
    <p
      v-if="events.length === 0"
      class="account-watches__hint"
    >
      {{ t('components.accountWatches.noEvents') }}
    </p>
    <ul
      v-else
      class="account-watches__list"
    >
      <li
        v-for="event in events"
        :key="event.id"
        class="account-watches__row"
      >
        <span class="account-watches__name">
          {{ isWatchEventType(event.type) ? t(`components.accountWatches.eventTypes.${event.type}`) : event.type }}
        </span>
        <code class="account-watches__target">{{ targetOf(event.watchId) }}</code>
        <span class="account-watches__meta">{{ formatUtcTime(event.seenAt) }}</span>
        <code class="account-watches__change">
          {{ t('components.accountWatches.change', { before: stateText(event.before), after: stateText(event.after) }) }}
        </code>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { SolanaNetwork } from '@dbc-config-lab/core/core/shared'
import {
  formatUtcTime,
  isWatchEventType,
  stateText,
  WatchKind,
} from '@dbc-config-lab/core/features/account'
import type {
  ApiResult,
  NewWatch,
  WatchEventView,
  WatchView,
} from '@dbc-config-lab/core/features/account'
import { useAccountRequest } from '../../composables'
import { labelById } from '../../shared'
import { RefusalNotice } from '../RefusalNotice'
import type { AccountWatchesProps } from './types'

/**
 * `watches`: add (refused in the service's words past the plan's limit), pause, delete,
 * and the changes the service has recorded.
 */
const props = defineProps<AccountWatchesProps>()
/** The account's watch count changed. */
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()

const watches = shallowRef<WatchView[]>([])
const events = shallowRef<WatchEventView[]>([])
const { working, failure, send, keep } = useAccountRequest()
const kind = ref<WatchKind>(WatchKind.Config)
const target = ref('')
const network = ref<SolanaNetwork>(SolanaNetwork.Mainnet)
/** An emptied number field holds an empty string. */
const threshold = ref<number | string>('')

const load = async (): Promise<void> => {
  const [listed, seen] = await Promise.all([props.client.watches(), props.client.events()])
  keep(listed, watches)
  keep(seen, events)
}
onMounted(load)

const targetOf = (watchId: WatchView['id']): string =>
  labelById(watches.value, watchId, (watch) => watch.target)

/** Runs one change, shows a refusal verbatim, then re-reads the list. */
const change = async (run: () => Promise<ApiResult<unknown>>): Promise<boolean> => {
  const result = await send(run)
  await load()
  emit('changed')
  return result.ok
}

const add = async (): Promise<void> => {
  const watch: NewWatch = {
    kind: kind.value,
    target: target.value,
    network: network.value,
    ...(kind.value === WatchKind.FeeWallet ? { thresholdSol: Number(threshold.value) } : {}),
  }
  if (await change(() => props.client.addWatch(watch))) target.value = ''
}

const setPaused = (id: WatchView['id'], paused: boolean): Promise<boolean> =>
  change(() => props.client.setWatchPaused(id, paused))

const remove = (id: WatchView['id']): Promise<boolean> =>
  change(() => props.client.deleteWatch(id))
</script>

<style lang="scss">
@use '../../styles/mixins';

.account-watches {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.account-watches__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.account-watches__subtitle {
  margin: 0;
  font-size: var(--font-size-2);
}

.account-watches__hint,
.account-watches__label,
.account-watches__meta {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.account-watches__form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}

.account-watches__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.account-watches__field--wide {
  flex: 1;
}

.account-watches__control {
  @include mixins.control;
}

.account-watches__number {
  width: var(--input-width-number);
}

.account-watches__button {
  @include mixins.clickable;
}

.account-watches__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.account-watches__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
  border-top: var(--border-width-1) solid var(--color-border);
}

.account-watches__name {
  font-weight: var(--font-weight-strong);
}

.account-watches__target,
.account-watches__change {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.account-watches__meta {
  flex: 1;
}
</style>
