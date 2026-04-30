# Product Spec — AI Virtual Try-On & Outfit Decision Assistant

## 1. Goal

Build a pre-launch AI product MVP that helps users preview clothing on a personal digital fitting model and make better buy-or-skip decisions before purchasing.

The product focuses on one real shopping problem:

> Online shoppers cannot reliably tell how clothing will look on their own body before buying it.

## 2. Target Users

- Online shoppers who frequently buy clothing, shoes, or accessories
- Users who are unsure whether an item will fit their body or personal style
- Users who want to reduce returns, wasted money, and decision fatigue
- Users who want outfit advice based on real-life context such as travel, work, school, dates, or weather

## 3. Core User Flow

1. User creates a profile
2. User enters body measurements or uploads a full-body photo
3. System builds a personal digital fitting model
4. User uploads clothing items
5. User creates an outfit from uploaded items
6. User selects context such as weather, occasion, travel, or comfort priority
7. AI evaluates fit, style, occasion match, practicality, and repeat-use likelihood
8. System returns a buy-or-skip recommendation with explanation

## 4. MVP Features

### User Profile / Body Model
- Height, weight, body measurements
- Optional full-body photo input
- Basic body proportion summary
- Style preference notes

### Garment Upload
- Upload clothing image
- Add item type: top, pants, dress, shoes, accessory
- Add optional metadata: color, material, season, price, brand

### Outfit Composition
- Select multiple uploaded items
- Combine into one outfit
- Preview outfit structure

### Context Selection
- Occasion: school, work, date, travel, casual, formal
- Weather: hot, cold, rainy, windy
- Comfort priority: high / medium / low
- Stand-out preference: subtle / balanced / bold

### AI Outfit Analysis
- Fit risk
- Style match
- Occasion match
- Weather practicality
- Comfort prediction
- Wardrobe redundancy
- Repeat-use likelihood

### Recommendation Output
- Buy / Maybe / Skip
- Short explanation
- Key risks
- Styling suggestions
- Alternative use cases

## 5. Non-Goals for MVP

- Real payment processing
- Real e-commerce checkout
- Fully accurate 3D body simulation
- Production-grade body measurement extraction
- Real-time AR try-on

## 6. Success Criteria

The MVP is successful if a user can:

- Create a body/style profile
- Upload at least one clothing item
- Build an outfit
- Select a real-world context
- Receive a clear AI-generated recommendation
- Understand why the recommendation was made

## 7. Product Principle

The product should not make users feel judged. It should help users make confident, practical, and personalized shopping decisions.

AI should work with the user, not replace the user’s taste or judgment.
