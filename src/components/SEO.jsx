import { useEffect } from "react";

/**
 * Reusable SEO Component for SPARKZ.TV
 * Dynamically injects and manages meta tags in the document head on client-side navigation.
 * 
 * @param {Object} props
 * @param {string} [props.title] - Page title (appended with SPARKZ.TV)
 * @param {string} [props.description] - Meta description for search engines and social cards
 * @param {string} [props.image] - Custom Open Graph and Twitter image url (supports absolute and relative paths)
 * @param {string} [props.url] - Canonical URL of the current page
 * @param {string} [props.type] - OG Type (e.g. "website", "profile", "video")
 * @param {boolean} [props.isLive] - Prepend [LIVE] to title and add live context to metadata
 * @param {string} [props.category] - Stream genre/category for search enrichment
 */
export default function SEO({
  title,
  description,
  image,
  url,
  type = "website",
  isLive = false,
  category,
  keywords,
}) {
  const defaultTitle = "SPARKZ.TV - Live Drum and Bass, Jungle & Underground Radio";
  const defaultDesc = "Discover the finest live drum and bass, old skool jungle, UK garage, and underground DJ sets on SPARKZ.TV. Watch high-fidelity 320kbps radio streams.";
  const defaultKeywords = "sparkztv, sparkz, sparkz.tv, underground electronic music, live DJ stream, drum and bass live, jungle music stream, dnb radio, pirate radio London, dubplate culture, UK garage live, dubstep livestream, sound system culture, selector, bass weight, independent music platform";
  const defaultImage = "/og-image.jpg";

  // Use primitive dependencies to avoid infinite re-renders
  useEffect(() => {
    // 1. Title handling
    let finalTitle = defaultTitle;
    if (title) {
      const livePrefix = isLive ? "🔴 [LIVE] " : "";
      const categorySuffix = category ? ` (${category})` : "";
      finalTitle = `${livePrefix}${title}${categorySuffix} // SPARKZ.TV`;
    }
    document.title = finalTitle;

    // Helper to get or create a meta tag
    const updateOrCreateMeta = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // 2. Description handling
    const finalDesc = description || defaultDesc;
    updateOrCreateMeta("name", "description", finalDesc);
    updateOrCreateMeta("property", "og:description", finalDesc);
    updateOrCreateMeta("name", "twitter:description", finalDesc);

    // 3. Keywords handling
    const finalKeywords = keywords || defaultKeywords;
    updateOrCreateMeta("name", "keywords", finalKeywords);

    // 4. Social & dynamic titles
    updateOrCreateMeta("property", "og:title", finalTitle);
    updateOrCreateMeta("name", "twitter:title", finalTitle);

    // 4. URL / Canonical handling
    const currentUrl = url || window.location.href;
    updateOrCreateMeta("property", "og:url", currentUrl);
    updateOrCreateMeta("name", "twitter:url", currentUrl);

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", currentUrl);

    // 5. OG Type
    updateOrCreateMeta("property", "og:type", type);

    // 6. Image handling
    let finalImage = image || defaultImage;
    // Resolve relative image paths to absolute URLs using current origin
    if (finalImage && !finalImage.startsWith("http")) {
      const origin = window.location.origin || "https://sparkztv.live";
      finalImage = `${origin}${finalImage.startsWith("/") ? "" : "/"}${finalImage}`;
    }
    
    // Strip query parameters to prevent cache/crawler issues
    const cleanImage = finalImage ? finalImage.split("?")[0].split("#")[0] : "";
    updateOrCreateMeta("property", "og:image", cleanImage);
    updateOrCreateMeta("name", "twitter:image", cleanImage);

    // Add explicit Open Graph image dimensions for better social preview rendering
    updateOrCreateMeta("property", "og:image:width", "1200");
    updateOrCreateMeta("property", "og:image:height", "630");

    // 7. Structured Schema Markup Injection (Organization, Person, WebSite & LocalBusiness)
    let schemaScript = document.getElementById("sparkz-seo-schema");
    if (!schemaScript) {
      schemaScript = document.createElement("script");
      schemaScript.id = "sparkz-seo-schema";
      schemaScript.setAttribute("type", "application/ld+json");
      document.head.appendChild(schemaScript);
    }

    const orgSchema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "EntertainmentBusiness",
          "@id": "https://sparkztv.live/#organization",
          "name": "SPARKZ.TV",
          "url": "https://sparkztv.live",
          "logo": {
            "@type": "ImageObject",
            "url": "https://sparkztv.live/logo.svg",
            "width": "112",
            "height": "112"
          },
          "image": "https://sparkztv.live/og-image.jpg",
          "description": "High-fidelity live audio and video streaming for underground electronic music, DJs, and live radio broadcasts.",
          "telephone": "+44 20 7946 0192",
          "priceRange": "$$",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "100 Shoreditch High St",
            "addressLocality": "London",
            "postalCode": "E1 6JQ",
            "addressCountry": "GB"
          },
          "sameAs": [
            "https://www.facebook.com/sparkztv.live",
            "https://x.com/sparkztv_live",
            "https://www.instagram.com/sparkztv.live",
            "https://www.youtube.com/@sparkztv",
            "https://www.linkedin.com/company/sparkztv"
          ]
        },
        {
          "@type": "WebSite",
          "@id": "https://sparkztv.live/#website",
          "url": "https://sparkztv.live",
          "name": "SPARKZ.TV",
          "publisher": {
            "@id": "https://sparkztv.live/#organization"
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://sparkztv.live/directory?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }
      ]
    };

    schemaScript.textContent = JSON.stringify(orgSchema);

    return () => {
      const el = document.getElementById("sparkz-seo-schema");
      if (el) el.remove();
    };

  }, [title, description, image, url, type, isLive, category, keywords]);

  return null; // Component does not render any visual UI elements itself
}
