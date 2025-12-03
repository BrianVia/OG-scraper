# OG Scraper

Extract Open Graph and Twitter Card images from any website. Uses [Firecrawl](https://firecrawl.dev) to efficiently map and scrape sites.

## Features

- Maps entire websites to discover all URLs
- Extracts OG images (`og:image`) and Twitter images (`twitter:image`)
- Downloads images locally
- Generates reports in multiple formats:
  - **Markdown** - Easy to read, great for documentation
  - **HTML** - Visual gallery with image previews
  - **JSON** - Raw data for further processing

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/OG-scraper.git
cd OG-scraper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your Firecrawl API key
```

## Get a Firecrawl API Key

1. Go to [firecrawl.dev](https://firecrawl.dev)
2. Sign up for an account
3. Get your API key from the dashboard
4. Add it to your `.env` file

## Usage

```bash
# Basic usage - scrape a website
FIRECRAWL_API_KEY=your_key npx tsx scrape-social-images.ts https://example.com

# Or if you have .env set up
npx tsx scrape-social-images.ts https://example.com

# Filter URLs by search term (only scrape pages matching "blog")
npx tsx scrape-social-images.ts https://example.com blog
```

## Output

Results are saved to the `output/` directory:

```
output/
├── social-images.md     # Markdown report
├── social-images.html   # Visual HTML gallery (open in browser)
├── social-images.json   # Raw JSON data
└── images/              # Downloaded images
    ├── page-slug_og.jpg
    └── page-slug_twitter.jpg
```

### Example Output

**Markdown Report:**
```markdown
# Social Image Report

**Site:** https://example.com
**Pages with images:** 15

---

## Page Title

**URL:** https://example.com/page

### OG Image
![OG Image](https://example.com/og-image.jpg)
```

**HTML Gallery:**

Open `output/social-images.html` in your browser for a visual grid of all discovered social images.

## Configuration

You can modify these options in the script:

| Option | Default | Description |
|--------|---------|-------------|
| `outputDir` | `./output` | Where to save results |
| `downloadImages` | `true` | Download images locally |
| `limit` | `50` | Max URLs to map |
| `concurrency` | `5` | Parallel scrape requests |

## How It Works

1. **Map** - Uses Firecrawl's `/map` endpoint to quickly discover all URLs on the site
2. **Scrape** - Fetches metadata from each page in parallel batches
3. **Extract** - Pulls `og:image` and `twitter:image` from metadata
4. **Download** - Saves images locally with slugified filenames
5. **Report** - Generates Markdown, HTML, and JSON reports

## Limitations

- External subdomains may fail to scrape (e.g., `docs.example.com` when scraping `example.com`)
- PDFs and other non-HTML resources are skipped
- Rate limiting may cause some pages to fail on large sites
- Pages without OG/Twitter images configured won't appear in results

## License

MIT
