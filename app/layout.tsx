import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import {
  AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_URL,
  SKILL_SUMMARIES,
} from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [AUTHOR],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  keywords: [
    "learn vim",
    "vim tutorial",
    "vim game",
    "vim practice",
    "vim commands",
    "vim motions",
    "vim cheat sheet",
    "interactive vim tutorial",
    "vim keyboard shortcuts",
    "hjkl",
  ],
  alternates: {
    canonical: "/",
    types: { "text/plain": "/llms.txt" },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: "#070b08",
  colorScheme: "dark",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${AUTHOR.url}/#person`,
      name: AUTHOR.name,
      url: AUTHOR.url,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${AUTHOR.url}/#person` },
    },
    {
      "@type": ["WebApplication", "LearningResource"],
      "@id": `${SITE_URL}/#app`,
      url: SITE_URL,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any desktop browser",
      browserRequirements: "Requires JavaScript and a physical keyboard",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      learningResourceType: "Interactive tutorial",
      educationalLevel: "Beginner to advanced",
      inLanguage: "en",
      teaches: SKILL_SUMMARIES.map((skill) => skill.name),
      isPartOf: { "@id": `${SITE_URL}/#website` },
      author: { "@id": `${AUTHOR.url}/#person` },
      creator: { "@id": `${AUTHOR.url}/#person` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
