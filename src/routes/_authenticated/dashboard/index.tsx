import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "#/store/auth";
import AdminDashboard from "#/components/AdminDashboard";
import ShopDashboard from "#/components/ShopDashboard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const { role } = useAuthStore();

  return role === "super_admin" ? <AdminDashboard /> : <ShopDashboard />;
}
