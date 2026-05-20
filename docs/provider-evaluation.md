# Provider Evaluation: Virtual Try-On Candidates

**Project:** StyleSignal
**Branch:** issue-8-provider-evaluation
**Purpose:** Compare try-on provider candidates before integrating the next provider. This is a research document — no API is integrated here.

---

## Product Direction

StyleSignal must eventually support:

- Real user photos without studio-quality requirements
- Real product images without clean white backgrounds (on-model, hanger, flat-lay)
- Multi-garment and full outfit try-on (top + bottom + outerwear + shoes)
- A provider abstraction layer so the app is not locked to any single provider

IDM-VTON (already integrated) proved that a real provider-based try-on pipeline works end-to-end. Its limitations now define what the next provider must improve on.

---

## Provider Comparison Table

| Provider | API Available | Garment Support | Max Garments/Call | Real Product Images | Accessories | Price/Image (est.) | Commercial License | Status |
|---|---|---|---|---|---|---|---|---|
| replicate_idm_vton | Yes (Replicate) | top, dress, outerwear, bottom, shoes | **1** | Flat-lay best; on-model degrades | Not supported | ~$0.05–$0.10 | Unconfirmed | **Baseline (integrated)** |
| wavespeed_ai_virtual_outfit_tryon | Yes (REST, no cold start) | Flat list, no slot system | **Up to 8** (confirmed) | Yes | Unconfirmed | $0.12/image (Clothes Changer) | Unconfirmed — policy doc exists, terms not public | **Strong multi-garment candidate** |
| fashn_tryon_v1_6 | Yes (REST + fal.ai) | tops, bottoms, one-pieces (auto-detect) | **1** | Yes — on-model and flat-lay both accepted | Not supported | $0.075/image (1 credit) | Unconfirmed — check FASHN ToS | **Strong for real product images** |
| fashn_tryon_max | Yes (REST, **experimental**) | clothing, shoes, hats, jewelry, bags | **1** | Yes | Yes (shoes, hats, bags, jewelry) | $0.15–$0.375/image (2–5 credits) | Unconfirmed | Experimental — do not depend on stability |
| kling_kolors | Yes (fal.ai v1.5; direct API requires $2,000/mo min) | tops, bottoms, dresses, outerwear | **1 per call** | Yes (flat-lay best; on-model supported) | Misaligns (documented) | $0.07/run via fal.ai | Cleared (fal.ai); direct API requires contract | **Limited upper+lower, not true multi-garment** |
| huhu_ai | Yes (REST, SDKs available) | Single garment confirmed; multi-garment unknown | Unknown / needs testing | Yes — catalog images, on-model, hanger, mannequin | Claimed; needs testing | Credit bundles; ~$0.03–$0.12/image estimated | Commercial use explicitly stated | Productized candidate — needs testing |
| piapi_candidate | Unclear (API aggregator) | Unknown — concrete try-on schema not confirmed | Unknown | Unknown | Unknown | Unknown | Unknown | **Aggregator / research needed** |

---

## Detailed Capability Matrix

Transposed table — fields as rows, providers as columns. Use this for integration planning. "?" = unknown / needs testing.

