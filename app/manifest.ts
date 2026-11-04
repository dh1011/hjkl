import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: "hjkl",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#070b08",
    theme_color: "#070b08",
    categories: ["education", "games", "productivity"],
    icons: [
      { src: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
