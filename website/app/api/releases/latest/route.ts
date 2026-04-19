import { NextResponse } from "next/server";
import { pickInstallers, releaseTagToVersion } from "../../../../lib/github";
import { fetchReleaseSnapshot } from "../../../../lib/releases-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const releases = await fetchReleaseSnapshot(1);
    const latest = releases[0];
    if (!latest) {
      return NextResponse.json(
        { error: "Release data temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        tag: latest.tag_name,
        version: releaseTagToVersion(latest.tag_name),
        publishedAt: latest.published_at,
        notes: latest.body,
        htmlUrl: latest.html_url,
        assets: pickInstallers(latest.assets)
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch latest release"
      },
      { status: 500 }
    );
  }
}
