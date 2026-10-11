<template>
  <section class="account-webhooks">
    <h2 class="account-webhooks__title">
      {{ t('components.accountWebhooks.title') }}
    </h2>
    <p class="account-webhooks__hint">
      {{ t('components.accountWebhooks.intro') }}
    </p>
    <form
      class="account-webhooks__form"
      @submit.prevent="add"
    >
      <label class="account-webhooks__field">
        <span class="account-webhooks__label">{{ t('components.accountWebhooks.url') }}</span>
        <input
          v-model.trim="url"
          type="url"
          class="account-webhooks__control"
          required
        />
      </label>
      <button
        type="submit"
        class="account-webhooks__control account-webhooks__button"
        :disabled="working"
      >
        {{ t('components.accountWebhooks.add') }}
      </button>
    </form>
    <RefusalNotice :failure="failure" />
    <OneTimeSecret
      :secret="registered.secret.value"
      :title="t('components.accountWebhooks.secretTitle', { url: registeredUrl })"
      @dismiss="registered.dismiss"
    />

    <p
      v-if="endpoints.length === 0"
      class="account-webhooks__hint"
    >
      {{ t('components.accountWebhooks.none') }}
    </p>
    <ul
      v-else
      class="account-webhooks__list"
    >
      <li
        v-for="endpoint in endpoints"
        :key="endpoint.id"
        class="account-webhooks__row"
      >
        <code class="account-webhooks__url">{{ endpoint.url }}</code>
        <button
          type="button"
          class="account-webhooks__control account-webhooks__button"
          :disabled="working"
          @click="sendTest(endpoint.id)"
        >
          {{ t('components.accountWebhooks.test') }}
        </button>
        <button
          type="button"
          class="account-webhooks__control account-webhooks__button"
          :disabled="working"
          @click="remove(endpoint.id)"
        >
          {{ t('components.accountWebhooks.delete') }}
        </button>
      </li>
    </ul>

    <h3 class="account-webhooks__subtitle">
      {{ t('components.accountWebhooks.deliveriesTitle') }}
    </h3>
    <p
      v-if="deliveries.length === 0"
      class="account-webhooks__hint"
    >
      {{ t('components.accountWebhooks.noDeliveries') }}
    </p>
    <div
      v-else
      class="account-webhooks__scroll"
    >
      <table class="account-webhooks__table">
        <thead>
          <tr>
            <th>{{ t('components.accountWebhooks.columns.event') }}</th>
            <th>{{ t('components.accountWebhooks.columns.address') }}</th>
            <th>{{ t('components.accountWebhooks.columns.status') }}</th>
            <th class="account-webhooks__number">
              {{ t('components.accountWebhooks.columns.attempts') }}
            </th>
            <th>{{ t('components.accountWebhooks.columns.response') }}</th>
            <th>{{ t('components.accountWebhooks.columns.time') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="delivery in deliveries"
            :key="delivery.id"
            class="account-webhooks__delivery"
          >
            <td class="account-webhooks__mono">
              {{ delivery.type }}
            </td>
            <td class="account-webhooks__mono">
              {{ urlOf(delivery.endpointId) }}
            </td>
            <td>{{ t(`components.accountWebhooks.statuses.${delivery.status}`) }}</td>
            <td class="account-webhooks__number">
              {{ delivery.attempts }}
            </td>
            <td class="account-webhooks__mono">
              {{ delivery.lastStatusCode ?? delivery.lastError ?? t('components.accountWebhooks.noResponse') }}
            </td>
            <td class="account-webhooks__mono">
              {{ formatUtcTime(delivery.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatUtcTime, useOneTimeSecret } from '@dbc-config-lab/core/features/account'
import type {
  ApiResult,
  DeliveryView,
  EndpointView,
} from '@dbc-config-lab/core/features/account'
import { useAccountRequest } from '../../composables'
import { labelById } from '../../shared'
import { OneTimeSecret } from '../OneTimeSecret'
import { RefusalNotice } from '../RefusalNotice'
import type { AccountWebhooksProps } from './types'

/**
 * `webhooks`: register an address (its signing secret is shown once), send it a test,
 * delete it, and read the delivery log.
 */
const props = defineProps<AccountWebhooksProps>()
const { t } = useI18n()

const endpoints = shallowRef<EndpointView[]>([])
const deliveries = shallowRef<DeliveryView[]>([])
const { working, failure, send, keep } = useAccountRequest()
const url = ref('')
const registered = useOneTimeSecret()
const registeredUrl = ref('')

const load = async (): Promise<void> => {
  const [listed, log] = await Promise.all([props.client.webhooks(), props.client.deliveries()])
  keep(listed, endpoints)
  keep(log, deliveries)
}
onMounted(load)

const urlOf = (endpointId: EndpointView['id']): string =>
  labelById(endpoints.value, endpointId, (endpoint) => endpoint.url)

/** Runs one change, shows a refusal verbatim, then re-reads the addresses and the log. */
const change = async <T>(run: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
  const result = await send(run)
  await load()
  return result
}

const add = async (): Promise<void> => {
  const result = await change(() => props.client.addWebhook(url.value))
  if (!result.ok) return
  registeredUrl.value = result.value.endpoint.url
  registered.reveal(result.value.secret)
  url.value = ''
}

const sendTest = (id: EndpointView['id']): Promise<ApiResult<DeliveryView>> =>
  change(() => props.client.testWebhook(id))

const remove = (id: EndpointView['id']): Promise<ApiResult<null>> =>
  change(() => props.client.deleteWebhook(id))
</script>

<style lang="scss">
@use '../../styles/mixins';

.account-webhooks {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  @include mixins.surface;
}

.account-webhooks__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.account-webhooks__subtitle {
  margin: 0;
  font-size: var(--font-size-2);
}

.account-webhooks__hint,
.account-webhooks__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.account-webhooks__form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}

.account-webhooks__field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.account-webhooks__control {
  @include mixins.control;
}

.account-webhooks__button {
  @include mixins.clickable;
}

.account-webhooks__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.account-webhooks__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
  border-top: var(--border-width-1) solid var(--color-border);
}

.account-webhooks__url {
  flex: 1;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}

.account-webhooks__scroll {
  overflow-x: auto;
}

.account-webhooks__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);

  th,
  td {
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--border-width-1) solid var(--color-border);
    text-align: left;
  }

  th {
    color: var(--color-muted-foreground);
    font-weight: var(--font-weight-regular);
  }
}

.account-webhooks__table .account-webhooks__number {
  font-family: var(--font-family-mono);
  text-align: right;
}

.account-webhooks__mono {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}
</style>
