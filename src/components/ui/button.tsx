import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-semibold cursor-pointer transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground shadow-[0_5px_11px_oklch(0.28_0.05_264_/_0.1)] hover:-translate-y-px hover:bg-primary/94 hover:shadow-raised",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground shadow-none hover:-translate-y-px hover:border-ring/60 hover:bg-card hover:shadow-card",
        secondary:
          "border border-accent bg-accent text-accent-foreground shadow-none hover:-translate-y-px hover:bg-accent/75",
        ghost: "text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
        link: "text-accent-foreground shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[15px] py-2.5",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-[11px] px-6 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
