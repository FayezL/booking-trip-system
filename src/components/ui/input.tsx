import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full px-4 py-3 text-lg border border-slate-200 rounded-xl min-h-[48px] bg-white transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:ring-blue-400/40 dark:focus-visible:border-blue-400",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
