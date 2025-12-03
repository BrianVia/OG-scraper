# OG Scraper - Cloudflare Worker API

A serverless API to extract Open Graph and Twitter Card image URLs from any website.

## Setup

```bash
cd worker
npm install
```

## Add Your API Key

```bash
# Set the Firecrawl API key as a secret
npx wrangler secret put FIRECRAWL_API_KEY
# Paste your key when prompted
```

## Development

```bash
npm run dev
```

This starts a local dev server at `http://localhost:8787`

## Deploy

```bash
npm run deploy
```

## API Usage

### `GET /`

Returns API info and usage instructions.

### `GET /scrape`

Scrapes a website for OG and Twitter Card images.

**Parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | Yes | - | Website URL to scrape |
| `limit` | No | 50 | Max URLs to discover (1-100) |
| `search` | No | - | Filter URLs by search term |

**Example Request:**

```bash
curl "https://your-worker.workers.dev/scrape?url=https://example.com&limit=30"
```

**Example Response:**

```json
{
  "url": "https://example.com",
  "scrapedAt": "2024-12-03T19:00:00.000Z",
  "pagesScanned": 30,
  "pagesWithImages": 12,
  "pages": [
    {
      "url": "https://example.com/page1",
      "title": "Page Title",
      "description": "Page description...",
      "ogImage": "https://example.com/og-image.jpg",
      "twitterImage": "https://example.com/twitter-image.jpg"
    }
  ]
}
```

## Limits

- **Free tier**: 50 subrequests per invocation, 10ms CPU time
- **Paid tier**: 1000 subrequests, 30s CPU time
- **Firecrawl**: Has its own rate limits based on your plan

For large sites, consider:
- Using the `limit` param to reduce URLs scanned
- Using the `search` param to filter to specific sections
- Upgrading to Workers Paid for higher limits

## Local Testing with Secrets

For local dev, create a `.dev.vars` file:

```
FIRECRAWL_API_KEY=fc-your-key-here
```

This file is automatically gitignored.
