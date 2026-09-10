# ComfyUI Quality & Prompting Reference (craft layer, Sept 2026)

Compiled from web research in September 2026. Every claim below is sourced inline.
Where sources disagreed or a claim came from a secondary/aggregator site rather than
an official spec, it is marked **[unverified]** or **[secondary source]** — treat those
as a starting point to test, not gospel. Official primary sources used: `docs.comfy.org`
(ComfyUI's own docs site), `comfy.org` (template gallery), model cards on GitHub/HF,
and Civitai articles. `comfyui.dev` is **not** the official Comfy-Org docs domain (that's
`docs.comfy.org`) — it's a well-organized third-party mirror/guide site; its content is
used here but flagged as secondary source since it could not be cross-checked against
an authoritative spec for every claim.

## Table of contents

1. [Prompting per model family](#1-prompting-per-model-family)
2. [Sampler/scheduler behaviour](#2-samplerscheduler-behaviour)
3. [CFG and guidance tuning](#3-cfg-and-guidance-tuning)
4. [The quality pipeline](#4-the-quality-pipeline)
5. [Diagnosing bad output](#5-diagnosing-bad-output)
6. [Reproducibility and iteration discipline](#6-reproducibility-and-iteration-discipline)

---

## 1. Prompting per model family

The single biggest craft-layer fork in ComfyUI today is **which text encoder conditions
the model**, because that decides whether the model reads *tokens* or *sentences*.

- **CLIP-only models (SD1.5, SDXL, Pony/Illustrious-style SDXL finetunes)** — conditioned
  purely by CLIP-L (SD1.5) or CLIP-L + OpenCLIP-G (SDXL). CLIP was trained on noisy
  alt-text and caption fragments, so it responds best to **comma-separated tag/keyword
  lists**, not full grammatical sentences. ([aiofm.info](https://aiofm.info/en/guides/what-is-clip-vs-t5-encoder), [Civitai](https://civitai.com/articles/11432/ultimate-guide-to-creating-realistic-sdxl-prompts))
- **T5/LLM-conditioned models (Flux, SD3.5, Qwen-Image)** — add a large language-style
  encoder (T5-XXL for Flux/SD3.5; Qwen's own multimodal LLM encoder for Qwen-Image) that
  actually parses grammar, clauses, and spatial relationships. These models want **natural
  language paragraphs**, and comma-tag-dumping actively hurts them because the encoder has
  no idea what to do with an ungrammatical fragment list. ([aiofm.info](https://aiofm.info/en/guides/flux-prompting-guide))

### 1.1 SDXL / CLIP-based prompting

- Structure: `subject, key descriptors, medium/style, lighting, composition, quality tags`,
  comma-separated. Tag order matters — CLIP weights earlier tokens somewhat more heavily,
  so lead with subject and the things you most need to land.
- **Emphasis syntax**: `(word:1.2)` is the explicit, predictable form. Shorthand exists too:
  `(word)` ≈ ×1.1, `((word))` ≈ ×1.21 (compounding), `[word]` ≈ ×0.91 (de-emphasis). Keep
  weights in the **1.1–1.3 range** as a safe ceiling — SDXL distorts faster than SD1.5 at
  high weights, and weighting choices interact with sampler/CFG, so lock those first.
  ([Civitai](https://civitai.com/articles/11432/ultimate-guide-to-creating-realistic-sdxl-prompts))
- **Negative prompts matter a lot** for SDXL/CLIP models — CFG has a genuine unconditional
  branch to push away from. Keep it short and targeted rather than a giant boilerplate
  block: e.g. `low quality, blurry, distorted, extra limbs, watermark, text, deformed hands`
  is enough for most checkpoints; long negative walls have diminishing/negative returns.
  ([Civitai](https://civitai.com/articles/11432/ultimate-guide-to-creating-realistic-sdxl-prompts))
- **Clip skip**: some SDXL finetunes have a hard requirement here — e.g. Pony Diffusion V6 XL
  needs `CLIPSetLastLayer` = clip skip 2, an explicitly wired external `sdxl_vae.safetensors`,
  and score tags (`score_9, score_8_up...`) at the very start of the positive prompt. Clip
  skip is a per-checkpoint contract, not a universal quality knob — check the model card.
  ([Civitai](https://civitai.com/articles/11432/ultimate-guide-to-creating-realistic-sdxl-prompts))
- **Example — SDXL/tag style**, subject "woman reading in a window seat":
  ```
  1girl, reading book, window seat, sunlight, cozy sweater, warm afternoon light,
  soft shadows, shallow depth of field, photorealistic, (detailed skin texture:1.15),
  85mm lens, bokeh, cinematic color grading
  Negative: low quality, blurry, extra fingers, deformed hands, watermark, text, cartoon
  ```

### 1.2 Flux / T5-conditioned prompting

- Flux (dev/schnell) actually has **two encoders wired to two different node inputs**:
  CLIP-L and T5-XXL. `CLIPTextEncodeFlux` exposes both — feed CLIP-L a short tag-style
  style descriptor (e.g. `"illustration style, cinematic"`), and feed T5-XXL a full
  natural-language sentence describing the scene. Comma-tag-dumps in the T5 slot and
  full sentences in the CLIP-L slot **both fail** — each encoder wants its own register.
  ([GitHub discussion](https://github.com/lllyasviel/stable-diffusion-webui-forge/discussions/1182), [ComfyUI Wiki](https://comfyui-wiki.com/en/comfyui-nodes/advanced/conditioning/flux/clip-text-encode-flux))
- T5-XXL has a 512-token limit and reads grammar/paragraphs; CLIP-L caps at 77 tokens
  and reads keyword-style fragments. Practical daily-workflow prompt length: **30–80
  words** for the T5 side. ([aiofm.info](https://aiofm.info/en/guides/flux-prompting-guide))
- **No screaming-parens weighting.** Flux doesn't respond to `(((word)))`-style emphasis
  the way SDXL does — "weight" instead comes from **word order, specificity, and
  structural positioning** in the sentence (put the important thing first, describe it
  precisely instead of repeating/emphasizing it). ([aiofm.info](https://aiofm.info/en/guides/flux-prompting-guide))
- **Negatives are structurally weak-to-absent** on distilled Flux — see §3 for why (guidance
  distillation bakes CFG behavior into the model, so there's no real unconditional branch
  to push against without extra nodes). ([Medium](https://medium.com/towards-agi/how-to-write-negative-prompts-in-flux-e4305c9e7333), [HF discussion](https://huggingface.co/ostris/OpenFLUX.1/discussions/7))
- **Example — Flux/natural-language style**, same subject:
  ```
  T5 (natural language): A young woman sits curled in a sunlit window seat, reading
  a paperback book. She wears a soft oversized sweater. Warm afternoon light streams
  in at a low angle, casting long soft shadows across the room. Shot on an 85mm lens
  with shallow depth of field and gentle bokeh in the background.
  CLIP-L (tags): photorealistic, cinematic lighting, warm color grading
  ```

### 1.3 SD3.5 prompting

- SD3.5 also saturates at **lower CFG** than SD1.5/SDXL — the model default is CFG ≈ 5,
  and pushing above ~8 tends to produce harsh, unnatural results quickly because the
  model already follows prompts strongly. ([aiphotogenerator.net](https://www.aiphotogenerator.net/blog/2026/02/what-is-cfg-scale-stable-diffusion))
- SD3.5 was **not originally trained with negative prompts**; they still work but act more
  as a refinement/steering tool (removing an element, nudging color/style) than a
  necessity — for complex scenes, dropping the negative prompt entirely sometimes helps.
  ([aiphotogenerator.net](https://www.aiphotogenerator.net/blog/2026/02/negative-prompts-stable-diffusion-guide))
- ComfyUI weighting for SD3.5 prompts: prefer explicit `(keyword:1.4)` over stacked
  parentheses — more predictable, same reasoning as SDXL. **[secondary source]**

### 1.4 Qwen-Image prompting (and text rendering)

Qwen-Image (20B MMDiT, Apache 2.0) is the strongest current open model for **legible,
correctly-spelled in-image text**, trained with a progressive strategy that scales from
no-text to full paragraph-level text rendering. ([QwenLM/Qwen-Image GitHub](https://github.com/QwenLM/Qwen-Image), [dreampixelforge.com](https://www.dreampixelforge.com/blog/qwen-image-prompts))

- **Core rule: Qwen reads sentences, not keyword piles.** Give it exact quoted strings and
  tell it *where* each one sits in the frame; a comma-separated adjective pile gets you a
  generic image with garbled lettering. ([dreampixelforge.com](https://www.dreampixelforge.com/blog/qwen-image-prompts))
- **Five-part prompt structure that works well for text-bearing images:**
  1. Artifact type first (e.g. "A letterpress event poster...") — highest-value token
  2. Scene/subject in complete sentences
  3. Every text string **quoted verbatim** and anchored to a position ("in the upper
     third", "beneath the header", "on the front of the can")
  4. Typography + color spec per string (typeface family, weight, color)
  5. Camera, lighting, and finish details last
  ([dreampixelforge.com](https://www.dreampixelforge.com/blog/qwen-image-prompts))
- **Example — poster with exact text**:
  ```
  A vintage letterpress event poster printed on textured cream stock, shot flat and
  square to the camera. Across the upper third, the words "NIGHT MARKET" appear in
  large condensed sans-serif capitals in deep red. Below it, smaller serif text reads
  "Saturday, 7PM — Riverside Docks". Subtle paper grain, warm off-white background,
  even studio lighting, no shadows.
  ```
- **Example — bilingual signage**:
  ```
  A hand-lettered chalkboard menu board mounted on a whitewashed brick wall in a small
  cafe. The header reads "TODAY'S POUR" in chalk capitals, with "今日推荐" directly
  beneath it in slightly smaller Chinese characters. Warm tungsten light from the left.
  ```
- **Settings**: guidance scale **5–7** for production work; push to **35+ steps**
  specifically when rendering text (fewer steps = more garbled letterforms).
  ([localaimaster.com](https://localaimaster.com/models/qwen-image-local-guide), [dreampixelforge.com](https://www.dreampixelforge.com/blog/qwen-image-prompts))
- **Distilled/fast variants**: the ComfyUI-native distilled Qwen-Image checkpoint runs
  well at **15 steps / CFG 1.0**, and reportedly still holds up at 10 steps/CFG 1.0;
  sampler choice is **euler** or **res_multistep** depending on desired look; an 8-step
  Lightning LoRA variant exists for fast iteration. ([docs.comfy.org tutorial](https://docs.comfy.org/tutorials/image/qwen/qwen-image))
- Supports English, Chinese, Korean, Japanese, Italian and more for in-image text.
  ([docs.comfy.org](https://docs.comfy.org/tutorials/image/qwen/qwen-image), [GitHub](https://github.com/QwenLM/Qwen-Image))

---

## 2. Sampler/scheduler behaviour

**Caveat on sourcing**: the clearest side-by-side sampler/scheduler writeups found were on
`comfyui.dev` (secondary/community docs site, not `docs.comfy.org`). Treat specific
adjective-level claims ("dreamlike", "unstable") as informal community consensus, not
benchmarked fact — but they're broadly consistent with what Civitai/Reddit-style guides
say elsewhere, so they're a reasonable working default.

### 2.1 Samplers

| Sampler | Character | Determinism | Speed | Notes |
|---|---|---|---|---|
| `euler` | Fast, sharp, deterministic | Fully deterministic given seed | Fast | Good default/preview sampler; can look harsh/noisy at high step counts |
| `euler_ancestral` | Softer, more textured/artistic, injects noise every step | **Non-deterministic** — never fully converges | Fast | Popular for portraits for its "polished, soft" look; re-running same seed gives a *different* image each time because ancestral noise isn't reseeded identically |
| `dpmpp_2m` | Balanced realism + speed, midpoint-aware | Deterministic | Moderate | Long-standing "industry standard" default for SDXL-family models at 20–30 steps |
| `dpmpp_2m_sde` | Stronger shading/depth, realism-leaning | Non-deterministic (SDE noise) | Moderate–slow | |
| `dpmpp_3m_sde` | Highest fidelity / most complex detail of the DPM++ family | Non-deterministic | Slow, VRAM-hungry (`_gpu` variant can eat 12GB+) | Reserve for final/hero renders, not iteration |
| `dpmpp_sde` | Clean gradients and smooth transitions, edge for fine detail/structure | Non-deterministic | Slower, higher VRAM | "DPM++ SDE Karras, 30–40 steps" cited as a max-quality combo |
| `ddim` | Fast, decent quality, historically the reference deterministic sampler | Fully deterministic | Fast | Good baseline; DDIM-Uniform scheduler pairing noticeably changes output vs. other schedulers |
| `res_multistep` | Stylized/dreamlike, restart-based | Reported unstable | Slow | Niche, surreal/artistic use; also listed as a valid Qwen-Image sampler choice |
| `gradient_estimation` | Extreme edge-case precision tool | — | Very slow | Community consensus: "not recommended for casual generation" — 30 min for output comparable to what other samplers do in seconds |
| `lcm` | Ultra-fast, requires LCM-distilled checkpoint/LoRA | Deterministic-ish at very low steps | Extremely fast | Only meaningful at 4–8 steps with an LCM-tuned model; mismatched with normal checkpoints |
| `uni_pc` | Modern, stable, high-detail | Deterministic | Moderate | Solid "polished workflow" default alongside dpmpp_2m |
| `er_sde` (Seedream/ER-SDE family) | Stochastic, "balanced realism", smoother than SDE variants | Non-deterministic | Slower | **[unverified]** — thin evidence found; treat as experimental/new, verify against current ComfyUI sampler list before relying on it |

Sources: [comfyui.dev sampler-name-options](https://comfyui.dev/docs/guides/Other%20Resources/sampler-name-options/) (secondary source), [MyAIForce Z-Image sampler guide](https://myaiforce.com/z-image-samplers-schedulers/), [Apatero sampler guide 2025](https://apatero.com/blog/comfyui-sampler-selection-guide-2025).

### 2.2 Schedulers

| Scheduler | Noise curve | Best paired samplers (per secondary sources) | Best for |
|---|---|---|---|
| `normal` | Linear, equal weight across timesteps | euler, heun, ddpm | Baseline/quick iteration |
| `karras` | Concentrates steps in the high-noise (low-SNR) region, sharpens late-stage detail | dpmpp_2m, dpmpp_sde, dpmpp_2s_ancestral | The long-time SDXL default — "still the right call for SDXL" |
| `exponential` | Rapid early denoise, diminishing returns later | euler_ancestral, heunpp2, dpm_adaptive | Stylized/anime/abstract looks. **Flow-matching models (Flux, Z-Image and relatives) reportedly fail with karras/exponential** — use scheduler families designed for flow-matching instead (e.g. the model's native/simple scheduler) |
| `sgm_uniform` | Uniform SDE-consistent spread | dpmpp_sde, heun, ddpm | SGM-based models; variance-consistency workflows |
| `simple` | Flat, "no intelligence applied" | dpm_fast, ddpm, euler | Debugging / not a real quality choice |
| `ddim_uniform` | Uniform timesteps, tuned for deterministic sampling | ddpm, dpm_adaptive | Low-step, reproducible fast generation |
| `beta` | Beta-distribution curve, tight variance control, smooth transitions | dpmpp_2m_cfg_pp, heun, dpmpp_sde_gpu | Portraits, soft/vintage aesthetics, background-heavy compositions |
| `linear_quadratic` | Linear-to-quadratic progression | euler_cfg, heunpp2, dpmpp_2s_ancestral_cfg_pp | Atmospheric/cinematic landscapes; also cited as good for SDXL with dpmpp_3m_sde |
| `kl_optimal` | KL-divergence-optimized noise path | dpmpp_sde, dpmpp_sde_gpu, dpmpp_2m | Precision/benchmarking use; also cited for uni_pc + SDXL |

**Known-bad combinations** (per secondary-source compatibility notes):
- `lcm` + `exponential` / `kl_optimal` / `linear_quadratic` — LCM wants speed, these
  schedulers add complexity LCM's few steps can't use.
- `uni_pc` + `simple` / `ddim_uniform` — produces flat, lifeless output.
- `dpmpp_sde_gpu` + high-noise-oriented schedulers (`exponential`, `ddim_uniform`) — mismatch.
- Karras/exponential schedulers on Flux/flow-matching models — reported to "genuinely
  fail" on those architectures; use the scheduler ComfyUI's official Flux template ships
  with rather than porting an SDXL scheduler choice over.

Sources: [comfyui.dev scheduler-options](https://comfyui.dev/docs/guides/Other%20Resources/scheduler-options/) (secondary source), [comfyui.dev compatibility matrix](https://comfyui.dev/docs/guides/Other%20Resources/sampler-and-scheduler-compatibility-matrix/) (secondary source), [docs.comfy.org BasicScheduler](https://docs.comfy.org/built-in-nodes/BasicScheduler).

### 2.3 Ancestral/SDE samplers and seed reproducibility — the practical effect

Ancestral (`_ancestral`, `_a`) and SDE (`_sde`) samplers **inject fresh random noise at
every step**, so they never fully converge to one deterministic output the way `euler`,
`dpmpp_2m`, `ddim`, or `uni_pc` do. Practically:
- Same seed + same everything-else on `euler_ancestral` or `dpmpp_sde` can still produce
  a visibly different image between runs (implementation/backend-dependent extra RNG draws).
- For an honest **XY-plot/grid sweep comparing samplers**, keep seed, latent, and
  conditioning fixed — differences you see are then real sampler differences, but note
  that ancestral/SDE cells are inherently noisier comparisons than converging-sampler cells.
- Prefer `euler`, `dpmpp_2m`, `ddim`, or `uni_pc` when you need a specific result to be
  **reproducible** (client delivery, seed-locking a hero shot); use ancestral/SDE samplers
  when you're exploring variations and want organic diversity from a single seed.

([Medium — ComfyUI Generation Parameters](https://medium.com/@studio.angry.shark/comfyui-generation-parameters-from-random-chaos-to-reproducible-results-51e4ba95bd06))

---

## 3. CFG and guidance tuning

### 3.1 CFG ranges per family

| Family | Typical CFG / guidance | Notes |
|---|---|---|
| SD1.5 | 6–9 | Classic CFG range |
| SDXL | 5–8 | Karras + dpmpp_2m is the safe default; pushing much past 8 risks saturation |
| SD3.5 | ~5 default, avoid >8 | Model follows prompts strongly already; high CFG turns harsh fast ([aiphotogenerator.net](https://www.aiphotogenerator.net/blog/2026/02/what-is-cfg-scale-stable-diffusion)) |
| Flux (dev/schnell) | CFG fixed near 1.0 at the sampler; **guidance** (distilled) 1.0–4.0, default 3.5 | See §3.2 — this is *not* the same knob as classic CFG |
| Qwen-Image (distilled) | CFG 1.0, guidance 5–7 for the base model | Distilled checkpoint prefers CFG 1.0; non-distilled base wants guidance 5–7 ([docs.comfy.org](https://docs.comfy.org/tutorials/image/qwen/qwen-image), [localaimaster.com](https://localaimaster.com/models/qwen-image-local-guide)) |

FluxGuidance node range is 0.0–100.0 with **default 3.5**; practical sweet spot is far
narrower than the slider suggests — short prompts can tolerate/want guidance ≈4, longer
or more creative prompts often look better at 1.0–1.5; values above ~20 can break the
model or produce overfitting-style artifacts. Sweep in 0.5 steps to find the point for a
given prompt/model combo. ([runcomfy FluxGuidance](https://www.runcomfy.com/comfyui-nodes/ComfyUI/flux-guidance), [prompt-architects.com](https://prompt-architects.com/blog/344-flux-guidance-scale-explained))

### 3.2 Distilled guidance vs. true CFG

Flux Dev/Schnell are **guidance-distilled**: the model was trained to bake "what CFG=X
would have produced" directly into its weights via a `FluxGuidance` conditioning value,
so there is no real unconditional-branch CFG happening at sample time, and — critically
— **classic negative prompting doesn't work** on distilled Flux out of the box, because
there's no unconditional prediction to steer away from. ([Medium](https://medium.com/towards-agi/how-to-write-negative-prompts-in-flux-e4305c9e7333), [HF discussion](https://huggingface.co/ostris/OpenFLUX.1/discussions/7))

Community workarounds to get negative-prompt-like control on Flux:
- **Dynamic Thresholding** (`sd-dynamic-thresholding` extension → `DynamicThresholdingFull`
  node): rescales/clamps latent values so a genuine CFG + negative-prompt path can be
  reintroduced without the oversaturation/collapse that naive high-CFG-on-Flux causes.
  ([Medium](https://medium.com/towards-agi/how-to-write-negative-prompts-in-flux-e4305c9e7333))
- **Perturbed Attention Guidance (PAG)**: perturbs the model's self-attention instead of
  needing an unconditional pass at all — an alternative guidance signal that doesn't
  depend on CFG's dual-pass structure. **[secondary source, worth testing]**
- **PerpNeg-style nodes**: project the negative-prompt direction perpendicular to the
  positive direction before subtracting, avoiding the negative prompt fighting/cancelling
  parts of the positive prompt it shouldn't touch. Most commonly seen on multi-concept or
  multi-ControlNet setups where a naive negative prompt suppresses wanted detail.
  **[secondary source]** — verify against the specific PerpNeg node's docs before use.

### 3.3 CFG-fix nodes for SDXL/SD1.5-family (v-prediction / high-CFG artifacts)

- **RescaleCFG**: lets you run a *high* CFG for stronger prompt adherence while rescaling
  the result back to a healthy magnitude — default `multiplier` 0.7 sets how much
  rescaling is applied. Built specifically for **v-prediction models** and the classic
  "CFG 7–8 hits an oversaturation wall" SDXL problem — the standard CFG formula inflates
  prediction magnitude past a healthy point, and RescaleCFG compensates.
  ([instasd.com](https://www.instasd.com/comfyui/custom-nodes/comfyui/rescalecfg), [comfyui-wiki](https://comfyui-wiki.com/en/comfyui-nodes/advanced/model/rescale-cfg))
- **AutomaticCFG** (`ComfyUI-AutomaticCFG`): dynamically rescales CFG at every step to
  prevent burning/artifacting while claiming a ~30% speed increase; recommended usage is
  to just set CFG at 8 and let the node manage it, or use it to get improved sensitivity
  even at lower CFG like 4. ([GitHub](https://github.com/Extraltodeus/ComfyUI-AutomaticCFG))
- **CFGNorm**: normalizes the denoised prediction by comparing conditional vs. unconditional
  norms, then applies a strength multiplier — marked **experimental** in ComfyUI's own
  built-in node docs. ([docs.comfy.org/built-in-nodes/CFGNorm](https://docs.comfy.org/built-in-nodes/CFGNorm))

### 3.4 Symptoms

| Symptom | Likely cause | Fix |
|---|---|---|
| Burned/oversaturated colors, crunchy contrast, "baked-in" look | CFG too high for the model (SDXL/SD1.5 pushed past ~8–9) | Lower CFG, or keep CFG high and add RescaleCFG / AutomaticCFG |
| Prompt ignored, image looks generic/mushy, low adherence | CFG too low, or (Flux/Qwen) guidance value too low for prompt complexity | Raise CFG/guidance in 0.5 steps; for Flux try 3.5–4 on short prompts |
| Flux/Qwen output ignoring a "don't include X" instruction | These models have weak-to-no true negative-prompt mechanism | Rephrase as a positive instruction ("clean background" instead of "no clutter"), or add Dynamic Thresholding / PAG for a real negative path |

---

## 4. The quality pipeline

The sequence experts actually run, roughly in order of "how much it costs vs. how much
signal it adds":

1. **Base generation resolution** — generate near the model's native training resolution
   (SDXL: 1024×1024 or matching-area non-square buckets; Flux/Qwen: similar ~1MP native
   range) rather than forcing a huge resolution directly — high-res-direct is the classic
   cause of duplicated subjects (see §5). Two-pass upscaling from a correct-resolution
   base is cheaper and more reliable than one huge pass.
   ([techtactician.com hires-fix guide](https://techtactician.com/comfyui-hires-fix-latent-upscaling-guide/))

2. **Hi-res fix / two-pass**: generate at base resolution, then re-encode and re-sample
   at a higher resolution.
   - **Latent-space upscale, second pass**: upscale latent ×1.5, denoise **≈0.5–0.7**
     for the second KSampler pass (higher end if you want the model to invent real new
     detail at the new resolution; lower end to stay closer to the first pass).
   - **Pixel-space upscale, second pass**: decode → traditional 2× upscale → re-encode →
     denoise **≈0.25–0.55**. A conservative denoise of 0.25–0.5 is enough when the pixel
     upscale is already reasonably clean; push toward 0.55 only if the upscale looks soft.
   - **Model-based pixel upscaler** (ESRGAN-style) then downscale slightly and re-encode:
     needs the *least* denoise on the follow-up pass (≈0.25) since the upscaler already
     did the heavy lifting.
   ([cubiq/ComfyUI_Workflows upscale README](https://github.com/cubiq/ComfyUI_Workflows/blob/main/upscale/README.md), [eastondev.com](https://eastondev.com/blog/en/posts/ai/20260722-comfyui-upscale-inpaint-guide/))

3. **Tiled upscale (Ultimate SD Upscale / Tile ControlNet)** — for resolutions too large
   to run as one full-image second pass (VRAM-bound). Ultimate SD Upscale slices the
   image into tiles and runs img2img per tile, then stitches. With a **Tile ControlNet**
   feeding the original image back in at strength ~1.0, denoise **≈0.75** is cited as a
   reasonable fidelity/sharpening compromise; without ControlNet guidance, keep tile
   denoise lower (~0.3–0.5) to avoid visible tile seams (see §5).
   ([cubiq/ComfyUI_Workflows](https://github.com/cubiq/ComfyUI_Workflows/blob/main/upscale/README.md))

4. **Face/hand detailing** — after the main upscale, segment the face/hands (e.g.
   SegmentAnythingUltra-style node or a dedicated FaceDetailer/ADetailer-equivalent),
   crop-and-upscale that region to ≥1024px, run a targeted inpaint/KSampler pass on just
   that crop, then composite back. This is why hands and faces look sharp in expert
   output even when the base pass rendered them poorly at low resolution — the model
   never had enough pixels to work with on a single global pass.
   ([comfyui.org hand-repair workflow](https://comfyui.org/en/ai-powered-hand-repair-workflow))

5. **Detail LoRAs vs. Detail Daemon (sigma trick)** — two different ways to add
   "detail" and they behave differently:
   - **Detail LoRA**: a trained weight delta, adds a specific *style* of detail (skin
     pores, fabric weave, etc.) — behaves like any other LoRA (see §5 for overpowering).
   - **Detail Daemon** (`ComfyUI-Detail-Daemon`): doesn't add anything trained — it
     adjusts the **sigma schedule itself**, lowering how much noise gets removed at each
     step so the sampler naturally preserves more fine structure. Key params:
     `detail_amount` (SDXL: keep **<0.25**; Flux: can go **0.1–1.0+**), `start`/`end`
     (percent of steps affected, e.g. start 0.1–0.5, end 0.5–0.9), `bias` (shifts the
     window earlier/later), `exponent` (0 = linear curve, 1 = smooth), `fade` (softens
     the curve's overall intensity). Since large shapes resolve early in sampling and
     fine detail resolves late, adjusting the *early* window changes big-structure
     detail and the *late* window changes fine texture. Cheaper than a detail LoRA and
     stacks with one. ([Jonseed/ComfyUI-Detail-Daemon](https://github.com/Jonseed/ComfyUI-Detail-Daemon), [runcomfy](https://www.runcomfy.com/comfyui-nodes/ComfyUI-Detail-Daemon))

6. **Film grain / finishing** — applied last, after all detailing/upscaling, as a cheap
   pass (grain overlay node or a light final low-denoise img2img pass) to unify texture
   and disguise any remaining AI-smoothness. Cheapest step in the pipeline; earns its
   keep mostly on "plastic skin" cases (§5) where nothing else fully fixed it.

**Cost-vs-signal ordering**: base-resolution correctness (free, prevents duplication) >
hi-res two-pass (cheap, biggest global-quality jump) > face/hand detailing (moderate cost,
fixes the specific failure humans notice first) > detail LoRA/Detail Daemon (cheap,
diminishing returns past a point) > film grain (cheapest, purely cosmetic finishing).

---

## 5. Diagnosing bad output

| Symptom | Likely cause | What to change |
|---|---|---|
| **Plastic/waxy skin** | Base model oversmooths skin at low resolution; sampler/CFG combo over-denoises fine texture; no detail pass | Add Detail Daemon (`detail_amount` low e.g. 0.1–0.2 for SDXL) or a skin-detail LoRA; try a different sampler (dpmpp_sde family gives cleaner gradients but can still smooth skin — pair with detailer); do a face-crop detailer pass at higher local resolution ([myaiforce.com plastic skin fix](https://myaiforce.com/fix-plastic-skin/)) |
| **Mangled/extra-finger hands** | Base pass resolution too low for hand detail; model's known weak point | Segment hands (SegmentAnythingUltra or similar) → upscale crop to ≥1024px → inpaint with Differential Diffusion / dedicated hand LoRA → composite back ([comfyui.org hand-repair](https://comfyui.org/en/ai-powered-hand-repair-workflow)) |
| **Duplicated subjects at high resolution** | Generating directly at a resolution far above the model's native training resolution — the model tiles a learned composition to fill the extra space | Generate at native resolution first, then hi-res-fix/upscale in a second pass instead of one huge first pass ([techtactician.com](https://techtactician.com/comfyui-hires-fix-latent-upscaling-guide/)) |
| **Blurry mush / low detail everywhere** | Denoise too low on img2img/hi-res pass (nothing new can be added), too few steps, or scheduler mismatch (e.g. `simple` scheduler used where it applies "no intelligence") | Raise second-pass denoise into the 0.4–0.55 (latent) / 0.5–0.7 range; raise step count; switch to a proper scheduler (karras for SDXL, model-native for Flux/flow-matching) |
| **Oversaturation / burned contrast** | CFG too high for the family (esp. SDXL >8) | Lower CFG, or add RescaleCFG / AutomaticCFG (§3.3) |
| **Gibberish/garbled in-image text** | Too few steps for a text-rendering model (Qwen-Image), or vague text description instead of a quoted literal string with a placement anchor | Push to 35+ steps for Qwen-Image text; quote the exact string and anchor its position in the prompt (§1.4) |
| **LoRA overpowering the base model** (style bleed, wrong subject statistics, ignores prompt) | LoRA strength too high, or LoRA applied at a stage that conflicts with ControlNet/other conditioning | Lower LoRA strength (start ~0.6–0.8 and step down); if stacking with ControlNet, apply ControlNet conditioning before the KSampler unless the workflow explicitly merges passes — ordering determines who "wins" when strengths compete ([sumguy.com](https://sumguy.com/controlnet-and-lora-image-control/), [eastondev.com LoRA guide](https://eastondev.com/blog/en/posts/ai/20260720-comfyui-lora-guide/)) |
| **ControlNet ignoring the prompt / prompt ignoring ControlNet** | Prompt pulling opposite to the control image's implied composition/color, or ControlNet strength mismatched to its type | Default ControlNet strength 1.0 is usually right for Canny/Depth; Pose/Scribble often look better at 0.7–0.9; Tile ControlNet needs experimentation from ~0.5 upward. If the model ignores the control image's palette, the prompt is overpowering it — dial the prompt back or raise ControlNet strength (up to ~1.5 in stubborn cases) ([sumguy.com](https://sumguy.com/controlnet-and-lora-image-control/)) |
| **Seams from tiled upscaling** | Tile denoise too high with no cross-tile guidance | Use a Tile ControlNet feeding the pre-upscale image back in (strength ~1.0, denoise ~0.75) so tiles agree with each other, or lower tile-only denoise to ~0.3–0.5 |
| **Color shift after VAE roundtrip (washed-out, purple tint, odd skin tones)** | Mismatched or wrong VAE for the checkpoint — this is the cause "99% of the time" per one troubleshooting source | Explicitly wire the checkpoint's matching VAE (e.g. `sdxl_vae.safetensors` for SDXL-family checkpoints) rather than relying on an auto/baked-in VAE ([docs.comfy.org troubleshooting](https://docs.comfy.org/troubleshooting/model-issues), aggregator source on VAE-color-shift) |

---

## 6. Reproducibility and iteration discipline

### 6.1 Seed handling

- A fixed seed reproduces an image **only** if sampler, scheduler, steps, CFG, resolution,
  model/LoRA versions, and ComfyUI/backend version are *all* identical. Any one of those
  changing breaks the match even with the same seed.
- **Ancestral/SDE samplers are not fully seed-deterministic** — they draw extra random
  noise every step, so re-running the same seed on `euler_ancestral`/`dpmpp_sde` variants
  can still produce visibly different pixels between runs/backends. If a specific result
  must be exactly reproducible (client delivery, hero shot), prefer a converging sampler
  (`euler`, `dpmpp_2m`, `ddim`, `uni_pc`).
  ([Medium — ComfyUI Generation Parameters](https://medium.com/@studio.angry.shark/comfyui-generation-parameters-from-random-chaos-to-reproducible-results-51e4ba95bd06))
- **Batch size and seed**: the KSampler's seed is assigned across the whole batch — a
  batch of N images with one seed produces N *different* images, but re-running the same
  seed + same batch size reproduces the same N images. Use `LatentBatchSeedBehavior` to
  control whether per-sample seeds are fixed or randomized within a batch.
  ([runcomfy LatentBatchSeedBehavior](https://www.runcomfy.com/comfyui-nodes/ComfyUI/LatentBatchSeedBehavior))
- **What breaks determinism beyond the sampler**: different PyTorch/CUDA versions,
  different GPU architectures, xformers/flash-attention on vs. off, and different
  ComfyUI versions can all shift floating-point results slightly even with an identical
  seed and converging sampler — don't expect bit-exact reproduction across machines,
  only "close enough to be the same image" **[unverified specifics, but consistent
  with general PyTorch nondeterminism behavior]**.

### 6.2 XY-plot / grid-sweep method

- Keep **seed, latent, and conditioning fixed**; vary exactly one axis at a time
  (sampler×scheduler is the classic pairing sweep) so differences you observe are
  attributable to that one axis. Comfy's ecosystem has dedicated nodes for this
  (`easy XYInputs: Sampler/Scheduler`, `KSampler Matrix Lab`, and API-driven batch
  sweep scripts for mass-producing grids). ([followfoxai substack — mass-produce XY plots via API](https://followfoxai.substack.com/p/mass-produce-xy-plots-with-comfyui), [comfy.icu XY Inputs node](https://comfy.icu/node/easy-XYInputs-Sampler-Scheduler))
- Remember that if one axis of the sweep is an ancestral/SDE sampler, that cell is an
  inherently noisier comparison than a converging-sampler cell — don't over-read small
  differences there as caused by the scheduler alone.

### 6.3 Keeping metadata so a result is reproducible later

- ComfyUI embeds the full workflow graph (every node + parameter value, including seed)
  into the PNG's metadata by default — dragging that PNG back into ComfyUI reloads the
  exact graph. This is the primary "reproducibility record"; don't strip metadata when
  saving/exporting finals if you might need to reproduce or iterate on them later.
  **[standard ComfyUI behavior, not separately re-verified this session — consistent
  with widely-documented default behavior]**
- For anything going through post-processing (external upscalers, editors) that strips
  PNG metadata, keep the original ComfyUI-saved PNG (or export the workflow JSON
  explicitly) as the source of truth, and treat any downstream-edited copy as a
  non-reproducible derivative.

---

### Sources index

- [aiofm.info — Flux prompting guide](https://aiofm.info/en/guides/flux-prompting-guide)
- [aiofm.info — CLIP vs T5](https://aiofm.info/en/guides/what-is-clip-vs-t5-encoder)
- [Civitai — Ultimate Guide to Creating Realistic SDXL Prompts](https://civitai.com/articles/11432/ultimate-guide-to-creating-realistic-sdxl-prompts)
- [dreampixelforge.com — Qwen Image Prompts](https://www.dreampixelforge.com/blog/qwen-image-prompts)
- [docs.comfy.org — Qwen-Image tutorial](https://docs.comfy.org/tutorials/image/qwen/qwen-image)
- [QwenLM/Qwen-Image GitHub](https://github.com/QwenLM/Qwen-Image)
- [localaimaster.com — Qwen-Image local guide](https://localaimaster.com/models/qwen-image-local-guide)
- [comfyui.dev — Sampler name options](https://comfyui.dev/docs/guides/Other%20Resources/sampler-name-options/) (secondary source)
- [comfyui.dev — Scheduler options](https://comfyui.dev/docs/guides/Other%20Resources/scheduler-options/) (secondary source)
- [comfyui.dev — Sampler/scheduler compatibility matrix](https://comfyui.dev/docs/guides/Other%20Resources/sampler-and-scheduler-compatibility-matrix/) (secondary source)
- [docs.comfy.org — BasicScheduler](https://docs.comfy.org/built-in-nodes/BasicScheduler)
- [docs.comfy.org — CFGNorm](https://docs.comfy.org/built-in-nodes/CFGNorm)
- [Medium — ComfyUI Generation Parameters: From Random Chaos to Reproducible Results](https://medium.com/@studio.angry.shark/comfyui-generation-parameters-from-random-chaos-to-reproducible-results-51e4ba95bd06)
- [runcomfy — RescaleCFG](https://www.runcomfy.com/comfyui-nodes/ComfyUI/RescaleCFG)
- [GitHub — Extraltodeus/ComfyUI-AutomaticCFG](https://github.com/Extraltodeus/ComfyUI-AutomaticCFG)
- [HuggingFace — ostris/OpenFLUX.1 discussion #7 (CFG confusion)](https://huggingface.co/ostris/OpenFLUX.1/discussions/7)
- [Medium — How to Write Negative Prompts in FLUX](https://medium.com/towards-agi/how-to-write-negative-prompts-in-flux-e4305c9e7333)
- [runcomfy — FluxGuidance](https://www.runcomfy.com/comfyui-nodes/ComfyUI/flux-guidance)
- [prompt-architects.com — FLUX Guidance Scale Explained](https://prompt-architects.com/blog/344-flux-guidance-scale-explained)
- [GitHub — cubiq/ComfyUI_Workflows upscale README](https://github.com/cubiq/ComfyUI_Workflows/blob/main/upscale/README.md)
- [techtactician.com — Hires Fix / Latent Upscaling guide](https://techtactician.com/comfyui-hires-fix-latent-upscaling-guide/)
- [eastondev.com — ComfyUI Upscaling and Inpainting](https://eastondev.com/blog/en/posts/ai/20260722-comfyui-upscale-inpaint-guide/)
- [GitHub — Jonseed/ComfyUI-Detail-Daemon](https://github.com/Jonseed/ComfyUI-Detail-Daemon)
- [runcomfy — ComfyUI-Detail-Daemon](https://www.runcomfy.com/comfyui-nodes/ComfyUI-Detail-Daemon)
- [myaiforce.com — Fix Plastic-Like Skin](https://myaiforce.com/fix-plastic-skin/)
- [comfyui.org — AI-Powered Hand Repair Workflow](https://comfyui.org/en/ai-powered-hand-repair-workflow)
- [sumguy.com — ControlNet & LoRA: Advanced Image Control](https://sumguy.com/controlnet-and-lora-image-control/)
- [eastondev.com — Use LoRA in ComfyUI: Weights and Stacking](https://eastondev.com/blog/en/posts/ai/20260720-comfyui-lora-guide/)
- [docs.comfy.org — Troubleshooting Model Issues](https://docs.comfy.org/troubleshooting/model-issues)
- [aiphotogenerator.net — What Is CFG Scale in Stable Diffusion?](https://www.aiphotogenerator.net/blog/2026/02/what-is-cfg-scale-stable-diffusion)
- [aiphotogenerator.net — Negative Prompts Explained](https://www.aiphotogenerator.net/blog/2026/02/negative-prompts-stable-diffusion-guide)
- [runcomfy — LatentBatchSeedBehavior](https://www.runcomfy.com/comfyui-nodes/ComfyUI/LatentBatchSeedBehavior)
- [followfoxai.substack.com — Mass Produce XY Plots with ComfyUI API](https://followfoxai.substack.com/p/mass-produce-xy-plots-with-comfyui)
- [comfy.icu — XY Inputs: Sampler/Scheduler //EasyUse](https://comfy.icu/node/easy-XYInputs-Sampler-Scheduler)
