import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#bda6ee", color: "#2e2441", fontSize: 350, fontWeight: 700, fontFamily: "sans-serif", paddingRight: 40, paddingBottom: 30 }}>m<span style={{ position: "absolute", top: 50, right: 55, fontSize: 125 }}>+</span></div>, { ...size });
}
