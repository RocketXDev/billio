import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — data is fresh, skip background refetch
      gcTime: 10 * 60 * 1000,     // 10 min — keep unused cache alive between page visits
      retry: 1,
      refetchOnWindowFocus: false, // avoid surprise refetches when switching tabs
    },
  },
});
