# ARIA: Alert Response Intelligence Assistant

A free, open-source, browser-based tool that helps national authorities generate sector-specific, impact-driven alert language for the Common Alerting Protocol (CAP).

Built by [Last Larch](https://lastlarch.com).

No install. No server. No account. Your data stays on your machine unless you choose to call an AI model.

---

## What it does

1. **Load your GIS data** from local files, ArcGIS REST services, WFS endpoints, or shapefiles
2. **Draw or paste a polygon** representing a hazard footprint
3. **Query every source** to see what is inside: schools, health facilities, roads, and population centres
4. **Load ARIA-Lex** (the included seed library) to ground output in pre-validated early action messages
5. **Generate sector-specific CAP `<headline>` and `<description>` blocks**, each tagged by source: Library, Contextualised, or Synthesised

## Quick start

1. Download one of the two versions:
   - [`ARIA.html`](./ARIA.html): the standard version, about 0.3 MB. It needs an internet connection when it opens.
   - [`ARIA-offline.html`](./ARIA-offline.html): the offline version, about 2 MB. It opens without a connection.
2. Open it in any modern browser
3. Start using it. A sample dataset is preloaded so you can try it immediately

Full walkthrough: [`manual.html`](./manual.html)

## Files in this repo

| File | What it is |
|------|-----------|
| `ARIA.html` | The tool itself, a single HTML file. Loads its libraries from public CDNs |
| `ARIA-offline.html` | The same tool with all libraries and fonts built in, so it opens with no internet connection |
| `ARIA-Lex.db` | Seed early action message library (SQLite). 1,513 active messages for 7 hazards across 7 sectors |
| `aria-worker.js` | Cloudflare Worker source. Relays AI API calls so ARIA works in any browser, including when opened as a local file |
| `manual.html` | Full operations manual covering every step and option |
| `tools/build-offline.mjs` | Script that builds `ARIA-offline.html` from `ARIA.html` |
| `LICENSE` | MIT |

## Which version should I use?

The two versions behave the same once they are open. The difference is how they start.

- **Standard (`ARIA.html`)**: small. It fetches Leaflet, Leaflet.draw, Turf, shpjs, sql.js and its fonts from public CDNs each time it opens, so it needs an internet connection to start.
- **Offline (`ARIA-offline.html`)**: about six times larger, because those libraries and fonts are inside the file. It opens with no connection.

Three things need internet in both versions: the map background (Esri World Street Map), online data sources such as ArcGIS, WFS and URLs, and AI providers. Without a connection the map background stays grey and ARIA shows a short notice. Drawing, local files, ARIA-Lex and Library only mode all still work.

`ARIA-offline.html` is generated. To rebuild it after changing `ARIA.html`, run `node tools/build-offline.mjs` (Node 18 or later, and access to the npm registry). The script downloads pinned copies of the libraries, embeds them, and stops with an error if anything unexpected is found. The licence texts of the embedded libraries are inside the file.

## Why a relay worker?

Browsers block direct API calls from local (`file://`) pages for security reasons. ARIA routes AI calls through a small, open-source Cloudflare Worker that only forwards the request. It never stores or logs API keys or content. The worker forwards only to a short list of AI providers and refuses every other address. You can deploy your own in a few minutes. See `aria-worker.js` for the full source and inline documentation.

## The library: ARIA-Lex

`ARIA-Lex.db` is a standard SQLite database of early action messages, organised by hazard, sector, severity, and authority level. The seed library covers cyclone, flood, heatwave, wildfire, tsunami, cold wave, and disease outbreak across seven sectors. Earthquake messages are not yet included, and food systems and agriculture messages are present but switched off until they are reviewed. Load it in ARIA's settings panel (top right) and the AI uses these messages as its foundation instead of generating from scratch. Every output is tagged, so its origin is always clear:

- **Library**: used as-is, with only place names and counts added
- **Contextualised**: adapted with specific local data from your GIS layers
- **Synthesised**: no library match, generated from GIS data alone

You can also use the library with no AI at all. Tick "Library only" in Step 2. Nothing is sent anywhere in this mode. Use `ARIA-offline.html` to do it without an internet connection.

## Bring your own AI model

Presets for Claude, GPT-4o, and Gemini are built in. A Custom option accepts the endpoint and model name of any OpenAI-compatible API hosted by OpenRouter or one of the other providers the relay worker allows. Models on your own computer or network, such as Ollama, cannot be reached, because requests go through the relay. Your API key is stored only in your browser. It is sent only to the AI provider you choose, through the relay.

## Contributing

Issues and pull requests are welcome. This project is at an early stage. The seed library messages are marked `provisional` and should be reviewed by domain experts before operational deployment.

## License

MIT. See [LICENSE](./LICENSE). Free to use, modify, and deploy, including commercially. The license requires that the copyright and license notice stay with any copy.

## Contact

Built by [Last Larch](https://lastlarch.com) · fysh@lastlarch.com
