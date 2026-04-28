"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  activeColor?: string;
}

const sizeMap = {
  sm: { box: "h-4 w-4", radius: "rounded-md", icon: 10 },
  md: { box: "h-5 w-5", radius: "rounded-lg", icon: 12 },
  lg: { box: "h-6 w-6", radius: "rounded-lg", icon: 14 },
};

export default function Toggle({ checked, onChange, disabled = false, size = "md" }: ToggleProps) {
  const s = sizeMap[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center justify-center ${s.box} ${s.radius} shrink-0 cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
        checked
          ? "bg-blue-600 shadow-sm dark:bg-blue-500"
          : "border-2 border-slate-300 bg-white dark:border-gray-600 dark:bg-gray-800"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "active:scale-90"}`}
    >
      {checked && (
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
