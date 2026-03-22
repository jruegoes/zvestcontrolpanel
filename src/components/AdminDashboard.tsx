import { useEffect, useRef, useState } from "react";
import { supabase } from "#/supabase";
import { t } from "#/i18n";
import type { ShopStats } from "#/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function num(n: number) {
  return new Intl.NumberFormat("sl-SI").format(n);
}

function StatCard({
  label,
  value,
  delay,
}: {
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <article
      className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:mb-1 sm:text-xs">
        {label}
      </p>
      <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">
        {value}
      </p>
    </article>
  );
}

function ShopPicker({
  shops,
  selectedId,
  onSelect,
}: {
  shops: ShopStats[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = shops.find((s) => s.shop_id === selectedId);
  const filtered = shops.filter((s) =>
    s.shop_name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-80">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-left text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[var(--lagoon)]"
      >
        <span className="truncate">{selected?.shop_name ?? "—"}</span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-[var(--sea-ink-soft)] transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-base)] shadow-[0_12px_32px_rgba(61,28,26,0.18)]">
          <div className="border-b border-[var(--line)] p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Iskanje..."
              autoFocus
              className="w-full rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)]"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-[var(--sea-ink-soft)]">
                Ni rezultatov
              </li>
            ) : (
              filtered.map((shop) => (
                <li key={shop.shop_id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(shop.shop_id);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--surface)] ${
                      shop.shop_id === selectedId
                        ? "font-semibold text-[var(--lagoon)]"
                        : "text-[var(--sea-ink)]"
                    }`}
                  >
                    {shop.shop_name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ShopDetail({ shop }: { shop: ShopStats }) {
  return (
    <div className="rise-in">
      <h2 className="display-title mb-4 text-xl font-bold text-[var(--sea-ink)] sm:mb-5 sm:text-2xl">
        {shop.shop_name}
      </h2>

      <div>
        <p className="island-kicker mb-2 sm:mb-3">{t.admin.revenueAllTime}</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={t.admin.revenueAllTime} value={fmt(Number(shop.revenue_all_time))} delay={80} />
          <StatCard label={t.admin.revenue30d} value={fmt(Number(shop.revenue_30d))} delay={160} />
          <StatCard label={t.admin.revenue7d} value={fmt(Number(shop.revenue_7d))} delay={240} />
          <StatCard label={t.admin.revenueToday} value={fmt(Number(shop.revenue_today))} delay={320} />
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <p className="island-kicker mb-2 sm:mb-3">{t.admin.transactions}</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={t.admin.transactions} value={num(Number(shop.transactions_all_time))} delay={400} />
          <StatCard label={t.admin.transactionsToday} value={num(Number(shop.transactions_today))} delay={480} />
          <StatCard label={t.admin.scansAllTime} value={num(Number(shop.scans_all_time))} delay={560} />
          <StatCard label={t.admin.scansToday} value={num(Number(shop.scans_today))} delay={640} />
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <p className="island-kicker mb-2 sm:mb-3">{t.admin.loyaltyUsers}</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
          <StatCard label={t.admin.loyaltyUsers} value={num(Number(shop.loyalty_users))} delay={720} />
          <StatCard label={t.admin.redemptionsToday} value={num(Number(shop.redemptions_today))} delay={800} />
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <p className="island-kicker mb-2 sm:mb-3">{t.admin.redemptionsAllTime}</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={t.admin.redemptionsAllTime} value={num(Number(shop.redemptions_all_time))} delay={880} />
          <StatCard label={t.admin.redemptions30d} value={num(Number(shop.redemptions_30d))} delay={960} />
          <StatCard label={t.admin.redemptions7d} value={num(Number(shop.redemptions_7d))} delay={1040} />
          <StatCard label={t.admin.redemptionsToday} value={num(Number(shop.redemptions_today))} delay={1120} />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<ShopStats[]>([]);
  const [platformStats, setPlatformStats] = useState<{
    app_users_all_time: number;
    app_users_30d: number;
    app_users_7d: number;
    app_users_today: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      const [shopRes, platformRes] = await Promise.all([
        supabase.rpc("get_admin_shop_stats"),
        supabase.rpc("get_admin_platform_stats"),
      ]);

      if (shopRes.error) {
        setError(shopRes.error.message);
      } else {
        setData(shopRes.data ?? []);
        const active = (shopRes.data ?? []).filter(
          (s: ShopStats) => s.shop_status === "active"
        );
        if (active.length > 0) {
          setSelectedShopId(active[0].shop_id);
        }
      }

      if (platformRes.data?.[0]) {
        const s = platformRes.data[0];
        setPlatformStats({
          app_users_all_time: Number(s.app_users_all_time) || 0,
          app_users_30d: Number(s.app_users_30d) || 0,
          app_users_7d: Number(s.app_users_7d) || 0,
          app_users_today: Number(s.app_users_today) || 0,
        });
      }

      setLoading(false);
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="island-shell rounded-xl p-4 sm:rounded-2xl sm:p-5">
              <div className="skeleton mb-2 h-3 w-20" />
              <div className="skeleton h-7 w-24" />
            </div>
          ))}
        </div>
        <div className="mt-6 sm:mt-8">
          <div className="skeleton mb-5 h-10 w-full sm:w-80" />
          <div className="skeleton mb-4 h-6 w-48 sm:mb-5" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="island-shell rounded-xl p-4 sm:rounded-2xl sm:p-5">
                <div className="skeleton mb-2 h-3 w-16" />
                <div className="skeleton h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="island-shell rounded-xl p-6 sm:rounded-2xl sm:p-8">
        <p className="text-sm text-red-600">{t.admin.errorLoading}</p>
        <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{error}</p>
      </div>
    );
  }

  const activeShops = data.filter((s) => s.shop_status === "active");
  const pendingShops = data.filter((s) => s.shop_status.startsWith("pending"));
  const totalScansToday = data.reduce((sum, s) => sum + Number(s.scans_today), 0);
  const totalRedemptionsToday = data.reduce((sum, s) => sum + Number(s.redemptions_today), 0);
  const selectedShop = data.find((s) => s.shop_id === selectedShopId) ?? null;

  const topStats = [
    { label: t.admin.appUsersAllTime, value: num(platformStats?.app_users_all_time ?? 0) },
    { label: t.admin.activeShops, value: num(activeShops.length) },
    { label: t.admin.scansToday, value: num(totalScansToday) },
    { label: t.admin.redemptionsToday, value: num(totalRedemptionsToday) },
  ];

  return (
    <div>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {topStats.map((stat, i) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} delay={i * 90 + 80} />
        ))}
      </section>

      {activeShops.length > 0 && (
        <section className="mt-6 sm:mt-8">
          <div className="mb-5 sm:mb-6">
            <ShopPicker
              shops={activeShops}
              selectedId={selectedShopId}
              onSelect={setSelectedShopId}
            />
          </div>

          {selectedShop && <ShopDetail key={selectedShop.shop_id} shop={selectedShop} />}
        </section>
      )}
    </div>
  );
}
