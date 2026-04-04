export default function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 animate-fade-in">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
      </div>
      {text && <p className="text-lg text-slate-400">{text}</p>}
    </div>
  );
}
