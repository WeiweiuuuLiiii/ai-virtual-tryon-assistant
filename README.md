# StyleSignal
**StyleSignal** is a full-stack AI virtual fitting room and shopping-decision platform built from the ground up with Java Spring Boot, JavaScript, OpenAI GPT Image, Claude, and REST APIs.
The product helps users answer a real shopping question:
> **“Will this actually look good on me before I buy it?”**
StyleSignal combines virtual try-on generation, full-outfit copying, wardrobe-based outfit building, fit simulation, color analysis, planned multi-edit generation, saved looks, and side-by-side comparison into one interactive AI fitting-room workflow.
## Live Demo
[Try StyleSignal Public Demo](https://ai-virtual-tryon-assistant-production.up.railway.app)
Public demo mode is enabled to protect API credits. Live AI generation requires a private demo code. Contact me for a live walkthrough.
---
## Highlights
- **GPT Image-powered virtual try-on** for high-quality outfit previews
- **Full-outfit copying** from reference photos
- **Drag-and-drop wardrobe builder** with clothing slots and accessory hotbar
- **Complete the Look / Style Boost** recommendations
- **Planned Edits workflow** for staging accessories, fit shifts, scene changes, and custom styling ideas before one final generation
- **Size Up / Size Down visual fit simulation**
- **Color Fit analysis** with skin tone profile support
- **Save Looks / Look Archive** with editable notes and favorites
- **Edit This Look** to reload saved outfits back into the Studio
- **Compare Board** for side-by-side outfit decisions
- **Public Demo Mode + demo-code credit protection** for safe public sharing
- **Futuristic game-like AI fitting-room UI** with AI Mirror, Wardrobe Inventory, Planned Edits, and Look Archive flows
---
## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Java 17 · Spring Boot 3.3 · Maven |
| AI Image Generation | OpenAI GPT Image |
| AI Vision / Styling Analysis | Anthropic Claude API |
| Frontend | Vanilla JavaScript · HTML5 Drag and Drop API · CSS Grid |
| Storage | JSON flat files · LocalStorage |
| Weather | OpenWeatherMap API with mock fallback |
| Deployment | Railway public demo deployment |
| Workflow | GitHub Issues · Claude Code · Codex-style review · feature branches |
---
## Product Overview
StyleSignal is designed as a **real-life AI fitting room**, not a basic chatbot or image-generation toy.
The user can:
1. Upload a model photo or outfit reference
2. Build outfits through a wardrobe-style drag-and-drop interface
3. Generate try-on previews with GPT Image
4. Copy full outfits from inspiration photos
5. Add accessories or styling changes
6. Preview size up/down fit differences
7. Analyze color compatibility
8. Save generated looks
9. Compare outfits side by side
10. Reload saved looks and continue editing
The product direction is closer to a **future AI closet / digital dressing game** than a standard SaaS dashboard.
---
## Core Features
### AI Studio
The main Studio includes:
- **AI Render Engine** powered by GPT Image
- **Wardrobe Inventory** for uploaded clothing assets
- **AI Mirror Stage** with equipment-style outfit slots
- **Generated Preview** result panel
- **Complete the Look** recommendation cards
- **Color Fit** compatibility analysis
- **Size Fit Preview**
- **Planned Edits / Look Upgrade Queue**
- **Save Look** and **View Larger** actions
---
### Try-On Generation
StyleSignal supports GPT Image-based try-on flows:
- Generate a full outfit preview from assigned clothing slots
- Copy a whole outfit from a reference image onto the user's saved model photo
- Add one item to an existing generated look
- Batch add selected AI-recommended items
- Apply planned edits in one combined high-quality generation request
The current public product version focuses on GPT Image only for a cleaner and more reliable demo experience.
---
### Plan First → Generate Once
Instead of forcing users to wait after every small edit, StyleSignal includes a latency-aware editing workflow:
1. Stage accessories from Complete the Look
2. Add custom styling ideas
3. Choose a fit shift
4. Choose a scene or lighting direction
5. Apply all changes to the current look in one GPT Image request
This reduces repeated generation steps while preserving premium output quality.
---
### Save Looks + Compare
Users can save generated outfits into a Look Archive.
Saved looks support:
- Editable labels
- Notes
- Favorite state
- Source badges
- Fit preview badges
- View Larger
- Delete
- Compare selection
- Edit This Look
The Compare Board allows 2–4 looks to be compared side by side with large image-first layout.
---
### Edit This Look
Saved looks can be loaded back into the Studio as the current preview.
This allows users to:
- Continue editing an older generated outfit
- Run Complete the Look again
- Use Planned Edits
- Run Size Fit Preview
- Re-check Color Fit
- Save a new version
Loading a saved look does **not** call GPT Image by itself.
---
### Public Demo Mode
The public deployment is credit-protected.
Protected operations include:
- Generate Try-On Preview
- Try Whole Outfit
- Add Now
- Batch Add
- Size Fit Preview
- Apply Planned Changes
Without a valid demo code, public users can view the interface but cannot trigger unlimited live OpenAI generation.
This protects API credits while still allowing recruiters, engineers, and reviewers to explore the product.
---
## Running Locally
Set required environment variables first:
```bash
export OPENAI_API_KEY=your_openai_key
export ANTHROPIC_API_KEY=your_anthropic_key

Start the app:

./run.sh

or:

./mvnw spring-boot:run

The app runs locally at:

http://localhost:8000

Compile check:

./mvnw compile

⸻

Demo Mode Configuration

Local developer mode:

PUBLIC_DEMO_MODE=false

Public demo mode:

PUBLIC_DEMO_MODE=true
DEMO_CODES=MEETUP001,TESLA2026
DEMO_CODE_MAX_USES=3
DAILY_GENERATION_LIMIT=5

When PUBLIC_DEMO_MODE=true, real GPT Image generation requires a valid demo code.

⸻

Core API Endpoints

Endpoint	Description
POST /api/analyze-style	Analyze uploaded outfit photos and generate a style profile
POST /api/model	Build a saved model profile from a full-body photo
PATCH /api/model/measurements	Update saved model measurements
GET /api/model/photo	Retrieve saved model reference photo
POST /api/try-on/generate	Generate GPT Image try-on preview
POST /api/try-on/full-outfit	Copy a full outfit reference onto saved model
POST /api/try-on/add-item	Add one item to the current preview
POST /api/try-on/add-items	Batch add selected items
POST /api/try-on/fit-preview	Generate size up/down visual fit preview
POST /api/try-on/generate-plan	Apply planned edits in one combined request
POST /api/try-on/color-fit	Analyze color compatibility
POST /api/model/detect-skin-tone	Detect styling-only skin tone profile
GET /api/weather	Fetch weather context
POST /api/recommend	Generate weather-aware outfit recommendation
POST /api/feedback	Log outfit wear feedback
POST /api/buy-check	Evaluate product image against style profile

⸻

Engineering Highlights

* Full-stack Spring Boot + JavaScript product architecture
* GPT Image integration with protected backend API calls
* Claude-powered structured fashion analysis
* Multipart image upload handling
* Optimized-format retry fallback for image generation
* Request caching for repeated planned edits
* Abort/cancel controls for long-running generation
* Stale-result guards for asynchronous AI workflows
* Safe billing/credit/rate-limit error handling
* Demo-code protection for public deployment
* LocalStorage persistence for saved looks and comparison state
* UI state recovery for malformed or missing saved data
* Feature-by-feature review workflow with GitHub Issues and Codex-style acceptance checks

⸻

Development Workflow

This project uses a structured AI-assisted engineering workflow:

1. GitHub Issues as product specs
    Each feature is written as a scoped issue with acceptance criteria, edge cases, and regression constraints.
2. Claude Code implementation
    Features are implemented on dedicated branches with clear file-change reports.
3. Codex-style review
    Each branch is reviewed against acceptance criteria. Failing findings are fixed before moving forward.
4. Compile and diff checks
    Every milestone must pass:

./mvnw compile
git diff --check

5. Manual product testing
    UI flows are manually tested for generation, drag/drop, saved looks, compare, demo lock, and deployment behavior.

⸻

Project Structure

src/
  main/
    java/com/stylesignal/
      controller/
        ApiController.java
      service/
        ClaudeService.java
        OpenAiImageService.java
        DemoGuardService.java
        StorageService.java
        WeatherService.java
      exception/
        OpenAiProviderException.java
        DemoGuardException.java
    resources/
      static/
        index.html
        app.js
        style.css
      application.properties
data/
  flat-file persistence
run.sh
mvnw
pom.xml

⸻

Current Status

StyleSignal is a working full-stack AI product demo with public deployment, GPT Image try-on generation, saved-look workflows, planned multi-edit generation, and demo-code credit protection.

The current public demo is intentionally protected from unlimited live generation.

Future improvements may include:

* Sample result mode for public users without demo codes
* User accounts
* Stripe or app-credit payment system
* Database-backed saved looks
* More advanced garment segmentation
* Stronger game-like visual polish

