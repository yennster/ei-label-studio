import { ImageResponse } from "next/og";

// iOS home-screen / Safari pinned icon. Logo on the app's dark tile.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 32 32" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
    <stop stop-color="#7281ff"/><stop offset="1" stop-color="#00bfc9"/></linearGradient></defs>
  <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="7" fill="none" stroke="url(#g)" stroke-width="1.7"/>
  <path d="M6 19c2-0 2.4-7 4-7s1.8 9 3.4 9 1.8-5 3.2-5" stroke="url(#g)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="22.5" cy="13" r="3.4" fill="url(#g)"/><circle cx="22.5" cy="13" r="1.2" fill="#0a0d14"/>
</svg>`;
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0d14",
        }}
      >
        <img src={LOGO} width={140} height={140} alt="" />
      </div>
    ),
    { ...size },
  );
}
