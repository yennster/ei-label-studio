import { ImageResponse } from "next/og";

// Social share / link-preview card. Next renders this to a PNG and wires up the
// og:image + twitter:image meta automatically.

export const alt = "EI · Label Studio — your Edge Impulse data, labeled and ready";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The app logomark (gradient waveform → tag) as a runtime-agnostic data URI.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 32 32" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
    <stop stop-color="#7281ff"/><stop offset="1" stop-color="#00bfc9"/></linearGradient></defs>
  <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="7" fill="none" stroke="url(#g)" stroke-width="1.7"/>
  <path d="M6 19c2-0 2.4-7 4-7s1.8 9 3.4 9 1.8-5 3.2-5" stroke="url(#g)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="22.5" cy="13" r="3.4" fill="url(#g)"/><circle cx="22.5" cy="13" r="1.2" fill="#0a0d14"/>
</svg>`;
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0a0d14",
          backgroundImage:
            "radial-gradient(1100px 620px at 22% -12%, rgba(114,129,255,0.28), transparent 60%), radial-gradient(900px 600px at 108% -4%, rgba(0,191,201,0.18), transparent 55%)",
          color: "#eef2f9",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={LOGO} width={84} height={84} alt="" />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>
            <span>EI</span>
            <span style={{ color: "#9298a5", padding: "0 10px" }}>·</span>
            <span>Label Studio</span>
          </div>
        </div>

        {/* Headline + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            <div style={{ display: "flex" }}>Your Edge Impulse data,</div>
            <div
              style={{
                display: "flex",
                backgroundImage: "linear-gradient(90deg, #8b86ff, #00d0dc)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              labeled and ready.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              maxWidth: 880,
              fontSize: 30,
              lineHeight: 1.35,
              color: "#9298a5",
            }}
          >
            Pull samples from your project, relabel them in an embedded Label Studio canvas, and
            push every correction straight back to Edge Impulse.
          </div>
        </div>

        {/* Modality chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24 }}>
          {["Images", "Audio", "Time-series"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid #292e38",
                backgroundColor: "rgba(255,255,255,0.03)",
                color: "#c8cdd6",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
