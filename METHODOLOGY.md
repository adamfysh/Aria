# ARIA: Project Summary and Decisions Log
*Last Larch · fysh@lastlarch.com · lastlarch.com*
*Prepared for continuity across Claude sessions*

---

## What ARIA Is

ARIA (Alert Response Intelligence Assistant) is a free, open-source, browser-based tool built by Last Larch. It helps national authorities generate sector-specific, impact-driven alert language for the Common Alerting Protocol (CAP). It is a single HTML file. No server, install, or account is required.

**The core workflow:**
1. Load GIS data sources (local files, ArcGIS, WFS, GeoJSON URLs)
2. Draw or paste a polygon representing a hazard footprint
3. Query all sources to see what infrastructure and population are inside
4. Load a pre-validated early action message library (ARIA-Lex.db)
5. Configure hazard, severity, authority level, and AI model
6. Generate sector-specific CAP `<headline>` and `<description>` blocks, tagged by provenance

**Primary audience:** National meteorological services, disaster management authorities, UN agencies, EWS implementers, and the DRR/WMO community.

**Commercial model:** Free and open source. Last Larch is available for consultancy, custom implementations, and country deployments.

---

## File Inventory

| File | Purpose |
|------|---------|
| `index.html` (ARIA v1.1.html) | The tool itself, the entire application |
| `product-page.html` | Last Larch website product page |
| `manual.html` | 16-chapter operations manual |
| `ARIA-Lex.db` | Seed early action library (SQLite, ~924KB) |
| `hero.html` | LinkedIn and social hero image (1200×628px, screenshot to use) |

All files should live in the same folder on the website so relative links work.

---

## Architecture Decisions

### Single HTML file
The entire tool is one `.html` file with no build process, no npm, and no dependencies to install. All libraries load from CDN. Rationale: maximum portability. The file can be shared as an email attachment and works on air-gapped machines once downloaded.

### Library stack
- **Leaflet 1.9.4** + **Leaflet Draw 1.0.4**: map and polygon drawing
- **Turf.js 6**: spatial operations (booleanIntersects, bbox)
- **shpjs 4.0.4**: in-browser shapefile (.zip) parsing
- **sql.js 1.10.2**: WebAssembly SQLite for reading ARIA-Lex.db in the browser
- **CartoDB Voyager tiles**: map basemap (lighter theme, good admin boundary visibility)

### AI integration
- Supports any OpenAI-compatible API
- Three presets: Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google)
- Custom endpoint field for self-hosted models, such as Ollama
- API key stored in localStorage per provider. Never sent to Last Larch.
- Anthropic requires the `anthropic-dangerous-direct-browser-access: true` header for browser calls
- Data sent to the AI: feature counts, attribute names, and up to 40 sample rows per layer. No raw geometry.

### ARIA-Lex library format
- Standard SQLite database
- Key tables: `action_messages`, `hazards`, `sectors`, `severity_tiers`, `authority_levels`, `action_themes`, `library_meta`
- Hazard IDs: `cy` (cyclone), `fl` (flood), `hw` (heatwave), `wf` (wildfire), `eq` (earthquake), `ts` (tsunami), `cw` (cold wave), `do` (disease outbreak)
- Sector IDs: `gov`, `edu`, `hlt`, `log`, `trn`, `tel`, `fsa`, `com`
- Severity IDs: `extreme`, `severe`, `moderate`, `minor` (aligned to CAP)
- Authority level IDs: `nat`, `reg`, `loc`, `ind`
- ~1,671 messages in v1. All currently have `provisional` validation status.
- Loaded into the browser via sql.js. Never uploaded to any server.

### Output provenance tagging
Three tag types appear on every generated sector card:
- **Library** (green): pre-validated message used as-is
- **Contextualised** (amber): library message adapted with local GIS data
- **Synthesised** (purple): no library match, generated from GIS data alone

### Library-only mode
A checkbox in Step 2: "Library only (no AI)". It skips the API call entirely, looks up matching messages by hazard × severity × authority level, and renders them directly. All output is tagged Library. Use it for air-gapped deployments or when no AI API is available. Trade-off: no place-name or feature-count contextualisation.

### Local library server
Users can run a local Python server (`aria-server.py`) that watches a folder of GeoJSON files and serves them to ARIA on `localhost:8765`. ARIA polls every 10 seconds for changes. A Connect button in the sources panel links to it. The full script is in manual Chapter 15.

---

## UI/UX Decisions

### Three-step wizard
- **Step 1:** Geo query (map, sources, polygon, results summary)
- **Step 2:** Review and configure (layer selection, hazard/severity/authority, AI config)
- **Step 3:** Output (sector cards with CAP text, copy/export)

Back buttons appear at every step. A step indicator bar at the top shows progress.

### Sidebar layout (Step 1)
- Local library connection status bar (top of sources)
- Scrollable sources list
- Add source form (collapsible)
- Fit map to data button
- Paste polygon section
- Results summary table (compact, not a scrollable list of features)
- Status bar with green dot

### Results summary (Step 1)
Compact table: source name | feature count | geometry type. Buttons: Review & generate CAP | ↓ CSV | ✕ Clear.

### Map
- CartoDB Voyager (light theme), chosen for better admin boundary readability than a dark theme
- Polygon draw colour: amber `#f0a500`
- Result points: amber circles with white border
- `intentionalMove` flag prevents libraries from auto-panning the map on layer load

### Header
- Title: **ARIA** + **LAST LARCH** (mono, amber), linking to lastlarch.com
- CC BY 4.0 credit (small, muted)
- Manual ↗ link (pill button to lastlarch.com/manual.html)
- Library status indicator (click to open the settings panel)

