# ARIA — Project Summary & Decisions Log
*Last Larch · fysh@lastlarch.com · lastlarch.com*
*Prepared for continuity across Claude sessions*

---

## What ARIA Is

ARIA (Alert Response Intelligence Assistant) is a free, open-source, browser-based tool built by Last Larch to help national authorities generate sector-specific, impact-driven alert language for the Common Alerting Protocol (CAP). It is a single HTML file — no server, no install, no account required.

**The core workflow:**
1. Load GIS data sources (local files, ArcGIS, WFS, GeoJSON URLs)
2. Draw or paste a polygon representing a hazard footprint
3. Query all sources — see what infrastructure/population is inside
4. Load a pre-validated early action message library (ARIA-Lex.db)
5. Configure hazard, severity, authority level, and AI model
6. Generate sector-specific CAP `<headline>` and `<description>` blocks, tagged by provenance

**Primary audience:** National meteorological services, disaster management authorities, UN agencies, EWS implementers, DRR/WMO community.

**Commercial model:** Free and open source. Last Larch available for consultancy, custom implementations, and country deployments.

---

## File Inventory

| File | Purpose |
|------|---------|
| `index.html` (ARIA v1.1.html) | The tool itself — the entire application |
| `product-page.html` | Last Larch website product page |
| `manual.html` | 16-chapter operations manual |
| `ARIA-Lex.db` | Seed early action library (SQLite, ~924KB) |
| `hero.html` | LinkedIn/social hero image (1200×628px, screenshot to use) |

All files should live in the same folder on the website so relative links work.

---

## Architecture Decisions

### Single HTML file
The entire tool is one `.html` file with no build process, no npm, no dependencies to install. All libraries loaded from CDN. Rationale: maximum portability, can be shared as an email attachment, works on air-gapped machines once downloaded.

### Library stack
- **Leaflet 1.9.4** + **Leaflet Draw 1.0.4** — map and polygon drawing
- **Turf.js 6** — spatial operations (booleanIntersects, bbox)
- **shpjs 4.0.4** — in-browser shapefile (.zip) parsing
- **sql.js 1.10.2** — WebAssembly SQLite for reading ARIA-Lex.db in browser
- **CartoDB Voyager tiles** — map basemap (lighter theme, good admin boundary visibility)

### AI integration
- Supports any OpenAI-compatible API
- Three presets: Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google)
- Custom endpoint field for self-hosted models (Ollama etc.)
- API key stored in localStorage per provider — never sent to Last Larch
- Anthropic requires `anthropic-dangerous-direct-browser-access: true` header for browser calls
- Data sent to AI: feature counts, attribute names, up to 40 sample rows per layer. No raw geometry.

### ARIA-Lex library format
- Standard SQLite database
- Key tables: `action_messages`, `hazards`, `sectors`, `severity_tiers`, `authority_levels`, `action_themes`, `library_meta`
- Hazard IDs: `cy` (cyclone), `fl` (flood), `hw` (heatwave), `wf` (wildfire), `eq` (earthquake), `ts` (tsunami), `cw` (cold wave), `do` (disease outbreak)
- Sector IDs: `gov`, `edu`, `hlt`, `log`, `trn`, `tel`, `fsa`, `com`
- Severity IDs: `extreme`, `severe`, `moderate`, `minor` (aligned to CAP)
- Authority level IDs: `nat`, `reg`, `loc`, `ind`
- ~1,671 messages in v1. All currently `provisional` validation status.
- Loaded into browser via sql.js — never uploaded to any server

### Output provenance tagging
Three tag types on every generated sector card:
- **Library** (green) — pre-validated message used as-is
- **Contextualised** (amber) — library message adapted with local GIS data
- **Synthesised** (purple) — no library match, generated from GIS data alone

### Library-only mode
Checkbox in Step 2: "Library only (no AI)". Skips API call entirely. Looks up matching messages by hazard × severity × authority level and renders them directly. All output tagged Library. For air-gapped deployments or when no AI API is available. Trade-off: no place-name or feature-count contextualisation.

