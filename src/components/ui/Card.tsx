import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "primary" | "secondary" | "tonal";
  density?: "comfortable" | "compact";
};

export function Card({
  className,
  children,
  variant = "secondary",
  density = "comfortable",
  ...props
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden",
        variant === "primary" && "bg-s3",
        variant === "secondary" && "bg-s2",
        variant === "tonal" && "bg-m3-primary-container/30",
        density === "compact" && "rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
