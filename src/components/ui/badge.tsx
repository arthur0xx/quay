import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        sandbox: "bg-accent text-accent-fg",
        muted: "bg-fg/8 text-muted",
        success: "bg-success/12 text-success",
        danger: "bg-danger/12 text-danger",
      },
    },
    defaultVariants: { variant: "muted" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
