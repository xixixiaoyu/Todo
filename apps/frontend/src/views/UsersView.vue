<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useUsersStore } from '@/stores/users'
import type { User } from '@my-app/shared'

const usersStore = useUsersStore()
const { users, loading, error } = storeToRefs(usersStore)
const { t, locale } = useI18n()

function formatDate(dateString: string): string {
  const localeMap: Record<string, string> = {
    'zh-CN': 'zh-CN',
    'en-US': 'en-US',
  }
  return new Date(dateString).toLocaleDateString(localeMap[locale.value] || 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(() => {
  usersStore.fetchUsers()
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-900">{{ t('users.title') }}</h1>
      <button
        :disabled="loading"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        @click="usersStore.fetchUsers()"
      >
        {{ loading ? t('common.loading') : t('common.refresh') }}
      </button>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-600">
        {{ error }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading && users.length === 0" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
      <p class="mt-4 text-gray-600">{{ t('users.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="users.length === 0" class="text-center py-12 bg-warm-card rounded-lg shadow">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
        />
      </svg>
      <p class="mt-4 text-gray-600">{{ t('users.empty') }}</p>
    </div>

    <!-- Users List -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="user in users"
        :key="user.id"
        class="bg-warm-card rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
      >
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0">
            <img
              v-if="user.avatar"
              :src="user.avatar"
              :alt="user.name"
              class="h-12 w-12 rounded-full object-cover"
            />
            <div
              v-else
              class="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center"
            >
              <span class="text-primary-600 font-semibold text-lg">
                {{ user.name.charAt(0).toUpperCase() }}
              </span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-gray-900 truncate">
              {{ user.name }}
            </h3>
            <p class="text-gray-500 truncate">
              {{ user.email }}
            </p>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <p class="text-sm text-gray-400">
            {{ t('users.joined') }} {{ formatDate(user.createdAt) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
