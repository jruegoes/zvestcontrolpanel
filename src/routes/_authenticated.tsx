import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "#/store/auth";
import { t } from "#/i18n";
import ShopSidebar from "#/components/ShopSidebar";
import ThemeToggle from "#/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, role, firstName, lastName, loading, signOut } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-8 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="island-shell rounded-xl p-4 sm:rounded-2xl sm:p-5">
              <div className="skeleton mb-2 h-3 w-20" />
              <div className="skeleton h-7 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Shop owner: sidebar layout
  if (role === "shop_owner") {
    return (
      <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
        <ShopSidebar />
        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    );
  }

  // Super admin: simple top bar
  const displayName =
    firstName && lastName ? `${firstName} ${lastName}` : user.email;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--sea-ink-soft)]">
            {t.dashboard.signedInAs}{" "}
            <span className="font-semibold text-[var(--sea-ink)]">
              {displayName}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-fit shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:border-red-300 hover:text-red-600"
        >
          {t.dashboard.signOut}
        </button>
      </div>
      <Outlet />
      <div className="fixed bottom-4 right-4 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}
