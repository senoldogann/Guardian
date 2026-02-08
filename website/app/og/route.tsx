import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get dynamic params
    const title = searchParams.get("title") || "Guardian";
    const description = searchParams.get("description") || "Release-Driven Governance Platform";
    
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
            padding: "60px",
          }}
        >
          {/* Background gradient overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, #000000 0%, #111111 50%, #000000 100%)",
            }}
          />
          
          {/* Content container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              textAlign: "center",
            }}
          >
            {/* Logo/Shield Icon */}
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "24px",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "40px",
                boxShadow: "0 0 60px rgba(255,255,255,0.2)",
              }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: "72px",
                fontWeight: "bold",
                color: "#ffffff",
                margin: "0 0 20px 0",
                lineHeight: 1.1,
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: "32px",
                color: "#a1a1aa",
                margin: "0",
                lineHeight: 1.4,
                fontFamily: "Inter, system-ui, sans-serif",
                maxWidth: "800px",
              }}
            >
              {description}
            </p>

            {/* Bottom accent line */}
            <div
              style={{
                width: "100px",
                height: "4px",
                backgroundColor: "#ffffff",
                marginTop: "50px",
                borderRadius: "2px",
              }}
            />
          </div>

          {/* Corner decorations */}
          <div
            style={{
              position: "absolute",
              top: "40px",
              right: "40px",
              fontSize: "20px",
              color: "#52525b",
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: "500",
            }}
          >
            guardian-app.vercel.app
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