### Local library server
Users can run a local Python server (`aria-server.py`) that watches a folder of GeoJSON files and serves them to ARIA on `localhost:8765`. ARIA polls every 10 seconds for changes. Connect button in the sources panel. Full script included in manual Chapter 15.

---

## UI/UX Decisions

### Three-step wizard
- **Step 1:** Geo query — map, sources, polygon, results summary
- **Step 2:** Review & configure — layer selection, hazard/severity/authority, AI config
- **Step 3:** Output — sector cards with CAP text, copy/export

Back buttons at every step. Step indicator bar at top shows progress.

### Sidebar layout (Step 1)
- Local library connection status bar (top of sources)
- Scrollable sources list
- Add source form (collapsible)
- Fit map to data button
- Paste polygon section
- Results summary table (compact — not scrollable list of features)
- Status bar with green dot

### Results summary (Step 1)
Compact table: source name | feature count | geometry type. Buttons: Review & generate CAP | ↓ CSV | ✕ Clear.

### Map
- CartoDB Voyager (light theme) — better admin boundary readability than dark theme
- Polygon draw colour: amber `#f0a500`
- Result points: amber circles with white border
- `intentionalMove` flag prevents libraries auto-panning map on layer load

### Header
- Title: **ARIA** + **LAST LARCH** (mono, amber) — links to lastlarch.com
- CC BY 4.0 credit (small, muted)
- Manual ↗ link (pill button → lastlarch.com/manual.html)
- Library status indicator (click to open settings panel)

### Settings panel
- Slides in from right
- ARIA-Lex.db drop zone
- Library stats display once loaded
- Drag .db file anywhere on main window to load

---

## Data & Privacy Architecture

- **Local files** (GeoJSON, shapefiles, .db): loaded into browser memory only. Never uploaded. Gone on tab close.
- **ArcGIS/WFS queries**: direct browser → server requests. ARIA is just the client.
- **AI API calls**: summary of GIS data sent to chosen provider. No geometry. User controls which provider.
- **API keys**: localStorage only. Never transmitted to Last Larch.
- **Local library server**: localhost only. Not network-accessible.

---

## GIS Source Types Supported

| Type | How | Notes |
|------|-----|-------|
| GeoJSON URL | fetch + cache | Loaded into memory on add |
| Shapefile (.zip) | shpjs in-browser | Drag-drop or file picker |
| ArcGIS REST | Live query on polygon | Auto-fixes FeatureServer URLs (appends /0) |
| ArcGIS Web Map URL | Extracts all layers via sharing REST API | Public maps only |
| WFS endpoint | BBOX-filtered GetFeature | CORS can be an issue |
| Local library server | localhost:8765 polling | Requires aria-server.py running |

### ArcGIS URL handling
Accepts all of: `.../FeatureServer/0`, `.../FeatureServer` (auto-appends `/0`), `.../query` (strips it), `arcgis.com/home/item.html?id=...` (extracts layers from web map definition).

### Polygon input formats
- Draw on map (polygon or rectangle tool)
- Paste lat/lng pairs (one per line, comma or space separated)
- Paste GeoJSON (Feature, FeatureCollection, or geometry object)
- Paste WKT `POLYGON((...))` or `MULTIPOLYGON`
- Auto-detects coordinate order (lng/lat vs lat/lng based on whether first value > 90)

---

## Column Alignment in CSV Export
Smart canonicalisation maps field name variants to standard columns:
- `addr`, `addr:street`, `street_address` → `address`
- `lat`, `y`, `geo_lat` → `latitude`
- `amenity`, `healthcare`, `facility_type` → `type`
- `objectid`, `fid`, `osm_id` → `osm_id`
- ~20 canonical groups total

Priority column order: `_source`, `geometry_type`, `longitude`, `latitude`, `name`, `type`, `subtype`, `address`, `city`, `district`... then alpha.

