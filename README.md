# AI Virtual Try-On & Outfit Decision Assistant

Pre-launch AI product MVP for virtual try-on and context-aware outfit decision support.

This project explores an AI shopping assistant that helps users preview clothing on a personal digital fitting model and receive practical buy-or-skip recommendations before purchase.

## Problem

Online shoppers often cannot tell how a piece of clothing will actually look on their own body before buying it. Product photos and model photos do not reflect each user’s body shape, proportions, lifestyle, or real use case. This leads to uncertainty, wasted time, returns, and low purchase confidence.

## Product Vision

The goal is to build a user-centered AI try-on experience where users can:

- Create a personal digital fitting model from body measurements or a full-body photo
- Upload clothing items such as tops, pants, dresses, shoes, and accessories
- Virtually preview outfits on their own body model
- Choose a real-world context such as travel, work, date night, school, or hot/cold weather
- Receive AI-powered fit, style, comfort, weather, occasion, and buy-or-skip analysis

## Core Workflow

1. User profile / body model creation
2. Garment image upload
3. Outfit composition
4. Scene and context selection
5. AI fit, style, weather, and occasion analysis
6. Buy-or-skip recommendation

## Current Status

Work in progress / pre-launch MVP.

The current focus is on product architecture, core workflow design, AI-agent-assisted feature planning, and building the first interactive frontend prototype.

## Planned System Components

- `profile-model` — stores user measurements, body proportions, and style preferences
- `garment-intake` — handles uploaded clothing images and metadata
- `try-on-planner` — maps clothing items onto the user’s digital fitting model
- `context-engine` — incorporates weather, occasion, travel, comfort, and scene constraints
- `outfit-evaluator` — analyzes fit, style match, practicality, and repeat-use likelihood
- `recommendation-layer` — generates buy-or-skip recommendation with explanation
- `feedback-loop` — captures user feedback to improve future suggestions

## Engineering Focus

- AI-agent-assisted product engineering
- Modular frontend/product architecture
- Context-aware recommendation logic
- Privacy-aware image and body data handling
- Edge-case validation for sizing, image quality, and trust
- Repeatable development workflow using planning docs, checklists, and GitHub commits

## AI-Agent Workflow

This project is being developed with a human-in-the-loop AI-agent workflow:

1. Define product requirement and user problem
2. Map components, data flow, and feature boundaries
3. Use Claude Code to draft implementation scaffolding and tests
4. Review generated output manually
5. Run local validation and edge-case checks
6. Iterate through documented changes

AI is used as an engineering partner, not a replacement for human judgment. The goal is to use AI to take the workflow to the next level while keeping planning, validation, and final decisions human-led.

## Roadmap

- [ ] Build landing page and onboarding flow
- [ ] Add measurement input and body profile form
- [ ] Add garment upload UI
- [ ] Add outfit composition screen
- [ ] Add scene/context selector
- [ ] Add AI analysis result page
- [ ] Add buy-or-skip recommendation output
- [ ] Add privacy and image quality edge-case handling
- [ ] Deploy frontend MVP with GitHub Pages
