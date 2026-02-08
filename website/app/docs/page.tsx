import { redirect } from "next/navigation";
import { getDocs } from "../../lib/docs";

export default async function DocsPage() {
  const docs = await getDocs();

  // If docs exist, redirect to the first one (e.g., get-started)
  if (docs.length > 0) {
    // Find get-started or use first doc
    const getStarted = docs.find(d => d.meta.slug === "get-started");
    const firstDoc = getStarted || docs[0];
    redirect(`/docs/${firstDoc.meta.slug}`);
  }

  // Fallback - shouldn't reach here
  redirect("/");
}
