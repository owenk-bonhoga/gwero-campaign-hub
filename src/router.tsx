import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        gcTime: 1800000,
        refetchOnWindowFocus: false,
        retry: (count, error) =>
          count < 1 && !/permission|authentication|invalid/i.test(error.message),
      },
    },
    mutationCache: new MutationCache({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["gwero-os-dashboard"] });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60000,
    defaultPendingMs: 250,
    defaultPendingMinMs: 0,
  });

  return router;
};
