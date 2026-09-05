import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes — data considered fresh
      gcTime:    1000 * 60 * 10,  // 10 minutes — cache kept in memory
      retry: 1,                   // retry once on failure
      refetchOnWindowFocus: false, // don't refetch every time user switches tabs
    },
    mutations: {
      retry: 0,                   // mutations never auto-retry
    },
  },
});
