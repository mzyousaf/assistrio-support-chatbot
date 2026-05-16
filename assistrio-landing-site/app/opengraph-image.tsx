import { ImageResponse } from "next/og";

export const alt = "Assistrio — AI Support Agents for your website";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default 1200×630 Open Graph image (generated — no binary asset to maintain).
 * Brand colors align with `app/globals.css` tokens.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #f6f8fb 0%, #eef2f7 45%, #ccfbf1 120%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 920,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: -1.5,
              color: "#0f172a",
              lineHeight: 1.1,
            }}
          >
            Assistrio
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 500,
              color: "#115e59",
              lineHeight: 1.25,
            }}
          >
            Hosted AI Support Agents
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: "#52606f",
              lineHeight: 1.45,
              marginTop: 8,
            }}
          >
            Knowledge base, lead capture, branding, and analytics — on websites you allow.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
