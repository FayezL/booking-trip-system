export default function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 animate-fade-in">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-[3px] border-slate-100 dark:border-gray-800" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-blue-500 dark:border-t-blue-400 animate-spin" />
      </div>
      {text && <p className="text-lg text-slate-400 dark:text-gray-400 font-medium">{text}</p>}
    </div>
  );
}
