import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "#/i18n";
import { api } from "#/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Gift,
  ImageOff,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/rewards")({
  component: RewardsPage,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CouponArticle {
  article_id: string | null;
  article_name: string | null;
  discount_value: number;
}

interface Coupon {
  id: string;
  shop_id: string;
  code: string;
  type: "percentage" | "fixed";
  articles: CouponArticle[];
  points_required?: number;
  name?: string;
  description?: string;
  category: string;
  min_purchase_amount: number;
  max_discount_amount?: number;
  expires_at?: string;
  usage_limit?: number;
  used_count: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

interface CouponsResponse {
  success: boolean;
  data: Coupon[];
}

interface Article {
  id: string;
  name: string;
}

interface ArticlesResponse {
  success: boolean;
  data: Article[];
}

type CouponType = Coupon["type"];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.coupons;

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]";

const btnPrimary =
  "rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0";

const btnOutline =
  "rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)]";

interface ArticleRow {
  article_id: string;
  discount_value: number;
}

const EMPTY_ARTICLE: ArticleRow = { article_id: "", discount_value: 0 };

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "percentage" as CouponType,
  is_global: false,
  global_discount_value: 0,
  articles: [{ ...EMPTY_ARTICLE }] as ArticleRow[],
  points_required: 0,
  expires_at: "",
  image_url: "",
  is_active: true,
};

/* ------------------------------------------------------------------ */
/*  Coupon Preview Card (matches mobile app)                           */
/* ------------------------------------------------------------------ */

