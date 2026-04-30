# StyleSignal AI Closet

In-progress AI virtual try-on and outfit decision assistant.

StyleSignal is a pre-launch AI product MVP that helps users create a personal fitting profile, upload clothing items, evaluate outfits in real-world contexts, and receive buy-or-skip recommendations before purchasing.

The final product vision is a “real-life dress-up assistant”: users can preview how clothing may work for their own body, style, weather, occasion, and lifestyle before spending money.

## Current Status

Actively in progress.

Completed so far:
- Spring Boot backend MVP
- Claude-powered AI analysis workflows
- Weather/context integration
- Local JSON/file storage
- Multipart image upload APIs
- Static frontend prototype served by Spring Boot
- Product planning docs and roadmap

In progress:
- Frontend polish
- Hosted deployment
- Stronger recommendation evaluation
- Real virtual try-on rendering / image generation layer
- Privacy controls for uploaded body and outfit images

## Completed Backend Features

- Style profile analysis from uploaded outfit photos
- Personal body model setup from full-body photo and optional measurements
- Stored body model photo and model metadata
- Weather-aware outfit context using location input
- Scene check API for outfit + scene + weather + body model analysis
- Try-On Studio API supporting top, bottom, dress, outerwear, shoes, and bag uploads
- Personalized outfit recommendations using stored style profile and weather context
- Feedback logging for future personalization
- Buy-or-skip purchase check from uploaded product images
- Structured style taxonomy for grounding fashion analysis

## Tech Stack

- Java 17
- Spring Boot
- Claude / Anthropic API
- OpenWeather API
- HTML / CSS / JavaScript
- Maven
- Local JSON/file storage
- Git/GitHub

## Core API Areas

- `/api/profile`
- `/api/analyze-style`
- `/api/model`
- `/api/model/photo`
- `/api/weather`
- `/api/scene-check`
- `/api/try-on-studio`
- `/api/recommend`
- `/api/feedback`
- `/api/buy-check`

## Product Vision

The goal is not just outfit recommendation.

The final product should support:
1. Personal body/style profile creation
2. Clothing upload
3. Virtual outfit planning
4. Scene and context selection
5. AI fit/style/weather/occasion analysis
6. Buy-or-skip recommendation
7. User feedback loop for future personalization

## AI-Agent Engineering Workflow

This project is developed with a human-in-the-loop AI-agent workflow:

1. Map existing components and data flow
2. Define feature boundaries and API behavior
3. Use Claude Code to draft scaffolding and test ideas
4. Review and modify generated output manually
5. Validate through local runs and edge-case checks
6. Commit meaningful progress through GitHub

AI is used as an engineering partner, not as a replacement for human judgment.

## Roadmap

### Backend
- [x] Style profile analysis
- [x] Body model setup
- [x] Model photo storage
- [x] Weather context
- [x] Scene check
- [x] Try-on studio uploads
- [x] Recommendation API
- [x] Feedback API
- [x] Buy-check API

### Frontend
- [x] Static frontend prototype
- [ ] Frontend polish
- [ ] Better onboarding flow
- [ ] Better upload UX
- [ ] Outfit composition interface
- [ ] Recommendation result UI

### AI / Product
- [x] Claude workflow integration
- [x] Style taxonomy
- [ ] Stronger evaluation consistency
- [ ] Privacy controls
- [ ] Real try-on rendering / image generation
- [ ] Hosted demo deployment
