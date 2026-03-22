import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { t } from "#/i18n";
import { api } from "#/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ShopProfilePage,
  head: () => ({
    meta: [{ title: "Profil trgovine — Zvest" }],
  }),
});

interface ShopData {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  tag_text: string;
  address: string;
  category: string;
  brand_color: string;
  image_url: string;
  loyalty_program_type: string;
  points_per_euro: number;
  qr_display_text: string;
}

interface ShopResponse {
  success: boolean;
  data: ShopData;
}

const CATEGORIES = [
  "bar",
  "restaurant",
  "bakery",
  "wellness",
  "pastry",
  "cafe",
  "retail",
  "other",
] as const;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const TAG_MAX_LENGTH = 50;

const p = t.shop.profile;

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]";

function ShopProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    description: "",
    tag_text: "",
    address: "",
    category: "other",
    brand_color: "#f07167",
    points_per_euro: 1,
    qr_display_text: "",
  });

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loyaltyType, setLoyaltyType] = useState("points");
  const initialForm = useRef(form);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);

  useEffect(() => {
    fetchShop();
  }, []);

  async function fetchShop() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ShopResponse>("/api/shop-admin/shop");
      const data = res.data;
      const newForm = {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        website: data.website || "",
        description: data.description || "",
        tag_text: data.tag_text || "",
        address: data.address || "",
        category: data.category || "other",
        brand_color: data.brand_color || "#f07167",
        points_per_euro: data.points_per_euro ?? 1,
        qr_display_text: data.qr_display_text || "",
      };
      setForm(newForm);
      initialForm.current = newForm;
      setImageUrl(data.image_url || null);
      setLoyaltyType(data.loyalty_program_type || "points");
    } catch {
      setError(p.loadError);
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Omit empty optional string fields so Zod doesn't reject "" as invalid url etc.
      const optionalFields = ["website", "phone", "email", "tag_text", "address", "description"] as const;
      for (const key of optionalFields) {
        const val = (form[key] as string).trim();
        if (!val) {
          delete payload[key];
        } else {
          payload[key] = val;
        }
      }
      await api.put("/api/shop-admin/shop", payload);
      initialForm.current = { ...form };
      setSuccess(p.saveSuccess);
    } catch {
      setError(p.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadStatus(p.invalidFileType);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadStatus(p.fileTooLarge);
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      await api.upload("/api/shop-admin/shop/image", fd);
      setUploadStatus(p.uploadSuccess);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchShop();
    } catch {
      setUploadStatus(p.uploadError);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="rise-in space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="island-shell rounded-2xl p-6">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton mb-2 h-3 w-20" />
                  <div className="skeleton h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="island-shell rounded-2xl p-6">
              <div className="skeleton h-32 w-full rounded-lg" />
            </div>
            <div className="island-shell rounded-2xl p-6">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="skeleton mb-2 h-3 w-20" />
                    <div className="skeleton h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <h1 className="display-title mb-6 text-2xl font-bold text-[var(--sea-ink)]">
        {p.title}
      </h1>

      <form onSubmit={handleSave}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Left column: Basic Info */}
          <section className="island-shell rounded-2xl p-6">
            <h2 className="island-kicker mb-4">{p.basicInfo}</h2>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={p.shopName}>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </Field>
                <Field label={p.email}>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={p.phone}>
                  <input
                    type="tel"
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </Field>
                <Field label={p.website}>
                  <input
                    type="url"
                    className={inputClass}
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://"
                  />
                </Field>
              </div>

              <Field label={p.description}>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={p.tagText}>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.tag_text}
                    maxLength={TAG_MAX_LENGTH}
                    onChange={(e) => updateField("tag_text", e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-[var(--sea-ink-soft)]">
                    {TAG_MAX_LENGTH - form.tag_text.length} {p.charsRemaining}
                  </span>
                </Field>
                <Field label={p.category}>
                  <select
                    className={inputClass}
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {p.categories[cat] ?? cat}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={p.address}>
                <textarea
                  className={`${inputClass} resize-y`}
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  rows={2}
                />
              </Field>

              <Field label={p.brandColor}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.brand_color}
                    onChange={(e) => updateField("brand_color", e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    className={`${inputClass} flex-1 font-mono`}
                    value={form.brand_color}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        updateField("brand_color", v);
                      }
                    }}
                    placeholder="#f07167"
                    maxLength={7}
                  />
                  <div
                    className="h-10 w-16 rounded-lg border border-[var(--line)]"
                    style={{ backgroundColor: form.brand_color }}
                    title={p.colorPreview}
                  />
                </div>
              </Field>
            </div>
          </section>

          {/* Right column: Image + Loyalty stacked */}
          <div className="space-y-6">
            {/* Section B: Image Upload */}
            <section className="island-shell rounded-2xl p-6">
              <h2 className="island-kicker mb-4">{p.imageUpload}</h2>

              {imageUrl && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                    {p.currentImage}
                  </p>
                  <img
                    src={imageUrl}
                    alt={form.name}
                    className="h-32 w-32 rounded-xl border border-[var(--line)] object-cover"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    className="block w-full text-sm text-[var(--sea-ink-soft)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--lagoon-deep)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--lagoon)]"
                  />
                  <span className="mt-1 block text-xs text-[var(--sea-ink-soft)]">
                    {p.imageHint}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={uploading}
                  className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {uploading ? p.uploading : p.uploadImage}
                </button>
              </div>

              {uploadStatus && (
                <p
                  className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                    uploadStatus === p.uploadSuccess
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {uploadStatus}
                </p>
              )}
            </section>

            {/* Section C: Loyalty Settings */}
            <section className="island-shell rounded-2xl p-6">
              <h2 className="island-kicker mb-4">{p.loyalty}</h2>

              <div className="space-y-4">
                <Field label={p.programType}>
                  <input
                    type="text"
                    className={`${inputClass} cursor-not-allowed opacity-60`}
                    value={loyaltyType === "points" ? p.points : loyaltyType}
                    readOnly
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={p.pointsPerEuro}>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.points_per_euro}
                      min={1}
                      max={1000}
                      onChange={(e) =>
                        updateField(
                          "points_per_euro",
                          Math.min(
                            1000,
                            Math.max(1, Number(e.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={p.qrDisplayText}>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.qr_display_text}
                      onChange={(e) =>
                        updateField("qr_display_text", e.target.value)
                      }
                    />
                    <span className="mt-1 block text-xs text-[var(--sea-ink-soft)]">
                      {p.qrHint}
                    </span>
                  </Field>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Status messages + save button — full width below the grid */}
        <div className="mt-6 space-y-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !isDirty}
            className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saving ? p.saving : isDirty ? `● ${p.save}` : p.save}
          </button>
        </div>
      </form>
    </div>
  );
}

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
