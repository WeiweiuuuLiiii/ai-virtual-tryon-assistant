# StyleSignal

An AI-powered personal styling assistant built with Java Spring Boot and the Anthropic Claude API. StyleSignal analyzes body shape, builds a parametric fit model, and provides AI outfit recommendations — structured around a mock try-on studio where users drag clothing onto a mannequin and receive instant AI feedback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 17 · Spring Boot 3.3 · Maven |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) · multimodal vision |
| Frontend | Vanilla JS · HTML5 Drag and Drop API · CSS Grid |
| Storage | JSON flat files (no database) |
| Weather | OpenWeatherMap API (mock fallback) |

---

## Running Locally

```bash
# requires ANTHROPIC_API_KEY in environment
export ANTHROPIC_API_KEY=sk-ant-...

./run.sh           # starts on http://localhost:8000
./mvnw compile     # compile check only
```

---

## Development Roadmap

### v0.1.0 — Backend MVP
**Branch:** `main` / `stylesignal-fitting-room-v2`

Established the core API surface:
- `POST /api/analyze-style` — Claude vision analysis of outfit photos → style profile JSON
- `POST /api/model` — Claude vision analysis of full-body photo → body shape + proportion tags
- `GET /api/weather` — weather context for outfit recommendations
- `POST /api/recommend` — weather- and occasion-aware outfit recommendation
- `POST /api/scene-check` — rates an outfit description against a chosen scene
- `POST /api/buy-check` — evaluates a product photo against the user's style profile and body model
- Flat-file persistence (`StorageService`) for profile, model data, and model photo

---

### v0.2.0 — Fit Model MVP
**Branch:** `issue-1-fit-model-mannequin`

Replaced the generic body-analysis card with a two-panel My Fit Model page:
- **Left panel:** Reference photo (the uploaded full-body image, small and secondary)
- **Right panel:** Parametric mannequin SVG generated from body shape — the visual centerpiece
- `generateMannequinSVG(bodyShape)` — inline SVG with cubic Bézier curves, 5 shapes (hourglass, pear, inverted_triangle, rectangle, apple)
- `renderFitModelMannequin(bodyShape, measurements)` — public wrapper called by the model render path
- Collapsible sections for measurements editing (`PATCH /api/model/measurements`) and full analysis
- Shape badge, proportion chips, and fit notes stacked below the mannequin
- `PATCH /api/model/measurements` correctly merges incoming fields (partial updates preserve all prior values)

**Status:** Codex-reviewed and passing.

---

### v0.3.0 — Try-On Studio MVP
**Branch:** `issue-2-clothing-assets-drag-drop`

Introduced the three-column fitting room layout:
- **Left — Wardrobe panel:** Upload clothing photos → draggable asset cards with type chip (cycles Top → Bottom → Dress → Layer → Shoes → Bag on click), filename-based type guessing, green border when assigned
- **Center — Mannequin preview:** Parametric mannequin from v0.2 as the try-on base (not the user's photo). Three HTML5 drag-and-drop zones overlaid: `#dz-top` (upper 36%), `#dz-bottom` (mid 28%), `#dz-shoes` (foot 14%). Extra slots (outerwear, bag, dress) rendered as chips below.
- **Right — Compact AI check:** Scene/vibe pickers + weather input. "Check This Look" enabled only when ≥1 slot filled and a scene is selected. AI result shows verdict badge, three fit scores, up to three reasons, and swap chips — no lengthy paragraphs.
- State: `state.clothingAssets[]` (library) + `state.slotAssignments{}` (slot→assetId map) kept separate. `runSceneAnalysis()` derives `state.studioItems` from assignments before POSTing to `POST /api/try-on-studio`.
- AI prompt updated: `fit_model_used: true` (not `model_photo_used`), `suggested_swaps[]` added to schema.

**Status:** Codex-reviewed and passing.

---

### v0.4.0 — Clean Garment Asset Pipeline
**Branch:** `issue-3-garment-overlay-refinement`

Refined the visual overlay so garment thumbnails read as clothing layers rather than pasted product screenshots:
- `object-fit: contain` (replacing `cover`) with explicit height and max-width per slot — garment renders at its natural proportion without wall-to-wall fill
- Slot-specific classes: `.garment-layer-top` (78% height, 65% max-width, avoids neck), `.garment-layer-bottom` (88% height, 56% max-width — narrower for pants/skirts), `.garment-layer-shoes` (72% height, 52% max-width)
- `opacity: 0.82` + `filter: drop-shadow` — mannequin remains visible beneath the overlay
- Empty zones show "Drop Top / Drop Bottom / Drop Shoes" placeholders with dashed borders
- Filled zones show `.dz-slot-label` (top-left chip) and `.mock-extracted-badge` ("Mock", bottom-center)
- AI check panel: verdict badge, score chips, bullet text, and swap chips all scaled down; `max-height: 380px` with scroll so result never overflows the column

> **Note:** This remains a mock preview pipeline. No real garment segmentation or AI image generation is used. The mannequin is parametric SVG; clothing overlays are contained thumbnails.

**Status:** Codex-reviewed and passing.

---

### Future Direction

- **v0.5 — Outfit History & Feedback Loop:** Log worn outfits with occasion and comfort ratings; surface patterns ("you always reach for this top before interviews") back into recommendations.
- **v0.6 — Closet Inventory:** Persistent garment library with tags, wear-count, and cost-per-wear tracking.
- **v0.7 — Real Garment Segmentation:** Integrate a background-removal or segmentation step (e.g., rembg or a cloud API) to produce clean cutout assets rather than contained thumbnails.
- **v0.8 — Realistic Try-On Layer:** Explore diffusion-based virtual try-on (e.g., IDM-VTON or a hosted API) once the garment pipeline is clean — only when quality is high enough to not mislead.

---

## Development Workflow

This project follows a structured, milestone-based iteration process:

1. **Product specs as GitHub Issues** — Each feature milestone is written as a GitHub Issue with explicit acceptance criteria, layout requirements, and explicit "what not to do" constraints. Issues are scoped narrowly so each branch has a single clear goal.

2. **Implementation on scoped branches** — [Claude Code](https://claude.ai/code) implements each issue on a dedicated branch (`issue-N-short-description`). The implementer inspects the current state of the codebase before making changes and confirms affected files explicitly.

3. **Automated acceptance review** — Codex reviews each branch against the issue's acceptance criteria after implementation. Failing criteria are filed back as follow-up fix requests on the same branch (not a new issue).

4. **Local compile and visual checks** — Every branch must pass `./mvnw compile` before merge. Visual correctness (layout, drag-and-drop, mannequin rendering) is verified manually in the browser against the running `./run.sh` server.

5. **Milestone-based progression** — Each issue depends on the previous one (`#2 depends on #1`, `#3 depends on #2`). New branches start from the latest passing issue branch, not from main, until a formal merge and release checkpoint.

---

## Project Structure

```
src/
  main/
    java/com/stylesignal/
      controller/   ApiController.java
      model/        request record types
      service/      ClaudeService.java  WeatherService.java  StorageService.java
    resources/
      static/
        index.html  app.js  style.css
      application.properties
data/               flat-file persistence (profile.json, model.json, ...)
run.sh              start script
```
