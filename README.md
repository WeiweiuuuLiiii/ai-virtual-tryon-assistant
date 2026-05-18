# StyleSignal

An AI-powered personal styling assistant built with Java Spring Boot and the Anthropic Claude API. StyleSignal analyzes body shape, builds a parametric fit model, and provides AI outfit recommendations — structured around a mock try-on studio where users drag clothing onto a mannequin and receive instant AI feedback.

> **Status:** Actively in development. Core backend, fit model, and try-on studio MVPs are complete and Codex-reviewed. Frontend polish, hosted deployment, and a real garment-segmentation pipeline are in progress.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 17 · Spring Boot 3.3 · Maven |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) · multimodal vision |
| Frontend | Vanilla JS · HTML5 Drag and Drop API · CSS Grid |
| Storage | JSON flat files (no database required) |
| Weather | OpenWeatherMap API (mock fallback included) |

---

## Running Locally

```bash
# requires ANTHROPIC_API_KEY in environment
export ANTHROPIC_API_KEY=sk-ant-...

./run.sh           # starts on http://localhost:8000
./mvnw compile     # compile check only
```

---

## Core API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/analyze-style` | Claude vision analysis of outfit photos → style profile |
| `POST /api/model` | Full-body photo → body shape, proportion tags, fit notes |
| `PATCH /api/model/measurements` | Merge updated measurements into saved model |
| `GET /api/model/photo` | Retrieve stored reference photo |
| `GET /api/weather` | Weather context by location |
| `POST /api/scene-check` | Rate outfit description against a chosen scene |
| `POST /api/try-on-studio` | AI fit/style/scene analysis of uploaded clothing items |
| `POST /api/recommend` | Weather- and occasion-aware outfit recommendation |
| `POST /api/feedback` | Log outfit wear data for future personalization |
| `POST /api/buy-check` | Evaluate product photo against style profile and body model |

---

## Development Roadmap

### v0.1.0 — Backend MVP
**Branch:** `stylesignal-fitting-room-v2`

Established the full API surface and data pipeline:
- Core REST endpoints wired and returning structured JSON
- Claude multimodal vision integration with base64 image encoding
- `StorageService` flat-file persistence (profile, model data, model photo)
- Style taxonomy for grounding fashion analysis
- Weather API integration with mock fallback

---

### v0.2.0 — Fit Model MVP
**Branch:** `issue-1-fit-model-mannequin`

Replaced the generic body-analysis card with a two-panel My Fit Model page:
- **Left panel:** Reference photo (uploaded image, small and secondary)
- **Right panel:** Parametric mannequin SVG — the visual centerpiece
- `generateMannequinSVG(bodyShape)` — inline SVG with cubic Bézier curves, 5 body shapes (hourglass, pear, inverted_triangle, rectangle, apple)
- `renderFitModelMannequin(bodyShape, measurements)` — public wrapper for the model render path
- Collapsible measurement editor wired to `PATCH /api/model/measurements`
- Partial-update merge: incoming fields merged over existing measurements, no data loss
- Shape badge, proportion chips, and fit notes stacked below mannequin

**Codex review:** Passing.

---

### v0.3.0 — Try-On Studio MVP
**Branch:** `issue-2-clothing-assets-drag-drop`

