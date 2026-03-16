import useSWR, { mutate } from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Cache keys
export const KEYS = {
  stats: '/api/admin?type=stats',
  licenses: '/api/admin?type=licenses',
  usage: '/api/admin?type=usage',
  revenue: '/api/admin?type=revenue',
} as const

// Shared SWR config
export const swrConfig = {
  fetcher,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
}

// Hooks
export function useStats() {
  return useSWR(KEYS.stats, fetcher, { revalidateOnFocus: true })
}

export function useLicenses() {
  return useSWR(KEYS.licenses, fetcher, { revalidateOnFocus: true })
}

export function useUsage() {
  return useSWR(KEYS.usage, fetcher, { revalidateOnFocus: true })
}

export function useRevenue() {
  return useSWR(KEYS.revenue, fetcher, { revalidateOnFocus: true })
}

// Prefetch a key (call on hover/link prefetch)
export function prefetch(key: string) {
  mutate(key, fetcher(key), { revalidate: false })
}

// Revalidate all dashboard data (after mutations)
export function revalidateAll() {
  mutate(KEYS.stats)
  mutate(KEYS.licenses)
  mutate(KEYS.usage)
  mutate(KEYS.revenue)
}
