import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-lg font-semibold min-h-[48px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 dark:shadow-blue-400/10",
        destructive:
          "bg-red-50 text-red-600 min-h-[44px] hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950",
        outline:
          "border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
        ghost:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        default: "py-3 px-6",
        sm: "py-2 px-3 text-sm min-h-[44px] rounded-lg",
        lg: "py-3 px-8 text-xl",
        icon: "min-h-[44px] min-w-[44px] p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
