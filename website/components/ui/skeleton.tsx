import { cn } from "@/lib/utils";

/**
 * Skeleton component for loading states
 * Provides a placeholder while content loads
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800", className)}
      {...props}
    />
  );
}

export { Skeleton };
