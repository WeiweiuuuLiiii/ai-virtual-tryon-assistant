# API Overview

## Profile

### GET /api/profile
Loads the saved user style profile.

### POST /api/analyze-style
Uploads outfit photos and generates a Claude-powered style profile.

## Body Model

### GET /api/model
Loads saved body model data.

### POST /api/model
Uploads a full-body photo and optional measurements to create a body model.

### GET /api/model/photo
Returns the saved body model photo.

## Weather

### GET /api/weather?location=
Returns weather context for outfit decisions.

## Scene Check

### POST /api/scene-check
Evaluates whether an outfit fits a selected scene, vibe, body model, and weather context.

## Try-On Studio

### POST /api/try-on-studio
Accepts uploaded clothing images:
- top
- bottom
- dress
- outerwear
- shoes
- bag

Returns AI analysis of the uploaded outfit items.

## Recommendation

### POST /api/recommend
Generates weather-aware and occasion-aware outfit recommendations using saved profile data.

## Feedback

### POST /api/feedback
Logs outfit feedback for future personalization.

## Buy Check

### POST /api/buy-check
Analyzes an uploaded clothing/product image and returns a buy-or-skip decision using body model and style profile context.
