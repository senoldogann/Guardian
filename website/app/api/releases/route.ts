import { NextResponse } from "next/server";
import { getReleases } from "../../../lib/github";

export async function GET() {
  try {
    const releases = await getReleases(30);
    return NextResponse.json(
      releases.map((release) => ({
        tag: release.tag_name,
        name: release.name,
        body: release.body,
        htmlUrl: release.html_url,
        publishedAt: release.published_at,
        prerelease: release.prerelease
      })),
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch releases"
      },
      { status: 500 }
    );
  }
}
