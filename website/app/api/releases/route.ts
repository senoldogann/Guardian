import { NextResponse } from "next/server";
import { getReleases } from "../../../lib/github";
import { toReleaseViewModel } from "../../../lib/changelog";

export async function GET() {
  try {
    const releases = await getReleases(30);
    return NextResponse.json(
      releases.map((release) => ({
        ...toReleaseViewModel(release),
        assets: release.assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          size: asset.size,
          digest: asset.digest,
          url: asset.browser_download_url
        }))
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
