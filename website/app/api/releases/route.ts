import { NextResponse } from "next/server";
import { fetchReleaseSnapshot } from "../../../lib/releases-source";
import { toReleaseViewModel } from "../../../lib/changelog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const releases = await fetchReleaseSnapshot(30);
    return NextResponse.json(
      releases.map((release) => ({
        ...toReleaseViewModel(release),
        assets: release.assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          size: asset.size,
          url: asset.browser_download_url
        }))
      })),
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
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
