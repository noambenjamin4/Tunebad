import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tuner — Music Utility";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: -4,
            color: "#000000",
            lineHeight: 1,
          }}
        >
          TUNER
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: 2,
            color: "#6b6b6b",
            textTransform: "uppercase",
          }}
        >
          BPM &middot; Key &middot; Loudness &middot; Delay
        </div>
      </div>
    ),
    { ...size },
  );
}
