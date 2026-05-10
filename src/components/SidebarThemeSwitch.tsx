import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type ThemeMode = "light" | "dark" | "auto";

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }

  document.documentElement.style.colorScheme = resolved;
}

const MODES: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Svetla", Icon: Sun },
  { value: "dark", label: "Temna", Icon: Moon },
  { value: "auto", label: "Sistemska", Icon: Monitor },
];

export default function SidebarThemeSwitch({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const initial = getInitialMode();
    setMode(initial);
    applyThemeMode(initial);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("auto");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  function setTheme(next: ThemeMode) {
    setMode(next);
    applyThemeMode(next);
    window.localStorage.setItem("theme", next);
  }

  function cycle() {
    const next: ThemeMode =
      mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
    setTheme(next);
  }

  if (collapsed) {
    const Active = MODES.find((m) => m.value === mode)?.Icon ?? Monitor;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cycle();
        }}
        title={`Tema: ${MODES.find((m) => m.value === mode)?.label}`}
        className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-[var(--sea-ink-soft)] transition-colors duration-150 hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
      >
        <Active size={18} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
      {MODES.map(({ value, label, Icon }) => {
        const isActive = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            className={`flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? "bg-[var(--lagoon)] !text-white shadow-[0_2px_8px_rgba(240,113,103,0.25)]"
                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
            }`}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
