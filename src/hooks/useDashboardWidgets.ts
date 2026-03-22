import { useQuery } from "@tanstack/react-query";
import { api } from "#/lib/api";
import type { DashboardWidgetsResponse } from "#/types/dashboard";

export function useDashboardWidgets() {
  return useQuery({
    queryKey: ["dashboard", "widgets"],
    queryFn: () => api.get<DashboardWidgetsResponse>("/api/shop-admin/dashboard/widgets"),
    refetchInterval: 30_000,
  });
}