Two export types:
1. **Geo CSV** (Step 1): raw GIS query output — all features, all properties, no AI needed
2. **CAP text (.txt)** (Step 3): all sector descriptions with provenance tags

---

## Fit Map to Data Logic
- Computes turf bbox for each source with local data
- Ignores sources with bbox area > 9,720 sq° (~15% of world — treats as global)
- When sources vary >10× in size, fits to the smaller ones only (prevents Europe-wide sample data swamping Rwanda-scale data)
- `flyToBounds` with padding 40px, maxZoom 12, duration 1.2s
- `intentionalMove` flag prevents the layeradd event from cancelling the animation

---

## Branding & Identity

- **Product name:** ARIA (Alert Response Intelligence Assistant)
- **Company:** Last Larch
- **Website:** lastlarch.com
- **Email:** fysh@lastlarch.com
- **Seed library:** ARIA-Lex
- **Logo:** Black + gold larch mark (LL_Logo_4.png) — transparent background version extracted via flood-fill (background pure black [0,0,0], larch body charcoal [39,36,31])
- **Color palette (tool — dark):** bg `#0d1117`, surface `#161b22`, accent `#f0a500`, green `#3fb950`, blue `#58a6ff`, red `#f85149`, purple `#bc8cff`
- **Color palette (product page — light):** paper `#f7f4ee`, ink `#1a1a18`, gold `#b8860b`
- **Fonts:** Instrument Serif (headings), DM Sans (body), DM Mono (code/labels)

---

## License

**Creative Commons Attribution 4.0 International (CC BY 4.0)**
- Free to use, share, adapt for any purpose including commercial
- Must credit: *"ARIA by Last Larch (lastlarch.com)"*
- Full license: creativecommons.org/licenses/by/4.0
- Attribution line in tool header and HTML comment block at top of file

Rationale for CC BY over MIT: CC BY is already used by IFRC, WMO, UN agencies — the primary audience. Attribution requirement is explicit in plain language.

---

## LinkedIn & Communications

- **Post strategy:** Publish from personal account first (larger network, algorithm favours personal), repost with comment from Last Larch page within an hour
- **Target audience:** UN/WMO/DRR network + more distant contacts at ETH Zurich, governments, Google
- **Timing:** Tuesday–Thursday, 8–10am Geneva/East Africa time
- **Hero image:** `hero.html` — open at 1200×628px, screenshot for LinkedIn
- **Post tone:** Thoughtful practitioner sharing real work — not product launch language

---

## Known Issues & Future Work

### Resolved in current version
- Fit map to data button now works (was broken by CSS `display:none` overriding JS)
- ArcGIS URL auto-correction (no longer requires user to add `/0`)
- shpjs nested FeatureCollection unwrapping (was causing global zoom on shapefile load)
- Map auto-pan suppression on layer add

### Outstanding / future work discussed
- **Auto-import CAP polygons from met service warnings** — coordinates in CAP (Common Alerting Protocol) format which includes polygons. Would slot into the paste polygon logic, but automated. Discussed but not built.
- **Google Sheets export** — user has a plan for this. Not built yet.
- **Save messages back to ARIA-Lex** — ability to add AI-generated messages to the library from within the tool. Discussed, deferred.
- **ARIA-Lex validation** — all messages currently `provisional`. Need domain expert review before operational use.
- **Last Larch LinkedIn page** — needs banner, description, and prior posts before ARIA launch for credibility.
- **Download link on product page** — `ARIA v1.1.html` placeholder. Needs actual hosted file URL.

---

## How to Continue in a New Session

1. Upload the relevant file(s) at the start of the conversation
2. Paste the relevant section of this document as context
3. Say what you want to change or add

**For tool changes:** upload `index.html`
**For product page changes:** upload `product-page.html`
**For manual changes:** upload `manual.html`
**For all three:** upload all three

The tool is large (~1,400 lines). To avoid burning context on incremental patches, batch multiple changes and request clean rewrites rather than many small edits.
