"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  activeColor?: string;
}

const sizeMap = {
  sm: { track: "h-5 w-9", thumb: "h-3.5 w-3.5", translate: "translate-x-4", icon: 10 },
  md: { track: "h-6 w-11", thumb: "h-4.5 w-4.5", translate: "translate-x-5", icon: 12 },
  lg: { track: "h-7 w-12", thumb: "h-6 w-6", translate: "translate-x-5", icon: 14 },
};

export default function Toggle({ checked, onChange, disabled = false, size = "md", activeColor }: ToggleProps) {
  const s = sizeMap[size];
  const activeBg = activeColor || "bg-blue-600";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex ${s.track} shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
        checked
          ? `${activeBg} shadow-[0_0_8px_rgba(59,130,246,0.5)]`
          : "bg-slate-300 dark:bg-gray-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-flex items-center justify-center ${s.thumb} transform rounded-full bg-white shadow-md transition-all duration-300 ease-in-out ${
          checked ? s.translate : "translate-x-0.5"
        }`}
      >
        {checked ? (
          <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </span>
    </button>
  );
}
