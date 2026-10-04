import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Medix",
    short_name: "Medix",
    description: "Gestão inteligente para clínicas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8fa",
    theme_color: "#7155e8",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
