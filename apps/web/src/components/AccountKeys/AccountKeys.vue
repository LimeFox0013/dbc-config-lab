<template>
  <section class="account-keys">
    <h2 class="account-keys__title">
      {{ t('components.accountKeys.title') }}
    </h2>
    <p class="account-keys__hint">
      {{ t('components.accountKeys.intro') }}
    </p>
    <form
      class="account-keys__form"
      @submit.prevent="create"
    >
      <label class="account-keys__field">
        <span class="account-keys__label">{{ t('components.accountKeys.label') }}</span>
        <input
          v-model="label"
          class="account-keys__control"
          :maxlength="MAX_KEY_LABEL_LENGTH"
          required
        />
      </label>
      <button
        type="submit"
        class="account-keys__control account-keys__button"
        :disabled="working"
      >
        {{ t('components.accountKeys.create') }}
      </button>
    </form>
    <RefusalNotice :failure="failure" />
    <OneTimeSecret
      :secret="created.secret.value"
      :title="t('components.accountKeys.secretTitle', { label: createdLabel })"
      @dismiss="created.dismiss"
    />
    <p
      v-if="keys.length === 0"
      class="account-keys__hint"
    >
      {{ t('components.accountKeys.none') }}
    </p>
    <ul
      v-else
      class="account-keys__list"
    >
      <li
        v-for="key in keys"
        :key="key.id"
        class="account-keys__row"
      >
        <span class="account-keys__name">{{ key.label }}</span>
        <code class="account-keys__prefix">{{ t('components.accountKeys.prefix', { prefix: key.prefix }) }}</code>
        <span class="account-keys__meta">
          {{ t('components.accountKeys.created', { date: formatUtcTime(key.createdAt) }) }} ·
          {{ key.lastUsedAt ? t('components.accountKeys.lastUsed', { date: formatUtcTime(key.lastUsedAt) }) : t('components.accountKeys.neverUsed') }}
        </span>
        <button
          type="button"
          class="account-keys__control account-keys__button"
          :disabled="working"
          @click="revoke(key.id)"
        >
          {{ t('components.accountKeys.revoke') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  formatUtcTime,
  MAX_KEY_LABEL_LENGTH,
  useOneTimeSecret,
} from '@dbc-config-lab/core/features/account'
import type { ApiKeyView } from '@dbc-config-lab/core/features/account'
import { useAccountRequest } from '../../composables'
import { OneTimeSecret } from '../OneTimeSecret'
import { RefusalNotice } from '../RefusalNotice'
import type { AccountKeysProps } from './types'

/** `api-keys`: create (the key is shown once), list by label and prefix, revoke. */
const props = defineProps<AccountKeysProps>()
const { t } = useI18n()

const keys = shallowRef<ApiKeyView[]>([])
const { working, failure, send, keep } = useAccountRequest()
const label = ref('')
const created = useOneTimeSecret()
const createdLabel = ref('')

const load = async (): Promise<void> => {
  keep(await props.client.keys(), keys)
}
onMounted(load)

const create = async (): Promise<void> => {
  const result = await send(() => props.client.createKey(label.value))
  if (!result.ok) return
  createdLabel.value = result.value.view.label
  created.reveal(result.value.key)
  label.value = ''
  await load()
}

const revoke = async (id: ApiKeyView['id']): Promise<void> => {
  await send(() => props.client.revokeKey(id))
  await load()
}
</script>

<style lang="scss">
@use '../../styles/mixins';

.account-keys {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.account-keys__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.account-keys__hint,
.account-keys__label,
.account-keys__meta {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.account-keys__form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}

.account-keys__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.account-keys__control {
  @include mixins.control;
}

.account-keys__button {
  @include mixins.clickable;
}

.account-keys__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.account-keys__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
  border-top: var(--border-width-1) solid var(--color-border);
}

.account-keys__name {
  font-weight: var(--font-weight-strong);
}

.account-keys__prefix {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2);
}

.account-keys__meta {
  flex: 1;
}
</style>
