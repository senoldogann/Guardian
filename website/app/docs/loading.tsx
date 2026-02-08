import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for documentation pages
 * Provides visual feedback while content loads
 */
export default function DocsLoading() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header skeleton */}
      <div className="mb-8 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-full max-w-lg" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>

        <div className="space-y-4 pt-4">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
