# ARIA — Alert Response Intelligence Assistant

A free, open-source, browser-based tool that helps national authorities generate sector-specific, impact-driven alert language for the Common Alerting Protocol (CAP).

Built by [Last Larch](https://lastlarch.com).

No install. No server. No account. Your data never leaves your machine unless you choose to call an AI model.

---

## What it does

1. **Load your GIS data** — local files, ArcGIS REST services, WFS endpoints, or shapefiles
2. **Draw or paste a polygon** representing a hazard footprint
3. **Query every source** to see what's inside — schools, health facilities, roads, population centres
4. **Load ARIA-Lex** (the included seed library) to ground output in pre-validated early action messages
5. **Generate sector-specific CAP `<headline>` and `<description>` blocks**, each tagged by source: Library, Contextualised, or Synthesised

## Quick start

1. Download [`ARIA.html`](./ARIA.html)
2. Open it in any modern browser
3. That's it — a sample dataset is preloaded so you can try it immediately

Full walkthrough: [`manual.html`](./manual.html)

## Files in this repo

| File | What it is |
|------|-----------|
| `ARIA.html` | The tool itself — a single self-contained HTML file |
| `ARIA-Lex.db` | Seed early action message library (SQLite) — 8 hazard types × 8 sectors |
| `aria-worker.js` | Cloudflare Worker source — relays AI API calls so ARIA works from any browser, including opened as a local file |
| `manual.html` | Full operations manual — every step, every option, explained |
| `METHODOLOGY.md` | Architecture decisions, data model, and design rationale |
| `LICENSE` | MIT |

## Why a relay worker?

Browsers block direct API calls from local (`file://`) pages for security reasons. ARIA routes AI calls through a small, open-source Cloudflare Worker that does nothing but forward the request — it never stores or logs API keys or content. Deploy your own in a few minutes; see `aria-worker.js` for the full source and inline docs.

## The library — ARIA-Lex

`ARIA-Lex.db` is a standard SQLite database of pre-validated early action messages, organised by hazard, sector, severity, and authority level. Load it in ARIA's settings panel (top-right) and the AI will use these messages as its foundation rather than generating from scratch. Every output is tagged so you always know its provenance:

- **Library** — used as-is, only place names/counts slotted in
- **Contextualised** — adapted with specific local data from your GIS layers
- **Synthesised** — no library match, generated from GIS data alone

You can also run ARIA entirely offline with the library, no AI required — tick "Library only" in Step 2.

## Bring your own AI model

ARIA works with any OpenAI-compatible API. Presets for Claude, GPT-4o, and Gemini are built in; a Custom option lets you point at a self-hosted model (Ollama, etc). Your API key is stored only in your browser — never sent to Last Larch or anyone else.

## Contributing

Issues and pull requests welcome. This is early-stage — the seed library messages are marked `provisional` and would benefit from domain-expert review before operational deployment.

## License

MIT — see [LICENSE](./LICENSE). Free to use, modify, and deploy, including commercially. Attribution appreciated but not required by the license terms.

## Contact

Built by [Last Larch](https://lastlarch.com) · fysh@lastlarch.com