| Field | replicate_idm_vton | wavespeed_ai | fashn_tryon_v1_6 | fashn_tryon_max | kling_kolors | huhu_ai | piapi_candidate |
|---|---|---|---|---|---|---|---|
| **Provider ID** | replicate_idm_vton | wavespeed_ai_virtual_outfit_tryon | fashn_tryon_v1_6 | fashn_tryon_max | kling_kolors | huhu_ai | piapi_candidate |
| **API available** | Yes | Yes | Yes | Yes | Yes (via fal.ai) | Yes | Unclear — aggregator platform |
| **Endpoint / model** | Replicate `cuuupid/idm-vton` v0513734a | `wavespeed-ai/ai-clothes-changer` | `fashn/tryon/v1.6` | `fashn/tryon/max` | Kling Kolors v1.5 via fal.ai | `api.huhu.ai/v1/try-on` | No confirmed try-on endpoint |
| **Input schema summary** | `{human_img, garm_img, category, crop, steps, seed}` | `{model_image, garment_images: []}` (flat list) | `{model_image, garment_image, category}` | `{model_image, product_image, prompt?, mode, resolution}` | `{human_image_url, garment_image_url}` | `{model_image, garment_image?, ...}` | ? — not confirmed |
| **Supports single garment** | Yes | Yes | Yes | Yes | Yes | Yes (confirmed) | ? |
| **Supports multi-garment** | No | Yes (up to 8 confirmed) | No | No | No | ? — not confirmed | ? |
| **Max garments/call** | 1 | Up to 8 | 1 | 1 | 1 | ? | ? |
| **Supports full outfit** | No | Likely (8 slots) — needs testing | No | No | No | ? — not confirmed | ? |
| **On-model garment image** | Degrades output | ? | Yes (segmentation_free) | Yes | Supported | Claimed | ? |
| **Flat-lay garment image** | Best input | Yes | Yes | Yes | Best input | Claimed | ? |
| **Real user photo** | Yes | Yes | Yes | Yes | Yes | Yes | ? |
| **Output type** | Image | Image (Clothes Changer) or Video (Outfit Try-On) | Image | Image | Image | Image | ? |
| **Requires public URL** | No (base64) | ? | No (fal.ai handles) | No (fal.ai handles) | Yes (image URL) | ? (URL per docs example) | ? |
| **Supports base64** | Yes | ? | Yes (via fal.ai) | Yes (via fal.ai) | No (URL only per fal.ai docs) | ? | ? |
| **Commercial license** | Unconfirmed | Unconfirmed — policy doc linked | Unconfirmed — check FASHN ToS | Unconfirmed | Cleared via fal.ai; $2K/mo min direct | Explicitly stated as commercial | Unconfirmed |
| **Price / credit** | ~$0.05–$0.10/run | $0.12/image (Clothes Changer); $0.039/sec (video) | $0.075/image (1 credit); tiers reduce to $0.049 | $0.15–$0.375/image (2–5 credits) | $0.07/run (fal.ai) | ~$0.03–$0.06/image at Pro tier | ? |
| **Processing time** | 30–90 s (Replicate queue) | ? | 5–17 s | Up to 120 s (quality + 4K) | ? | ~20–30 s | ? |
| **Known limitations** | Single garment; bag unsupported; on-model images degrade | Quality depends on photo clarity; commercial license unconfirmed | Single garment; no accessories; fixed 864×1296 resolution; PoseError | Single garment; experimental; slow at 4K | Single garment; accessories misalign; layering fails | Logo/color fidelity issues reported; multi-garment unconfirmed | Concrete try-on schema not identified |
| **Test status** | Integrated and tested | Not tested | Not tested | Not tested | Not tested | Not tested | Not tested |
| **Verdict** | Baseline — retain | Priority test candidate for multi-garment | Priority test candidate for real product images | Watch only — experimental | Low priority — single garment, accessories fail | Productized candidate — test before committing | Research needed — not ready for integration |

---

## Detailed Assessment

### 1. replicate_idm_vton — Baseline (Integrated)

**What it proved:** End-to-end provider pipeline works. Replicate token auth, prediction creation, async polling, and image output all function correctly in StyleSignal.

**Known limitations:**
- Single garment per request — fundamental model constraint, not a request parameter
- Bag slot unsupported; returns an error before calling the API
- Sensitive to input image quality — degraded results with busy backgrounds, poor lighting, or on-model product shots
- Incompatible with real-world shopping images (on-model product photos from retailer sites)

**Assessment:** Retain as baseline. Do not remove. Next provider selection should address these specific gaps.

---

### 2. wavespeed_ai_virtual_outfit_tryon — Strongest Multi-Garment Candidate

**API:** REST, public, pay-per-use, no cold starts. Accounts get $1 free credit to start.

**What makes it the multi-garment candidate:**
WaveSpeed is the only provider in this list with confirmed support for multiple garments in a single API call — up to 8 images submitted as a flat list. This maps directly to StyleSignal's goal of full outfit try-on (top + bottom + outerwear + shoes) without chaining sequential single-garment calls.

**Garment model:** Flat list — no slot system (no top/bottom/shoes categorization). This differs from IDM-VTON's category parameter. Integration would require a different input shape.

**Output options:**
- *AI Clothes Changer* — image output, $0.12/image
- *AI Virtual Outfit Try-On* — animated video output, $0.039/second (5–15 s clips)

For StyleSignal v1, the image output (Clothes Changer) is the relevant endpoint.

**Confirmed limitations:**
- Input quality matters — low-resolution or heavily filtered person photos degrade results
- No documented per-slot category system; garment ordering within the flat list may affect layering (unconfirmed)
- Complex layering (e.g., jacket over shirt) within one call: not explicitly documented (unconfirmed)
- Commercial licensing terms are not public — must verify before a production integration

**Unknowns (must test before integrating):**
- Whether garment order in the list affects render priority for overlapping items
- Exact behavior with shoes and bags as garment inputs (mentioned in marketing copy, not confirmed in API docs)
- Commercial license terms

**Recommended action:** Priority testing candidate for multi-garment use case. Integration design must account for the flat-list input instead of a slot/category system.

---

### 3. fashn_tryon_v1_6 — Strongest for Real Product and On-Model Garments

**API:** Stable REST API. Also available via fal.ai.

