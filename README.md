# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Implemented features

- Product cards with mouse, touch, and keyboard selection controls
- Synchronized category and live keyword search
- Saved selections using stable product IDs in `localStorage`
- Expandable, accessible full product descriptions
- Product-aware routine and follow-up chat
- Loading, error, empty-selection, and unexpected-response states
- Optional live web search with verified HTTP/HTTPS citations
- Persistent RTL/LTR layout toggle
- Responsive desktop, tablet, and mobile layout

## Run locally

Start a local static server in this repository:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Cloudflare Worker setup

The frontend is currently configured to call the deployed Cloudflare Worker
in `script.js`. The Worker implementation and deployment configuration are in
`worker/`. If you deploy a different Worker, update `WORKER_URL` in `script.js`.
Never add an OpenAI key to `script.js`, `index.html`, or any committed frontend
file. From `worker/`, store it as a Cloudflare Worker secret with
`wrangler secret put OPENAI_API_KEY`.

The Worker must accept `POST` JSON in this format:

```json
{
  "messages": [
    { "role": "user", "content": "Create a personalized routine." }
  ],
  "selected_products": [],
  "web_search": false
}
```

`messages` must contain only user and assistant conversation entries.
The `selected_products` array provides the currently selected product context.
The Worker converts that context into its private system instruction. The Worker
should return either:

- `choices[0].message.content`, or
- `response`, `output`, or `output_text`

It may also return `citations`, `sources`, or `annotations` for live-search
links. The frontend accepts only actual HTTP/HTTPS citation URLs.

## Worker security and configuration

Configure these values only as Cloudflare environment variables or secrets:

- `OPENAI_API_KEY`: the OpenAI API key, stored with `wrangler secret put`
- `ALLOWED_ORIGINS`: exact deployed frontend origin and local origin(s)
- `OPENAI_MODEL`: normally `gpt-4.1`
- A web-search-capable model or endpoint if live search is enabled

The Worker should:

- Reject methods other than `POST`
- Validate JSON size and the `messages` array
- Validate product fields and prevent frontend instructions from changing system policy
- Add CORS headers for the actual deployed origin and local development origin
- Use the `OPENAI_API_KEY` secret only on the server
- Apply a request-size limit and reasonable abuse/rate protection
- Never log API keys or unnecessary sensitive request content
- Use the supported OpenAI web-search endpoint/tool for `web_search: true`
- Return only source URLs supplied by the web-search response

No OpenAI API credentials are stored in the repository. The frontend must be
published separately from the Worker.

## GitHub Pages

The app uses relative paths for its stylesheet, script, product catalog, and
logo, so it can be served from the repository's GitHub Pages path. At the time
of the latest check, GitHub Pages was not enabled for this repository and the
expected URL returned 404. Before submission, enable Pages in the repository's
Settings by selecting the `main` branch and root (`/`) as the publishing source,
then verify `https://rich5369.github.io/09-prj-loreal-routine-builder/`.

## Testing

There is no package-based test runner in this repository. For manual verification:

1. Serve the app and open it in a browser.
2. Select, deselect, remove, clear, and reload selections.
3. Combine category and partial-name searches.
4. Open several product descriptions.
5. Configure the Worker and generate a one-product routine.
6. Generate a multi-product routine and three sequential follow-up questions.
7. Enable live web search and verify visible source links from a fresh search.
8. Toggle RTL and check 375px, 768px, and 1440px layouts.
9. Check the browser console and network panel for errors.

Run the Worker integration tests with:

```bash
node --test worker/test/*.test.js
```