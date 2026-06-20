import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '@/api/roles'
import { useAuthStore } from '@/stores/useAuthStore'

/** Effective permission keys for the current user (resolved from their role). */
export function usePermissions(): string[] {
  const isAuthenticated = Boolean(useAuthStore((s) => s.isAuthenticated))
  const { data } = useQuery({
    queryKey: ['me', 'permissions'],
    queryFn: rolesApi.myPermissions,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
  return data?.permissions ?? []
}

export function useHasPermission(key: string): boolean {
  return usePermissions().includes(key)
}
