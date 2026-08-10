import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-deep/70 bg-deep text-white shadow-[0_18px_40px_rgba(30,55,55,0.22)] hover:-translate-y-0.5 hover:bg-deep/94 hover:shadow-[0_24px_44px_rgba(30,55,55,0.24)] disabled:border-deep/30 disabled:bg-deep/55 disabled:shadow-none",
  secondary:
    "border border-line-strong bg-white/72 text-accent-strong hover:-translate-y-0.5 hover:bg-white/92 disabled:bg-white/60",
  ghost:
    "border border-line bg-transparent text-foreground hover:-translate-y-0.5 hover:bg-white/36 disabled:bg-transparent",
};

export function Button({
  className,
  children,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold tracking-[0.02em] transition-all duration-200 disabled:cursor-not-allowed",
        variantMap[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
