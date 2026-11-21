# Project 9 Cloudflare Worker

This is a separate implementation for this repository. It does not modify or
replace any existing Project 8 Worker.

## Deploy

From this directory:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Configure the deployed frontend origin:

```bash
wrangler.toml or dashboard variable:
ALLOWED_ORIGINS=https://your-github-pages-site.example
```

Optional variables:

- `OPENAI_MODEL` (default: `gpt-4.1`)
- `RATE_LIMIT_PER_MINUTE` (default: `30`)
- `ALLOWED_ORIGINS` (comma-separated exact origins)

Local origins `http://localhost:8000` and `http://127.0.0.1:8000` are allowed
for development.

## Contract

Request:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "selected_products": [
    {
      "id": 1,
      "brand": "CeraVe",
      "name": "Product",
      "category": "cleanser",
      "description": "..."
    }
  ],
  "web_search": false
}
```

Response:

```json
{
  "choices": [{ "message": { "content": "..." } }],
  "citations": [],
  "sources": []
}
```
