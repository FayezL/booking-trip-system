import { isDemo } from "@/lib/env";

export default function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div
      role="region"
      aria-label="Demo environment notice"
      className="w-full bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 text-center text-sm font-medium">
        <span className="font-bold">Demo Environment</span> — This site contains
        fictional data for demonstration purposes. Changes may be reset
        automatically.
      </div>
    </div>
  );
}