Introduced the three-column fitting room layout:
- **Left — Wardrobe panel:** Upload clothing photos → draggable asset cards with type chip (cycles Top → Bottom → Dress → Layer → Shoes → Bag), filename-based type guessing, green border when assigned to a slot
- **Center — Mannequin preview:** Parametric mannequin from v0.2 as the try-on base (not the user's photo). Three HTML5 drag-and-drop zones: `#dz-top` (upper torso), `#dz-bottom` (waist/legs), `#dz-shoes` (feet). Extra slots (outerwear, bag, dress) rendered as chips below.
- **Right — Compact AI check:** Scene/vibe pickers, weather input. "Check This Look" enabled only when ≥1 slot filled and a scene selected. Result: verdict badge, three fit scores, up to three reasons, swap chips.
- `state.clothingAssets[]` (library) + `state.slotAssignments{}` (slot → assetId) kept separate
- AI prompt schema updated: `fit_model_used: true`, `suggested_swaps[]` field added

**Codex review:** Passing.

---

### v0.4.0 — Garment Overlay Refinement
**Branch:** `issue-3-garment-overlay-refinement`

Refined clothing overlays so thumbnails read as garment layers, not pasted product screenshots:
- `object-fit: contain` (replacing `cover`) with explicit height and `max-width` per slot
- Slot-specific layer classes:
  - `.garment-layer-top` — 78% height, 65% max-width, offset to avoid neck
  - `.garment-layer-bottom` — 88% height, 56% max-width (narrower for pants/skirts)
  - `.garment-layer-shoes` — 72% height, 52% max-width (small, near sole)
- `opacity: 0.82` + `filter: drop-shadow` — mannequin remains visible beneath overlays
- Empty zones: "Drop Top / Drop Bottom / Drop Shoes" with dashed borders
- Filled zones: `.dz-slot-label` chip + `.mock-extracted-badge` ("Mock") label
- AI check panel: verdict badge, score chips, bullet text, and swap chips scaled down; `max-height: 380px` with scroll

> **Note:** v0.4 is a mock preview pipeline. No real garment segmentation or AI image generation is used. The mannequin is parametric SVG; clothing overlays are contained thumbnails.

**Codex review:** Passing.

---

### Future Direction

- **v0.5 — Clean Garment Asset Pipeline:** Separate raw uploaded product images from clean garment asset representations; add garment metadata, cleanup status, and clean preview URLs.
- **v0.6 — Outfit History & Feedback Loop:** Log worn outfits with occasion and comfort ratings; surface patterns back into recommendations.
- **v0.7 — Real Garment Segmentation:** Background removal or segmentation (e.g., rembg or cloud API) to produce clean cutout assets.
- **v0.8 — Realistic Try-On Layer:** Diffusion-based virtual try-on (e.g., IDM-VTON or a hosted inference API) — only when output quality is high enough to be genuinely useful.

---

## Development Workflow

This project uses a structured, milestone-based iteration process:

1. **GitHub Issues as product specs** — Each feature milestone is written as a GitHub Issue with explicit acceptance criteria, layout requirements, and clear "what not to do" constraints. Issues are scoped narrowly so each branch has a single clear goal.

2. **Scoped implementation branches** — [Claude Code](https://claude.ai/code) implements each issue on a dedicated branch (`issue-N-short-description`). The implementer inspects the current codebase before making changes and reports affected files explicitly.

3. **Acceptance review by Codex** — Codex reviews each branch against the issue's acceptance criteria after implementation. Failing criteria are returned as fix requests on the same branch.

4. **Local compile and visual checks** — Every branch must pass `./mvnw compile`. Visual correctness (layout, drag-and-drop, mannequin rendering) is verified manually against the running `./run.sh` server.

5. **Milestone-based progression** — Each issue builds on the previous (`#2 depends on #1`, `#3 depends on #2`). New branches start from the latest passing issue branch until a formal merge checkpoint.

---

## Product Vision

The final product should feel like a personal fitting room, not a chatbot:

1. Body and style profile creation from uploaded photos
2. Clothing upload and garment asset management
3. Drag-and-drop outfit assembly on a personal fit model
4. Scene, occasion, and weather context
5. AI fit, style, and scene analysis
6. Buy-or-skip recommendation from product images
7. Outfit wear history and feedback loop for personalization

---

## Project Structure

```
src/
  main/
    java/com/stylesignal/
      controller/   ApiController.java
      model/        request record types (FeedbackRequest, RecommendRequest, ...)
      service/      ClaudeService.java  WeatherService.java  StorageService.java
    resources/
      static/
        index.html  app.js  style.css
      application.properties
data/               flat-file persistence (profile.json, model.json, feedback/)
run.sh              start script
```
