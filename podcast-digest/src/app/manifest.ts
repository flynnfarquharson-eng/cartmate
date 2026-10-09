import type { MetadataRoute } from "next";

/** Makes the site installable: "Add to Home Screen" gives an app icon that opens full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Podcast Digest",
    short_name: "Digest",
    description: "Summaries and the best tips from the podcasts you love.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#6d28d9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The artwork sits inside the safe zone, so it also works when Android crops icons to a shape.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
