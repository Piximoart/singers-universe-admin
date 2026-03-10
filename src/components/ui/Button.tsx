"use client";

import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "tonal" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  state?: "default" | "hover" | "focus" | "active" | "loading" | "disabled";
  density?: "comfortable" | "compact";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  density = "comfortable",
  loading,
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 select-none",
        "font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        {
          "bg-lime text-dark hover:brightness-105 active:scale-[0.98]": variant === "primary",
          "bg-s3 text-white hover:bg-s4 active:scale-[0.98]": variant === "secondary",
          "bg-m3-primary-container text-m3-on-primary-container hover:brightness-105 active:scale-[0.98]": variant === "tonal",
          "text-sub hover:text-white bg-transparent": variant === "ghost",
          "bg-red-600/20 text-red-200 hover:bg-red-600/30": variant === "danger",
        },
        {
          "text-xs tracking-wide": size === "sm",
          "text-sm tracking-wide": size === "md",
          "text-base tracking-tight font-display": size === "lg",
        },
        {
          "px-3 py-2": density === "compact" && size === "sm",
          "px-4 py-2.5": density === "compact" && size === "md",
          "px-5 py-3": density === "compact" && size === "lg",
          "px-3.5 py-2.5": density === "comfortable" && size === "sm",
          "px-5 py-3.5": density === "comfortable" && size === "md",
          "px-7 py-4": density === "comfortable" && size === "lg",
        },
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