**What makes it strongest for real product images:**
FASHN v1.6 is designed to handle both flat-lay and on-model garment photos without requiring manual segmentation. The `segmentation_free` mode (default `true`) bypasses clothing extraction, which is the step that fails on on-model product shots in IDM-VTON. This makes it directly compatible with real-world product images from retailer sites.

**Garment categories:** Auto-detected from: `tops`, `bottoms`, `one-pieces`. Explicit `auto` option available.

**Pricing:** 1 credit per output image. $0.075/image at on-demand rate. Commitment tiers reduce cost to $0.049/image at Tier III.

**Key parameters:**
- `segmentation_free: true` (default) — recommended for catalog/on-model images
- `num_samples` 1–4 — each sample consumes 1 credit
- `performance` mode affects speed and quality

**Confirmed limitations:**
- Single garment per request
- No accessories: shoes, hats, bags, and jewelry are not supported categories
- Fixed output resolution: 864×1296 px (approx 1.1 MP)
- `PoseError` returned if body pose is undetectable in either the person or garment image
- Swimwear and lingerie are blocked by default (training data exclusion)

**Unknowns:**
- Commercial licensing terms (not in public docs — check FASHN ToS directly)

**Recommended action:** High priority for the garment-quality improvement use case. Integrate after confirming commercial licensing terms. Would replace IDM-VTON for single-garment calls using real product photos.

---

### 4. fashn_tryon_max — Broader Item Coverage, Experimental Status

**API:** Available, but marked **experimental lifecycle status**. Do not build a production dependency on this endpoint.

**What distinguishes it from v1.6:**
- Accepts a `prompt` parameter for styling instructions ("tuck in shirt", "roll up sleeves")
- Broader item coverage: clothing, shoes, hats, jewelry, bags — not just top/bottom/dress
- Higher output resolution options (1K, 2K, 4K)

**Pricing:** 2–5 credits per image ($0.15–$0.375 at on-demand rate). Significantly more expensive than v1.6.

**Confirmed limitations:**
- Single garment per request
- Experimental status — may change API shape or be deprecated
- Processing time: up to 120 seconds at quality + 4K
- Async polling required

**Recommended action:** Watch, do not integrate. Re-evaluate when experimental status is removed. The prompt-based styling instruction feature has potential but the endpoint is not stable enough to depend on.

---

### 5. kling_kolors — Upper + Lower, Not True Multi-Garment

**Important distinction:** Kling accepts one garment image per API call. The appearance of "multi-garment" in some consumer-facing guides (e.g., magichour.ai) refers to sequential calls or consumer-layer stitching — not native API multi-slot support. Do not treat Kling as a multi-garment provider at the API level.

**Access options:**
- *fal.ai*: $0.07/run, commercial-grade, no minimum commitment. Practical entry point.
- *Direct Kling API*: $0.05–$0.07/run within a minimum $2,000/month package. Not practical at this project stage.

**Confirmed limitations:**
- Single garment per API call (fal.ai and direct API confirmed)
- Accessories (belts, hats, jewelry) misalign — documented by the Kling team
- "Struggles with garment type switching (e.g. swapping a skirt for pants)" — documented model limitation
- Complex layering does not render accurately (documented)
- Direct commercial API has ~80% reported failure rate from "risk control system" errors on some normal images (community report — not confirmed in official docs)

**Recommended action:** Low priority. Single-garment only at the API level, accessories fail, and the fal.ai path is the only cost-practical access point. Revisit if Kling releases a documented multi-slot endpoint.

---

### 6. huhu_ai — Productized Candidate, Multi-Garment Unconfirmed

**API:** REST API at `api.huhu.ai/v1/try-on`. SDKs for Python, Node.js, PHP, Ruby. Webhook support for async delivery. Claimed 99.9% uptime SLA (unverified).

**What the current docs confirm:**
- Single garment per request is supported (confirmed from the documented API example)
- Accepts on-model, flat-lay, hanger, mannequin, ghost mannequin, and 3D renders as garment image formats
- The platform markets multi-piece outfit support, but the API schema showing multiple garment image inputs has not been confirmed in publicly available documentation
- Accessory and jewelry support is claimed in marketing copy; not confirmed from a documented API parameter

**What is unknown / needs testing:**
- Whether the API accepts more than one garment image in a single request
- The exact input schema for multi-piece requests (if supported)
- Maximum garment count per call
- Whether accessories and jewelry are actual API input categories or only a product-layer feature

**Pricing:** Subscription-based with credit packs. SD quality: 1 credit/image. HD: 2 credits/image.
- Basic: ~$15/month (250 credits)
- Pro: ~$30/month (600 credits)
- Elite: ~$80/month

Estimated per-image rate: $0.03–$0.06 at Pro tier.

**Commercial use:** Explicitly stated in ToS — generated images may be used commercially.

