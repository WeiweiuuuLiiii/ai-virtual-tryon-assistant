# Architecture — AI Virtual Try-On & Outfit Decision Assistant

## System Overview

The product is organized around a modular workflow:

User Input → Profile Model → Garment Intake → Outfit Composition → Context Engine → Outfit Evaluator → Recommendation Layer → Feedback Loop

## 1. Profile Model

Stores user-related information used for personalization.

### Inputs
- Body measurements
- Full-body photo
- Style preferences
- Comfort preferences
- Occasion preferences

### Outputs
- User profile object
- Body proportion summary
- Style preference summary

## 2. Garment Intake

Handles clothing item uploads and metadata.

### Inputs
- Clothing image
- Item category
- Color
- Material
- Brand / price
- Season or usage context

### Outputs
- Garment object
- Item metadata
- Visual description
- Potential styling notes

## 3. Try-On Planner

Plans how clothing items should be composed into an outfit.

### Responsibilities
- Match item types to outfit slots
- Detect missing outfit pieces
- Check whether selected items form a complete outfit
- Prepare structured input for evaluation

## 4. Context Engine

Adds real-world context to the outfit decision.

### Context Examples
- Weather
- Travel
- Work
- School
- Date night
- Formal event
- Walking-heavy day
- Comfort priority

## 5. Outfit Evaluator

Evaluates whether the outfit works for the user and context.

### Evaluation Dimensions
- Fit risk
- Style consistency
- Occasion match
- Weather practicality
- Comfort level
- Wardrobe redundancy
- Repeat-use likelihood

## 6. Recommendation Layer

Turns evaluation into a user-facing decision.

### Outputs
- Buy / Maybe / Skip
- Main reason
- Key risk
- Styling suggestions
- Better context for the item
- Alternative recommendation

## 7. Feedback Loop

Captures user feedback to improve future recommendations.

### Feedback Examples
- Bought / skipped item
- Wore it or not
- Comfort rating
- Confidence rating
- Notes after real use

## AI-Agent Engineering Workflow

Claude Code is used as an engineering partner to:

1. Summarize current architecture
2. Identify component relationships
3. Propose feature boundaries
4. Draft implementation scaffolding
5. Suggest test cases
6. Help validate edge cases

Human review is still responsible for:
- Product judgment
- Final architecture decisions
- Code review
- Testing
- Privacy and user trust decisions