### Settings panel
- Slides in from the right
- ARIA-Lex.db drop zone
- Library stats display once loaded
- A .db file can be dragged anywhere on the main window to load it

---

## Data and Privacy Architecture

- **Local files** (GeoJSON, shapefiles, .db): loaded into browser memory only. Never uploaded. Gone when the tab closes.
- **ArcGIS/WFS queries**: direct browser-to-server requests. ARIA is only the client.
- **AI API calls**: a summary of GIS data is sent to the chosen provider. No geometry. The user controls which provider.
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
Accepted formats: `.../FeatureServer/0`, `.../FeatureServer` (appends `/0` automatically), `.../query` (strips it), and `arcgis.com/home/item.html?id=...` (extracts layers from the web map definition).

### Polygon input formats
- Draw on the map (polygon or rectangle tool)
- Paste lat/lng pairs (one per line, comma or space separated)
- Paste GeoJSON (Feature, FeatureCollection, or geometry object)
- Paste WKT `POLYGON((...))` or `MULTIPOLYGON`
- Coordinate order (lng/lat or lat/lng) is detected automatically, based on whether the first value is greater than 90

---

## Column Alignment in CSV Export
Smart canonicalisation maps field name variants to standard columns:
- `addr`, `addr:street`, `street_address` → `address`
- `lat`, `y`, `geo_lat` → `latitude`
- `amenity`, `healthcare`, `facility_type` → `type`
- `objectid`, `fid`, `osm_id` → `osm_id`
- About 20 canonical groups in total

Priority column order: `_source`, `geometry_type`, `longitude`, `latitude`, `name`, `type`, `subtype`, `address`, `city`, `district`, then alphabetical.

Two export types:
1. **Geo CSV** (Step 1): raw GIS query output with all features and properties. No AI needed.
2. **CAP text (.txt)** (Step 3): all sector descriptions with provenance tags

---

## Fit Map to Data Logic
- Computes turf bbox for each source with local data
- Ignores sources with a bbox area over 9,720 sq° (~15% of the world), treating them as global
- When sources vary by more than 10× in size, fits to the smaller ones only. This prevents Europe-wide sample data from swamping Rwanda-scale data.
- `flyToBounds` with 40px padding, maxZoom 12, duration 1.2s
- `intentionalMove` flag prevents the layeradd event from cancelling the animation

---

## Branding and Identity

- **Product name:** ARIA (Alert Response Intelligence Assistant)
- **Company:** Last Larch
- **Website:** lastlarch.com
- **Email:** fysh@lastlarch.com
- **Seed library:** ARIA-Lex
- **Logo:** Black + gold larch mark (LL_Logo_4.png). The transparent-background version was extracted by flood-fill (background pure black [0,0,0], larch body charcoal [39,36,31])
- **Color palette (tool, dark):** bg `#0d1117`, surface `#161b22`, accent `#f0a500`, green `#3fb950`, blue `#58a6ff`, red `#f85149`, purple `#bc8cff`
- **Color palette (product page, light):** paper `#f7f4ee`, ink `#1a1a18`, gold `#b8860b`
- **Fonts:** Instrument Serif (headings), DM Sans (body), DM Mono (code/labels)

---

## License

**Creative Commons Attribution 4.0 International (CC BY 4.0)**
- Free to use, share, and adapt for any purpose, including commercial
- Must credit: *"ARIA by Last Larch (lastlarch.com)"*
- Full license: creativecommons.org/licenses/by/4.0
- Attribution line in the tool header and in an HTML comment block at the top of the file

Rationale for CC BY over MIT: CC BY is already used by IFRC, WMO, and UN agencies, which are the primary audience. The attribution requirement is explicit in plain language.

---

## LinkedIn and Communications

- **Post strategy:** Publish from the personal account first (larger network, and the algorithm favours personal accounts), then repost with a comment from the Last Larch page within an hour
- **Target audience:** UN/WMO/DRR network, plus more distant contacts at ETH Zurich, governments, and Google
- **Timing:** Tuesday to Thursday, 8 to 10am Geneva/East Africa time
- **Hero image:** `hero.html`. Open at 1200×628px and screenshot for LinkedIn
- **Post tone:** A thoughtful practitioner sharing real work, not product launch language

---

## Known Issues and Future Work

### Resolved in current version
- Fit map to data button now works (it was broken by CSS `display:none` overriding JS)
- ArcGIS URL auto-correction (users no longer need to add `/0`)
- shpjs nested FeatureCollection unwrapping (this was causing a global zoom on shapefile load)
- Map auto-pan suppression on layer add

### Outstanding and future work discussed
- **Auto-import CAP polygons from met service warnings:** CAP (Common Alerting Protocol) warnings include polygon coordinates. Importing them would slot into the paste polygon logic, but automated. Discussed but not built.
- **Google Sheets export:** The user has a plan for this. Not built yet.
- **Save messages back to ARIA-Lex:** the ability to add AI-generated messages to the library from within the tool. Discussed and deferred.
- **ARIA-Lex validation:** all messages are currently `provisional`. Domain expert review is needed before operational use.
- **Last Larch LinkedIn page:** needs a banner, description, and prior posts before the ARIA launch, for credibility.
- **Download link on product page:** `ARIA v1.1.html` placeholder. Needs the actual hosted file URL.

---

## How to Continue in a New Session

1. Upload the relevant file(s) at the start of the conversation
2. Paste the relevant section of this document as context
3. Say what to change or add

**For tool changes:** upload `index.html`
**For product page changes:** upload `product-page.html`
**For manual changes:** upload `manual.html`
**For all three:** upload all three

The tool is large (~1,400 lines). To avoid using up context on incremental patches, batch multiple changes and request clean rewrites instead of many small edits.
