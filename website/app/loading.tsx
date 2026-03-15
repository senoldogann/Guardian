import { Skeleton } from "@/components/ui/skeleton";

/**
 * Global loading state for the application
 * Shown when navigating between pages
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo placeholder */}
        <div className="flex justify-center">
          <Skeleton className="h-16 w-16 rounded-2xl" />
        </div>

        {/* Text placeholders */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
        </div>

        {/* Action buttons placeholder */}
        <div className="flex gap-4 justify-center">
          <Skeleton className="h-12 w-32 rounded-lg" />
          <Skeleton className="h-12 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
