import Firecrawl from "@mendable/firecrawl-js";
import * as fs from "fs";
import * as path from "path";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
  console.error("Error: FIRECRAWL_API_KEY environment variable is required");
  console.error("Get your API key at https://firecrawl.dev");
  process.exit(1);
}

interface PageMetadata {
  url: string;
  ogImage?: string;
  twitterImage?: string;
  title?: string;
  description?: string;
}

interface MapLink {
  url: string;
  title?: string;
  description?: string;
}

interface MapResult {
  links: MapLink[];
}

interface DocumentMetadata {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterImage?: string;
  twitterCard?: string;
  [key: string]: unknown;
}

interface ScrapeDocument {
  metadata?: DocumentMetadata;
  markdown?: string;
  html?: string;
}

async function extractSocialImages(
  baseUrl: string,
  options: {
    outputDir?: string;
    downloadImages?: boolean;
    limit?: number;
    search?: string;
    concurrency?: number;
  } = {}
): Promise<PageMetadata[]> {
  const {
    outputDir = "./output",
    downloadImages = true,
    limit = 100,
    search,
    concurrency = 5,
  } = options;

  const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });

  // Step 1: Map the site to get all URLs (fast)
  console.log(`\n🗺️  Mapping ${baseUrl}...`);

  const mapResult = (await firecrawl.map(baseUrl, {
    limit,
    ...(search && { search }),
  })) as MapResult;

  if (!mapResult.links?.length) {
    throw new Error("Map failed or returned no links");
  }

  const urls = mapResult.links.map((link) => link.url);
  console.log(`📄 Found ${urls.length} URLs\n`);

  // Step 2: Scrape each URL for metadata (parallel with concurrency limit)
  console.log(`🔍 Scraping metadata from ${urls.length} pages...`);

  const results: PageMetadata[] = [];

  // Process in batches for controlled concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const doc = (await firecrawl.scrape(url, {})) as ScrapeDocument;

          const meta = doc.metadata || {};
          const ogImage = meta.ogImage;
          const twitterImage = meta.twitterImage;

          if (ogImage || twitterImage) {
            return {
              url,
              ogImage,
              twitterImage,
              title: meta.title || meta.ogTitle,
              description: meta.description || meta.ogDescription,
            } as PageMetadata;
          }
          return null;
        } catch (err) {
          console.warn(`⚠️  Failed to scrape ${url}`);
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    console.log(`   Progress: ${Math.min(i + concurrency, urls.length)}/${urls.length}`);
  }

  console.log(`\n🖼️  Found ${results.length} pages with social images\n`);

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Step 3: Download images
  if (downloadImages && results.length > 0) {
    const imagesDir = path.join(outputDir, "images");
    await downloadAllImages(results, imagesDir);
  }

  // Step 4: Generate Markdown report
  const markdownPath = path.join(outputDir, "social-images.md");
  generateMarkdownReport(results, markdownPath, baseUrl);

  // Step 5: Generate HTML report
  const htmlPath = path.join(outputDir, "social-images.html");
  generateHtmlReport(results, htmlPath, baseUrl);

  // Save JSON data
  const jsonPath = path.join(outputDir, "social-images.json");
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  console.log(`\n📁 Output files:`);
  console.log(`   - ${markdownPath}`);
  console.log(`   - ${htmlPath}`);
  console.log(`   - ${jsonPath}`);

  return results;
}

function generateMarkdownReport(pages: PageMetadata[], outputPath: string, baseUrl: string): void {
  const lines: string[] = [];

  lines.push(`# Social Image Report`);
  lines.push(`\n**Site:** ${baseUrl}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Pages with images:** ${pages.length}`);
  lines.push(`\n---\n`);

  for (const page of pages) {
    lines.push(`## ${page.title || page.url}`);
    lines.push(`\n**URL:** ${page.url}`);

    if (page.description) {
      lines.push(`\n> ${page.description}`);
    }

    if (page.ogImage) {
      lines.push(`\n### OG Image`);
      lines.push(`![OG Image](${page.ogImage})`);
      lines.push(`\n\`${page.ogImage}\``);
    }

    if (page.twitterImage && page.twitterImage !== page.ogImage) {
      lines.push(`\n### Twitter Image`);
      lines.push(`![Twitter Image](${page.twitterImage})`);
      lines.push(`\n\`${page.twitterImage}\``);
    }

    lines.push(`\n---\n`);
  }

  fs.writeFileSync(outputPath, lines.join("\n"));
}

