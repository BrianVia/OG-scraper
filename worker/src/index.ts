import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  FIRECRAWL_API_KEY: string;
};

interface MapResponse {
  success: boolean;
  links?: string[];
  error?: string;
}

interface ScrapeResponse {
  success: boolean;
  data?: {
    metadata?: {
      title?: string;
      description?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogImage?: string;
      twitterImage?: string;
      twitterCard?: string;
    };
  };
  error?: string;
}

interface PageResult {
  url: string;
  title?: string;
  description?: string;
  ogImage?: string;
  twitterImage?: string;
}

interface ScrapeResult {
  url: string;
  scrapedAt: string;
  pagesScanned: number;
  pagesWithImages: number;
  pages: PageResult[];
}

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes
app.use("*", cors());

// Health check / usage info
app.get("/", (c) => {
  return c.json({
    name: "OG Scraper API",
    version: "1.0.0",
    usage: {
      endpoint: "GET /scrape",
      params: {
        url: "(required) The website URL to scrape",
        limit: "(optional) Max URLs to map, default 50, max 100",
        search: "(optional) Filter URLs by search term",
      },
      example: "/scrape?url=https://example.com&limit=30",
    },
  });
});

// Main scrape endpoint
app.get("/scrape", async (c) => {
  const url = c.req.query("url");
  const limitParam = c.req.query("limit");
  const search = c.req.query("search");

  if (!url) {
    return c.json({ error: "Missing required 'url' parameter" }, 400);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  const apiKey = c.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Server misconfigured: missing API key" }, 500);
  }

  // Parse and clamp limit (max 100 to stay within subrequest limits)
  let limit = parseInt(limitParam || "50", 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;

  try {
    // Step 1: Map the site to get URLs
    const mapResult = await mapSite(apiKey, url, limit, search);

    if (!mapResult.success || !mapResult.links?.length) {
      return c.json({
        error: "Failed to map site or no URLs found",
        details: mapResult.error,
      }, 400);
    }

    const urls = mapResult.links;

    // Step 2: Scrape metadata from each URL (parallel with concurrency)
    const pages = await scrapePages(apiKey, urls);

    // Filter to only pages with images
    const pagesWithImages = pages.filter((p) => p.ogImage || p.twitterImage);

    const result: ScrapeResult = {
      url,
      scrapedAt: new Date().toISOString(),
      pagesScanned: urls.length,
      pagesWithImages: pagesWithImages.length,
      pages: pagesWithImages,
    };

    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Scrape failed", details: message }, 500);
  }
});

async function mapSite(
  apiKey: string,
  url: string,
  limit: number,
  search?: string
): Promise<MapResponse> {
  const response = await fetch(`${FIRECRAWL_API_BASE}/map`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      limit,
      ...(search && { search }),
    }),
  });

  return response.json() as Promise<MapResponse>;
}

async function scrapePages(
  apiKey: string,
  urls: string[],
  concurrency = 10
): Promise<PageResult[]> {
  const results: PageResult[] = [];

  // Process in batches for controlled concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((url) => scrapePage(apiKey, url))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

async function scrapePage(
  apiKey: string,
  url: string
): Promise<PageResult | null> {
  try {
    const response = await fetch(`${FIRECRAWL_API_BASE}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"], // metadata is included by default
      }),
    });

    const data = (await response.json()) as ScrapeResponse;

    if (!data.success || !data.data?.metadata) {
      return null;
    }

    const meta = data.data.metadata;
    const ogImage = meta.ogImage;
    const twitterImage = meta.twitterImage;

    // Only return if there's at least one image
    if (!ogImage && !twitterImage) {
      return null;
    }

    return {
      url,
      title: meta.title || meta.ogTitle,
      description: meta.description || meta.ogDescription,
      ogImage,
      twitterImage,
    };
  } catch {
    return null;
  }
}

export default app;