**Confirmed limitations:**
- Logo fidelity: color shifts and resizing reported by users
- HD try-on availability unclear — was listed as "upcoming" as of mid-2025
- Processing time: ~20–30 seconds per image

**Recommended action:** Productized candidate worth testing. Commercial terms are clear. Do not assume multi-garment or full outfit support until the API input schema is confirmed. Test with a single-garment call first, then investigate whether a multi-garment schema exists in the full API docs or on request from the vendor.

---

### 7. piapi_candidate — API Aggregator, Research Needed

**What PiAPI is:** PiAPI is an API aggregation platform that provides unified access to multiple AI model providers (Kling, Midjourney, Suno, etc.) under a single API key and billing account. It is not a try-on model provider itself.

**Current research status:** Our research identified that PiAPI offers access to Kling-based virtual try-on via a `task_type: "ai_try_on"` + `model: "kling"` endpoint. However, a concrete, confirmed try-on API schema specific to PiAPI — beyond the Kling passthrough — has not been identified in our current research. It is not confirmed whether PiAPI exposes additional try-on providers, model variants, or its own try-on product separate from Kling.

**What this means for integration planning:** PiAPI as a Kling wrapper does not resolve the core Kling limitation (single garment per API call). If a different underlying model is available through PiAPI that supports multi-garment try-on, that would change the assessment — but this has not been confirmed.

**Do not treat PiAPI as a confirmed integration candidate** until a specific non-Kling try-on model schema is identified on the platform.

**Recommended action:** Research needed. Check PiAPI's current model catalog for any try-on endpoints beyond Kling. If only Kling is available, evaluate via fal.ai directly (same model, simpler access, same price).

---

## Next Steps — Recommended Integration Priority

| Priority | Provider | Reason |
|---|---|---|
| **1** | fashn_tryon_v1_6 | Fixes the real-product-image problem. Stable API, clear pricing, single-garment to match current UI flow. Verify commercial license first. |
| **2** | wavespeed_ai (Clothes Changer) | First true multi-garment candidate. Unlocks full outfit try-on. Requires input-shape redesign (flat list vs. slot system). Verify commercial license first. |
| **3** | huhu_ai | Productized candidate, clear commercial terms. Confirm API input schema for multi-garment before claiming that capability. Test logo fidelity. |
| **4** | kling_kolors (fal.ai) | Single-garment, accessories fail. Low priority unless Kling releases a multi-slot endpoint. |
| **5** | fashn_tryon_max | Watch only. Re-evaluate when experimental status is removed. |
| **6** | piapi_candidate | Research needed. Confirm whether a non-Kling try-on model schema exists on the platform. |

---

## Product Decision Notes

**Avoid single-provider lock-in.** The `TryOnProvider` abstraction (implemented in Issue #7) makes it possible to swap or add providers without rewriting the generation flow. All future integrations should implement `TryOnProvider` and register via `TryOnProviderRegistry`.

**IDM-VTON stays as baseline.** Removing it would break the currently working generation path. New providers are additions, not replacements, until a new provider is confirmed stable.

**Distinguish Kling's "upper + lower" from true multi-garment.** Kling via PiAPI can accept upper and lower garment images, but the underlying model still applies them as a single composite — it is not the same as a system that independently renders each garment layer. Do not present this as full outfit try-on.

**Full outfit try-on requires a provider that supports it natively.** WaveSpeed (up to 8 garments per call) is currently the only candidate with this capability confirmed at the API level. Integration should only be presented to users as "full outfit" when a multi-garment provider is active — enforced via `TryOnCapability.maxGarments > 1` in the capability matrix.

**Unknown capabilities must not be presented as confirmed.** Any in-app feature gating (e.g., "Multi-garment supported") must only appear when the active provider's `TryOnCapability.maxGarments > 1` — driven by the capability matrix, not assumed.

**Multi-garment claims require confirmed API schema.** A provider that markets multi-piece support must have a documented input schema with multiple garment image parameters before StyleSignal treats it as a multi-garment provider. Marketing copy alone is not sufficient.

---

## Open Questions Before Next Integration

1. **FASHN v1.6 commercial license** — is API output cleared for commercial use in a consumer product?
2. **WaveSpeed commercial license** — same question; their policy doc is referenced but not reproduced publicly
3. **WaveSpeed garment ordering** — does list order affect which garment renders "on top" for overlapping items?
4. **HuHu AI input schema** — does the API accept multiple garment images in one call, and if so, what is the parameter structure?
5. **HuHu AI HD status** — is HD try-on (`HD` model tier) now available, and what is the per-image credit cost?
6. **PiAPI try-on catalog** — does PiAPI expose any try-on model other than Kling? If not, evaluate Kling via fal.ai directly.