function CouponPreview({
  name,
  imageUrl,
  pointsRequired,
  expiresAt,
  isActive,
}: {
  name: string;
  imageUrl?: string;
  pointsRequired: number;
  expiresAt?: string;
  isActive?: boolean;
}) {
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString("sl-SI")
    : c.noExpiry;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] transition ${isActive === false ? "opacity-50" : ""}`}
    >
      {/* Image area */}
      <div className="relative aspect-[16/9] w-full bg-[var(--sand)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--sea-ink-soft)]">
            <ImageOff size={32} strokeWidth={1.5} />
          </div>
        )}
        {/* Points badge — top right */}
        {pointsRequired > 0 && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#d4eb3e] px-3 py-1.5 text-sm font-bold text-[#1a1a1a] shadow-md">
            <Gift size={14} />
            {pointsRequired}
          </div>
        )}
      </div>
      {/* Info area */}
      <div className="px-4 py-3">
        <p className="font-bold text-[var(--sea-ink)]">
          {name || "Brez imena"}
        </p>
        <p className="mt-0.5 text-sm text-[var(--sea-ink-soft)]">{expiry}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function RewardsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  useEffect(() => {
    fetchCoupons("");
    fetchArticles();
  }, []);

  /* ---------- data fetching ---------- */

  async function fetchCoupons(q: string) {
    setLoading(true);
    setError(null);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await api.get<CouponsResponse>(
        `/api/shop-admin/coupons${params}`,
      );
      setCoupons(res.data);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function fetchArticles() {
    try {
      const res = await api.get<ArticlesResponse>(
        "/api/shop-admin/articles?active_only=true",
      );
      setArticles(res.data);
    } catch {
      /* ignore — dropdown will just be empty */
    }
  }

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchCoupons(value), 350);
  }

  /* ---------- create / edit ---------- */

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(coupon: Coupon) {
    const hasGlobal = coupon.articles.some((a) => a.article_id === null);
    const articleRows: ArticleRow[] = hasGlobal
      ? [{ ...EMPTY_ARTICLE }]
      : coupon.articles.length > 0
        ? coupon.articles.map((a) => ({
            article_id: a.article_id || "",
            discount_value: a.discount_value ?? 0,
          }))
        : [{ ...EMPTY_ARTICLE }];
    const globalVal = hasGlobal
      ? coupon.articles.find((a) => a.article_id === null)?.discount_value ?? 0
      : 0;
    setForm({
      name: coupon.name || "",
      description: coupon.description || "",
      type: coupon.type,
      is_global: hasGlobal,
      global_discount_value: globalVal,
      articles: articleRows,
      points_required: coupon.points_required ?? 0,
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
      image_url: coupon.image_url || "",
      is_active: coupon.is_active,
    });
    setEditingId(coupon.id);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleModalSave(e: React.FormEvent) {
    e.preventDefault();
    setModalSaving(true);
    setModalError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      is_active: form.is_active,
      points_required: form.points_required || 0,
    };

    if (form.description) payload.description = form.description;
    if (form.expires_at) payload.expires_at = form.expires_at;
    if (form.image_url) payload.image_url = form.image_url;

    if (form.is_global) {
      payload.articles = [
        {
          article_id: null,
          article_name: null,
          discount_value: form.global_discount_value,
        },
      ];
    } else {
      const filledArticles = form.articles.filter((a) => a.article_id);
      if (filledArticles.length > 0) {
        payload.articles = filledArticles.map((a) => {
          const art = articles.find((x) => x.id === a.article_id);
          return {
            article_id: a.article_id,
            article_name: art?.name || null,
            discount_value: a.discount_value,
          };
        });
      }
    }

    try {
      if (editingId) {
        await api.put(`/api/shop-admin/coupons/${editingId}`, payload);
      } else {
        await api.post("/api/shop-admin/coupons", payload);
      }
      setModalOpen(false);
      showFeedback("success", c.saveSuccess);
      fetchCoupons(search);
    } catch {
      setModalError(c.saveError);
    } finally {
      setModalSaving(false);
    }
  }

  /* ---------- delete ---------- */

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/shop-admin/coupons/${deleteTarget.id}`);
      setDeleteTarget(null);
      showFeedback("success", c.deleteSuccess);
      fetchCoupons(search);
    } catch {
      showFeedback("error", c.deleteError);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  /* ---------- helpers ---------- */

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateArticle(index: number, field: keyof ArticleRow, value: string | number) {
    setForm((prev) => {
      const arts = [...prev.articles];
      arts[index] = { ...arts[index], [field]: value };
      return { ...prev, articles: arts };
    });
  }

  function addArticle() {
    setForm((prev) => ({
      ...prev,
      articles: [...prev.articles, { ...EMPTY_ARTICLE }],
    }));
  }

  function removeArticle(index: number) {
    setForm((prev) => ({
      ...prev,
      articles: prev.articles.length > 1
        ? prev.articles.filter((_, i) => i !== index)
        : [{ ...EMPTY_ARTICLE }],
    }));
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="rise-in">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
          {c.title}
        </h1>
        <button type="button" className={btnPrimary} onClick={openCreate}>
          <span className="flex items-center gap-2">
            <Plus size={16} />
            {c.create}
          </span>
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Loading skeleton — card grid */}
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[var(--line)]"
            >
              <div className="skeleton aspect-[16/9] w-full" />
              <div className="p-4">
                <div className="skeleton mb-2 h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coupon card grid */}
      {!loading && !error && (
        <>
          {coupons.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--sea-ink-soft)]">
              {search ? c.noResults : c.noCoupons}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="group relative cursor-pointer"
                  onClick={() => openEdit(coupon)}
                >
                  <CouponPreview
                    name={coupon.name || coupon.code}
                    imageUrl={coupon.image_url}
                    pointsRequired={coupon.points_required ?? 0}
                    expiresAt={coupon.expires_at}
                    isActive={coupon.is_active}
                  />

                  {/* Hover actions overlay */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(coupon)}
                      className="rounded-lg bg-white/90 p-1.5 text-[var(--sea-ink)] shadow-md backdrop-blur-sm transition hover:bg-white hover:text-[var(--lagoon)]"
                      title={c.edit}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(coupon)}
                      className="rounded-lg bg-white/90 p-1.5 text-[var(--sea-ink)] shadow-md backdrop-blur-sm transition hover:bg-white hover:text-red-600"
                      title={c.delete}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Status badge */}
                  {!coupon.is_active && (
                    <div className="absolute left-3 top-3 rounded-full bg-gray-800/70 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      {c.inactive}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- Create / Edit Modal (portalled to body) ---- */}
      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className="island-shell rise-in max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display-title text-lg font-bold text-[var(--sea-ink)]">
                  {editingId ? c.edit : c.create}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 sm:grid-cols-[1fr_360px]">
                {/* Form fields */}
                <form
                  id="coupon-form"
                  onSubmit={handleModalSave}
                  className="space-y-4"
                >
                  <Field label={c.name}>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      required
                    />
                  </Field>

                  {/* Discount settings card */}
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    {/* Type + Target toggles */}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      {/* Type toggle */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                          {c.type}
                        </p>
                        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
                          <button
                            type="button"
                            onClick={() => updateForm("type", "percentage")}
                            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                              form.type === "percentage"
                                ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                            }`}
                          >
                            {c.percentage}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm("type", "fixed")}
                            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                              form.type === "fixed"
                                ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                            }`}
                          >
                            {c.fixed}
                          </button>
                        </div>
                      </div>

                      {/* Target toggle */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                          {c.article}
                        </p>
                        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
                          <button
                            type="button"
                            onClick={() => updateForm("is_global", true)}
                            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                              form.is_global
                                ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                            }`}
                          >
                            {c.globalDiscount}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm("is_global", false)}
                            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                              !form.is_global
                                ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                            }`}
                          >
                            {c.article}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="mb-3 text-xs text-[var(--sea-ink-soft)]">
                      {form.type === "percentage"
                        ? form.is_global
                          ? c.percentageGlobalHint
                          : c.percentageArticleHint
                        : form.is_global
                          ? c.fixedGlobalHint
                          : c.fixedArticleHint}
                    </p>

                    {form.is_global ? (
                      <div className="relative max-w-[200px]">
                        <input
                          type="number"
                          className={`${inputClass} pr-8`}
                          value={form.global_discount_value || ""}
                          min={0}
                          placeholder="0"
                          onChange={(e) =>
                            updateForm(
                              "global_discount_value",
                              e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0,
                            )
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--sea-ink-soft)]">
                          {form.type === "percentage" ? "%" : "€"}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Article rows */}
                        <div className="space-y-2">
                          {form.articles.map((row, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_100px_28px] items-center gap-2"
                            >
                              <select
                                className={inputClass}
                                value={row.article_id}
                                onChange={(e) =>
                                  updateArticle(
                                    i,
                                    "article_id",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">{c.selectArticle}</option>
                                {articles.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                              <div className="relative">
                                <input
                                  type="number"
                                  className={`${inputClass} pr-6`}
                                  value={row.discount_value || ""}
                                  min={0}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateArticle(
                                      i,
                                      "discount_value",
                                      e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--sea-ink-soft)]">
                                  {form.type === "percentage" ? "%" : "€"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeArticle(i)}
                                className="flex h-[40px] items-center justify-center rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-red-50 hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {/* Add article */}
                        <button
                          type="button"
                          onClick={addArticle}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--line)] py-2 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:border-[var(--lagoon)] hover:text-[var(--lagoon-deep)]"
                        >
                          <Plus size={14} /> {c.article}
                        </button>
                      </>
                    )}
                  </div>

                  <Field label={c.pointsRequired}>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.points_required || ""}
                      min={0}
                      placeholder="0"
                      onChange={(e) =>
                        updateForm(
                          "points_required",
                          e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0,
                        )
                      }
                    />
                  </Field>

                  <Field label={c.description}>
                    <textarea
                      className={`${inputClass} min-h-[60px] resize-y`}
                      value={form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={2}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={c.expirationDate}>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className={`${inputClass} flex-1`}
                          value={form.expires_at}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e) =>
                            updateForm("expires_at", e.target.value)
                          }
                        />
                        {form.expires_at && (
                          <button
                            type="button"
                            onClick={() => updateForm("expires_at", "")}
                            className="shrink-0 rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-red-50 hover:text-red-600"
                            title={c.noExpiry}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <span className="mt-1 block text-xs text-[var(--sea-ink-soft)]">
                        {form.expires_at ? "" : c.noExpiry}
                      </span>
                    </Field>

                    <Field label={c.imageUrl}>
                      <input
                        type="url"
                        className={inputClass}
                        value={form.image_url}
                        onChange={(e) =>
                          updateForm("image_url", e.target.value)
                        }
                        placeholder="https://..."
                      />
                    </Field>
                  </div>

                  {/* Active toggle */}
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        updateForm("is_active", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-[var(--line)] accent-[var(--lagoon)]"
                    />
                    <span className="text-sm font-medium text-[var(--sea-ink)]">
                      {c.activeToggle}
                    </span>
                  </label>

                  {modalError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {modalError}
                    </p>
                  )}
                </form>

                {/* Live preview */}
                <div className="flex flex-col gap-2">
                  <p className={labelClass}>{c.preview}</p>
                  <CouponPreview
                    name={form.name}
                    imageUrl={form.image_url || undefined}
                    pointsRequired={form.points_required}
                    expiresAt={form.expires_at || undefined}
                    isActive={form.is_active}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = coupons.find((cp) => cp.id === editingId);
                      if (target) {
                        setModalOpen(false);
                        setDeleteTarget(target);
                      }
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <Trash2 size={13} /> {c.delete}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={() => setModalOpen(false)}
                  >
                    {c.cancel}
                  </button>
                  <button
                    type="submit"
                    form="coupon-form"
                    className={btnPrimary}
                    disabled={modalSaving}
                  >
                    {modalSaving ? c.saving : c.save}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ---- Delete Confirmation Dialog (portalled to body) ---- */}
      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteTarget(null);
            }}
          >
            <div className="island-shell rise-in w-full max-w-sm rounded-2xl p-6 text-center">
              <h3 className="display-title mb-2 text-lg font-bold text-[var(--sea-ink)]">
                {c.deleteTitle}
              </h3>
              <p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
                {c.deleteConfirm}
              </p>
              <p className="mb-5 text-sm font-semibold text-[var(--sea-ink)]">
                {deleteTarget.name || deleteTarget.code}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => setDeleteTarget(null)}
                >
                  {c.cancel}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {deleting ? c.deleting : c.delete}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field helper                                                       */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
