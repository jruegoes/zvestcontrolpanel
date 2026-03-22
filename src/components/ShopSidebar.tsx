import { Link, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "#/store/auth";
import { t } from "#/i18n";
import {
  LayoutDashboard,
  Store,
  Gift,
  ShoppingBag,
  Bell,
  Receipt,
  Users,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: t.shop.nav.dashboard, icon: LayoutDashboard },
  { to: "/dashboard/profile", label: t.shop.nav.profile, icon: Store },
  { to: "/dashboard/rewards", label: t.shop.nav.rewards, icon: Gift },
  { to: "/dashboard/customers", label: t.shop.nav.customers, icon: Users },
  { to: "/dashboard/products", label: t.shop.nav.products, icon: ShoppingBag },
  { to: "/dashboard/push", label: t.shop.nav.push, icon: Bell },
  { to: "/dashboard/transactions", label: t.shop.nav.transactions, icon: Receipt },
] as const;

export default function ShopSidebar() {
  const { shopName, signOut } = useAuthStore();
  const matchRoute = useMatchRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-base)] px-4 py-3 lg:hidden">
        <p className="text-sm font-bold text-[var(--sea-ink)]">{shopName}</p>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)]"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay — always mounted, animated via opacity */}
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity duration-300 ease-out will-change-[opacity] lg:pointer-events-none lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--line)] bg-[var(--bg-base)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:static lg:transition-[width] lg:will-change-[width] ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:!w-[68px] cursor-pointer" : "lg:!w-64"}`}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
      >
        {/* Header */}
        <div className="flex items-center border-b border-[var(--line)] px-5 py-5">
          <img
            src="/icon.png"
            alt="Logo"
            className={`hidden shrink-0 rounded-sm object-contain transition-all duration-300 lg:block ${
              collapsed ? "size-7 opacity-100" : "size-0 opacity-0"
            }`}
          />
          <div
            className={`min-w-0 overflow-hidden transition-opacity duration-200 ${
              collapsed ? "lg:w-0 lg:opacity-0" : "flex-1 opacity-100"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] whitespace-nowrap">
              {t.shop.kicker}
            </p>
            <p className="mt-1 truncate text-sm font-bold text-[var(--sea-ink)]">
              {shopName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = matchRoute({ to: item.to, fuzzy: item.to === "/dashboard" ? false : true });
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-colors duration-150 ${
                      isActive
                        ? "bg-[var(--lagoon)] !text-white shadow-[0_4px_12px_rgba(240,113,103,0.2)]"
                        : "text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span
                      className={`overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                        collapsed ? "lg:w-0 lg:opacity-0" : "opacity-100"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-[var(--line)] px-3 py-2 lg:block">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-[var(--sea-ink-soft)] transition-colors duration-150 hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <div className="overflow-hidden border-t border-[var(--line)] px-3 py-3">
          <button
            type="button"
            onClick={() => signOut()}
            title={collapsed ? t.dashboard.signOut : undefined}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--sea-ink-soft)] transition-colors duration-150 hover:bg-[var(--surface)] hover:text-red-500"
          >
            <LogOut size={18} className="shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                collapsed ? "lg:w-0 lg:opacity-0" : "opacity-100"
              }`}
            >
              {t.dashboard.signOut}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
