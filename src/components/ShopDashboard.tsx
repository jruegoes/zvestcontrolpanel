import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "#/store/auth";
import { supabase } from "#/supabase";
import { t } from "#/i18n";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  QrCode,
  Target,
  Ticket,
  ArrowUpRight,
  AlertTriangle,
  Star,
  ShoppingBag,
  Heart,
} from "lucide-react";

/* ── formatters ── */

function fmt(n: number | undefined | null) {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

function num(n: number | undefined | null) {
  return new Intl.NumberFormat("sl-SI").format(Number(n) || 0);
}

function pct(n: number | undefined | null) {
  const v = Number(n) || 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Pravkar";
  if (mins < 60) return `${mins} min nazaj`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h nazaj`;
  return `${Math.floor(hours / 24)}d nazaj`;
}

/* ── small components ── */

type Period = "today" | "7d" | "30d";

function PeriodPicker({ value, onChange, options }: { value: Period; onChange: (p: Period) => void; options: Period[] }) {
  const labels: Record<Period, string> = { today: "Danes", "7d": "7d", "30d": "30d" };
  return (
    <div className="flex gap-1">
      {options.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider transition ${
            value === p
              ? "bg-[var(--lagoon)] text-white"
              : "text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]"
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}

function ProgressBar({ value, max, color = "var(--lagoon)" }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="island-shell rounded-xl p-4 sm:rounded-2xl sm:p-5">
      <div className="skeleton mb-2 h-3 w-20" />
      <div className="skeleton h-7 w-28" />
    </div>
  );
}

/* ── main ── */

const w = t.shop.widgets;

export default function ShopDashboard() {
  const { shopName, shopId } = useAuthStore();
  // biome-ignore lint: flexible rpc shape
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period state per card
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("today");
  const [txPeriod, setTxPeriod] = useState<Period>("today");
  const [qrPeriod, setQrPeriod] = useState<Period>("today");
  const [couponPeriod, setCouponPeriod] = useState<Period>("today");

  const fetchData = useCallback(async () => {
    if (!shopId) return;
    const { data: result, error: err } = await supabase.rpc("get_shop_dashboard", { p_shop_id: shopId });

    if (err) {
      setError(err.message);
    } else {
      const row = Array.isArray(result) ? result[0] : result;
      setData(row ?? {});
    }
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rise-in">
        <div className="mb-6">
          <div className="skeleton mb-1 h-7 w-48" />
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="island-shell rounded-xl p-5 sm:rounded-2xl sm:p-6">
              <div className="skeleton mb-4 h-5 w-36" />
              <div className="skeleton mb-3 h-3 w-full" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rise-in">
        <h1 className="display-title mb-2 text-2xl font-bold text-[var(--sea-ink)]">{shopName}</h1>
        <div className="island-shell mt-4 rounded-xl p-6 sm:rounded-2xl sm:p-8">
          <p className="text-sm text-red-600">Napaka pri nalaganju nadzorne plošče.</p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{error}</p>
        </div>
      </div>
    );
  }

  const d = data ?? {};
  const revenue = d.revenue ?? {};
  const transactions = d.transactions ?? {};
  const qrScans = d.qr_scans ?? {};
  const customersToday = d.customers_today ?? {};
  const loyalty = d.loyalty ?? {};
  const coupons = d.coupons ?? {};
  const topCoupon = d.top_coupon_today ?? {};
  const topProduct = d.top_product_today ?? {};
  const ratings = d.ratings ?? {};
  const recentTx: any[] = d.recent_transactions ?? [];

  // Revenue by period
  const revenueVal = revenuePeriod === "today" ? revenue.today : revenuePeriod === "7d" ? revenue.last_7d : revenue.last_30d;
  const vsYesterday = Number(revenue.vs_yesterday) || 0;
  const isUp = vsYesterday >= 0;

  // Transactions by period
  const txCount = txPeriod === "today" ? transactions.today : txPeriod === "7d" ? transactions.last_7d : transactions.last_30d;
  const txAvg = txPeriod === "today" ? transactions.avg_value_today : transactions.avg_value_30d;

  // Coupons by period
  const couponRedemptions = couponPeriod === "today" ? coupons.redemptions_today : couponPeriod === "7d" ? coupons.redemptions_7d : coupons.redemptions_30d;

  return (
    <div className="rise-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="display-title mb-1 text-2xl font-bold text-[var(--sea-ink)]">{shopName}</h1>
        <p className="text-sm text-[var(--sea-ink-soft)]">{t.shop.kicker}</p>
      </div>

      {/* ── Row 1: Key metrics ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">

        {/* Revenue */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "80ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(240,113,103,0.12)" }}>
              <Receipt className="h-4 w-4 text-[var(--lagoon)]" />
            </div>
            <PeriodPicker value={revenuePeriod} onChange={setRevenuePeriod} options={["today", "7d", "30d"]} />
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            {w.todayRevenue}
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">{fmt(revenueVal)}</p>
          {revenuePeriod === "today" && (
            <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${isUp ? "text-green-600" : "text-red-500"}`}>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{pct(vsYesterday)} {w.vsYesterday}</span>
            </div>
          )}
        </article>

        {/* Transactions */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "160ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(34,197,94,0.12)" }}>
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            </div>
            <PeriodPicker value={txPeriod} onChange={setTxPeriod} options={["today", "7d", "30d"]} />
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            Transakcije
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">{num(txCount)}</p>
          <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Ø {fmt(txAvg)}
          </div>
        </article>

        {/* Active Customers Today */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "240ms" }}>
          <div className="mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(244,162,97,0.12)" }}>
              <Users className="h-4 w-4 text-[var(--palm)]" />
            </div>
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            {w.activeCustomers}
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">{num(customersToday.active)}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--sea-ink-soft)]">
            <span>{Number(customersToday.new) || 0} {w.newCustomers.toLowerCase()}</span>
            <span>·</span>
            <span>{Number(customersToday.returning) || 0} {w.returningCustomers.toLowerCase()}</span>
          </div>
        </article>

        {/* QR Scan Rate */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "320ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(59,130,246,0.12)" }}>
              <QrCode className="h-4 w-4 text-blue-600" />
            </div>
            <PeriodPicker value={qrPeriod} onChange={setQrPeriod} options={["today", "7d", "30d"]} />
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            {w.qrScanRate}
          </p>
          {(() => {
            const scanned = Number(qrPeriod === "today" ? qrScans.scanned_today : qrPeriod === "7d" ? qrScans.scanned_7d : qrScans.scanned_30d) || 0;
            const unscanned = Number(qrPeriod === "today" ? qrScans.unscanned_today : qrPeriod === "7d" ? qrScans.unscanned_7d : qrScans.unscanned_30d) || 0;
            const total = scanned + unscanned;
            const rate = total > 0 ? (scanned / total) * 100 : 0;
            return (
              <>
                <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">
                  {rate.toFixed(1)}%
                </p>
                <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  {num(scanned)} / {num(total)} skeniranih
                </div>
              </>
            );
          })()}
        </article>
      </div>

      {/* ── Row 2: Loyalty + Coupons + Ratings + Top Product ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">

        {/* Loyalty */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "400ms" }}>
          <div className="mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(168,85,247,0.12)" }}>
              <Heart className="h-4 w-4 text-purple-500" />
            </div>
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            Zvestoba
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">{num(loyalty.total_members)}</p>
          <div className="mt-1 space-y-0.5 text-xs text-[var(--sea-ink-soft)]">
            <p>{num(loyalty.points_given_today)} točk danes</p>
            <p>{(Number(loyalty.repeat_customer_rate) || 0).toFixed(0)}% vračajočih</p>
          </div>
        </article>

        {/* Coupons */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "480ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(240,113,103,0.12)" }}>
              <Ticket className="h-4 w-4 text-[var(--lagoon)]" />
            </div>
            <PeriodPicker value={couponPeriod} onChange={setCouponPeriod} options={["today", "7d", "30d"]} />
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            Kuponi
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">{num(couponRedemptions)}</p>
          <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            {num(coupons.active_count)} aktivnih · {fmt(coupons.discount_given_today)} popusta danes
          </div>
        </article>

        {/* Ratings */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "560ms" }}>
          <div className="mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(250,204,21,0.15)" }}>
              <Star className="h-4 w-4 text-yellow-500" />
            </div>
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            Ocene
          </p>
          <p className="display-title text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">
            {(Number(ratings.avg_rating) || 0).toFixed(1)} <span className="text-base text-yellow-500">★</span>
          </p>
          <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            {num(ratings.total_ratings)} ocen · {num(ratings.ratings_today)} danes
          </div>
        </article>

        {/* Top Product Today */}
        <article className="island-shell feature-card rise-in rounded-xl p-4 sm:rounded-2xl sm:p-5" style={{ animationDelay: "640ms" }}>
          <div className="mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(244,162,97,0.12)" }}>
              <ShoppingBag className="h-4 w-4 text-[var(--palm)]" />
            </div>
          </div>
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] sm:text-xs">
            Top produkt danes
          </p>
          {topProduct.name ? (
            <>
              <p className="display-title truncate text-base font-bold text-[var(--sea-ink)] sm:text-lg">{topProduct.name}</p>
              <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                {num(topProduct.units_sold)} prodanih · {fmt(topProduct.revenue)}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--sea-ink-soft)]">Ni podatkov</p>
          )}
        </article>
      </div>

      {/* ── Row 3: QR Revenue Breakdown + Top Coupon ── */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">

        {/* QR Revenue Breakdown */}
        <article className="island-shell rise-in rounded-xl p-5 sm:rounded-2xl sm:p-6" style={{ animationDelay: "720ms" }}>
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-[var(--lagoon)]" />
            <h2 className="text-sm font-bold text-[var(--sea-ink)]">QR prihodek danes</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--sea-ink-soft)]">Skenirano</span>
                <span className="font-semibold text-[var(--sea-ink)]">{fmt(qrScans.scanned_revenue_today)}</span>
              </div>
              <ProgressBar
                value={Number(qrScans.scanned_revenue_today) || 0}
                max={(Number(qrScans.scanned_revenue_today) || 0) + (Number(qrScans.unscanned_revenue_today) || 0) || 1}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--sea-ink-soft)]">Neskenirano</span>
                <span className="font-semibold text-[var(--sea-ink)]">{fmt(qrScans.unscanned_revenue_today)}</span>
              </div>
              <ProgressBar
                value={Number(qrScans.unscanned_revenue_today) || 0}
                max={(Number(qrScans.scanned_revenue_today) || 0) + (Number(qrScans.unscanned_revenue_today) || 0) || 1}
                color="var(--palm)"
              />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
              <span className="font-medium text-[var(--sea-ink-soft)]">Skupaj danes</span>
              <span className="font-bold text-[var(--sea-ink)]">{fmt(revenue.today)}</span>
            </div>
          </div>
        </article>

        {/* Top Coupon + Loyalty Summary */}
        <article className="island-shell rise-in rounded-xl p-5 sm:rounded-2xl sm:p-6" style={{ animationDelay: "800ms" }}>
          <div className="mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-[var(--palm)]" />
            <h2 className="text-sm font-bold text-[var(--sea-ink)]">Top kupon danes</h2>
          </div>

          {topCoupon.name ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--sea-ink)]">{topCoupon.name}</p>
              <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                {num(topCoupon.redemptions)} {w.redemptions}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--sea-ink-soft)]">{w.noCoupons}</p>
          )}

          <div className="mt-5">
            <p className="island-kicker mb-2">Zvestoba danes</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">Točke dodeljene</p>
                <p className="display-title text-lg font-bold text-[var(--sea-ink)]">{num(loyalty.points_given_today)}</p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">Točke unovčene</p>
                <p className="display-title text-lg font-bold text-[var(--sea-ink)]">{num(loyalty.points_redeemed_today)}</p>
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* ── Row 4: Recent Transactions ── */}
      <article className="island-shell rise-in mt-5 rounded-xl p-5 sm:rounded-2xl sm:p-6" style={{ animationDelay: "880ms" }}>
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[var(--lagoon)]" />
          <h2 className="text-sm font-bold text-[var(--sea-ink)]">{w.recentTransactions}</h2>
        </div>

        {recentTx.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">{w.noTransactions}</p>
        ) : (
          <ul className="space-y-2">
            {recentTx.map((tx: any) => (
              <li key={tx.id} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--sea-ink)]">
                      {tx.first_name || tx.pos_invoice_id || tx.id?.slice(0, 8)}
                    </p>
                    {tx.was_scanned && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-blue-700">QR</span>
                    )}
                  </div>
                  <p className="text-[0.65rem] text-[var(--sea-ink-soft)]">{tx.created_at ? timeAgo(tx.created_at) : ""}</p>
                </div>
                <div className="ml-3 text-right">
                  <p className="text-sm font-bold text-[var(--sea-ink)]">{fmt(tx.total_amount)}</p>
                  <span className={`text-[0.6rem] font-semibold uppercase tracking-wide ${
                    tx.status === "completed" ? "text-green-600" : "text-[var(--palm)]"
                  }`}>
                    {tx.status === "completed" ? w.completed : w.pending}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