function generateHtmlReport(pages: PageMetadata[], outputPath: string, baseUrl: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Social Image Report - ${baseUrl}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
      color: #333;
    }
    h1 { color: #111; margin-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 2rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .card-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: #eee;
    }
    .card-content {
      padding: 1rem;
    }
    .card-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    .card-url {
      font-size: 0.75rem;
      color: #666;
      word-break: break-all;
      margin-bottom: 0.5rem;
    }
    .card-url a { color: #0066cc; text-decoration: none; }
    .card-url a:hover { text-decoration: underline; }
    .card-description {
      font-size: 0.85rem;
      color: #555;
      margin-bottom: 0.75rem;
    }
    .image-urls {
      font-size: 0.7rem;
      background: #f9f9f9;
      padding: 0.5rem;
      border-radius: 4px;
      word-break: break-all;
    }
    .image-urls code {
      display: block;
      margin: 0.25rem 0;
      color: #666;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      margin-right: 0.25rem;
    }
    .badge-og { background: #e3f2fd; color: #1565c0; }
    .badge-twitter { background: #e8f5e9; color: #2e7d32; }
  </style>
</head>
<body>
  <h1>Social Image Report</h1>
  <div class="meta">
    <strong>Site:</strong> ${baseUrl}<br>
    <strong>Generated:</strong> ${new Date().toISOString()}<br>
    <strong>Pages with images:</strong> ${pages.length}
  </div>

  <div class="grid">
    ${pages
      .map(
        (page) => `
      <div class="card">
        <img class="card-image" src="${page.ogImage || page.twitterImage}" alt="${page.title || "Social image"}" onerror="this.style.display='none'">
        <div class="card-content">
          <div class="card-title">${escapeHtml(page.title || "Untitled")}</div>
          <div class="card-url"><a href="${page.url}" target="_blank">${page.url}</a></div>
          ${page.description ? `<div class="card-description">${escapeHtml(page.description.slice(0, 150))}${page.description.length > 150 ? "..." : ""}</div>` : ""}
          <div>
            ${page.ogImage ? '<span class="badge badge-og">OG</span>' : ""}
            ${page.twitterImage ? '<span class="badge badge-twitter">Twitter</span>' : ""}
          </div>
          <div class="image-urls">
            ${page.ogImage ? `<code>OG: ${page.ogImage}</code>` : ""}
            ${page.twitterImage && page.twitterImage !== page.ogImage ? `<code>Twitter: ${page.twitterImage}</code>` : ""}
          </div>
        </div>
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function downloadAllImages(pages: PageMetadata[], outputDir: string): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📥 Downloading images to ${outputDir}...`);

  for (const page of pages) {
    const slug = slugify(page.url);

    if (page.ogImage) {
      await downloadImage(page.ogImage, path.join(outputDir, `${slug}_og`));
    }
    if (page.twitterImage && page.twitterImage !== page.ogImage) {
      await downloadImage(page.twitterImage, path.join(outputDir, `${slug}_twitter`));
    }
  }
}

function slugify(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.replace(/\//g, "_").replace(/^_/, "").replace(/_$/, "") || "home";
  } catch {
    return "unknown";
  }
}

async function downloadImage(url: string, outputPathBase: string): Promise<void> {
  try {
    const fullUrl = url.startsWith("http") ? url : `https:${url}`;
    const response = await fetch(fullUrl);

    if (!response.ok) {
      console.warn(`⚠️  Failed to download ${url}: ${response.status}`);
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";

    let ext = ".jpg";
    if (contentType.includes("png")) ext = ".png";
    else if (contentType.includes("webp")) ext = ".webp";
    else if (contentType.includes("gif")) ext = ".gif";
    else if (contentType.includes("svg")) ext = ".svg";

    fs.writeFileSync(`${outputPathBase}${ext}`, buffer);
    console.log(`   ✅ ${path.basename(outputPathBase)}${ext}`);
  } catch (err) {
    console.warn(`   ⚠️  Error downloading ${url}`);
  }
}

// CLI
const targetUrl = process.argv[2] || "https://www.anthropic.com";
const searchTerm = process.argv[3];

console.log(`
╔════════════════════════════════════════╗
║      Social Image Scraper              ║
║      Using Firecrawl Map + Scrape      ║
╚════════════════════════════════════════╝
`);

extractSocialImages(targetUrl, {
  outputDir: "./output",
  downloadImages: true,
  limit: 50,
  search: searchTerm,
  concurrency: 5,
})
  .then((results) => {
    console.log(`\n📊 Summary:`);
    console.table(
      results.slice(0, 20).map((r) => ({
        page: r.url.replace(targetUrl, "") || "/",
        title: (r.title || "").slice(0, 30),
        og: r.ogImage ? "✓" : "",
        twitter: r.twitterImage ? "✓" : "",
      }))
    );
    console.log(`\n✨ Done! Open output/social-images.html to view results.`);
  })
  .catch(console.error);
