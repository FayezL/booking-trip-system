"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-base font-semibold shadow-lg shadow-black/10 dark:shadow-black/30 animate-slide-down pointer-events-auto backdrop-blur-sm ${
              toast.type === "success"
                ? "bg-blue-600/95 dark:bg-blue-500/95 text-white"
                : "bg-red-600/95 dark:bg-red-500/95 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 opacity-90" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 opacity-90" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
