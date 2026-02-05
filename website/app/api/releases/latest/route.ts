import { NextResponse } from "next/server";
import { getLatestRelease, pickInstallers } from "../../../../lib/github";

export async function GET() {
  try {
    const latest = await getLatestRelease();
    return NextResponse.json(
      {
        tag: latest.tag_name,
        publishedAt: latest.published_at,
        notes: latest.body,
        htmlUrl: latest.html_url,
        assets: pickInstallers(latest.assets)
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
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
