export function StructuredData({ payload }: { payload: Record<string, unknown> }) {
  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
