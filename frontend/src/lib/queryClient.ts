import { QueryClient } from '@tanstack/react-query'

/** Single shared QueryClient so non-component code (auth store, axios interceptor)
 * can clear the cache on logout and avoid one user's data bleeding into the next. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
