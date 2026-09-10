# ComfyUI Node Ecosystem & Workflow Patterns (verified September 2026)

Reference doc for building/editing ComfyUI graphs and driving ComfyUI programmatically.
Node class names below were verified against the live `Comfy-Org/ComfyUI` `master` branch
source (not training-data guesses) unless marked "unverified". Current core version at
time of writing: **ComfyUI v0.35.0** (2026-09-09) / **frontend v1.55.2** (2026-09-09) —
the project lives at `github.com/Comfy-Org/ComfyUI` (renamed from the original
`comfyanonymous/ComfyUI`; old URL redirects). [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)

## Table of contents

1. [Core built-in graph anatomy](#1-core-built-in-graph-anatomy)
2. [Canonical workflow patterns](#2-canonical-workflow-patterns)
   - [img2img](#img2img)
   - [Inpainting](#inpainting)
   - [Outpainting](#outpainting)
   - [ControlNet](#controlnet)
   - [LoRA stacking](#lora-stacking)
   - [Reference-image conditioning (IPAdapter / Redux / PuLID / InstantID / Kontext)](#reference-image-conditioning)
   - [Upscaling](#upscaling)
   - [Face detailing / segmented re-diffusion](#face-detailing--segmented-re-diffusion)
   - [Regional prompting / attention coupling](#regional-prompting--attention-coupling)
   - [Batch and API-driven generation](#batch-and-api-driven-generation)
3. [Essential custom node packs](#3-essential-custom-node-packs)
4. [2026-era ComfyUI features](#4-2026-era-comfyui-features)
5. [Programmatic use](#5-programmatic-use)
6. [Debugging playbook](#6-debugging-playbook)

---

## 1. Core built-in graph anatomy

### Minimum viable txt2img — checkpoint path

Exact `class_type` names as they appear in API-format JSON (verified against `nodes.py`):

```
CheckpointLoaderSimple  → MODEL, CLIP, VAE
CLIPTextEncode (positive) ← CLIP from loader
CLIPTextEncode (negative) ← CLIP from loader
EmptyLatentImage        → LATENT (width, height, batch_size)
KSampler                ← model, positive, negative, latent_image
                         → LATENT
VAEDecode                ← samples (KSampler out), vae (loader out)
                         → IMAGE
SaveImage                ← images
```

`CheckpointLoaderSimple` outputs `[MODEL, CLIP, VAE]` (indices 0/1/2) in one node — this is
the classic SD1.5/SDXL path where the checkpoint file bundles all three.
[CheckpointLoaderSimple docs](https://docs.comfy.org/built-in-nodes/CheckpointLoaderSimple)

### Minimum viable txt2img — diffusion-model path (Flux/SD3.5/Qwen/etc.)

Modern split-weight models (Flux, SD3.5, Qwen-Image, Wan) ship UNET/DiT, text encoder(s),
and VAE as **separate files**, so the loader stage changes:

```
UNETLoader        → MODEL          (unet_name, weight_dtype)
DualCLIPLoader     → CLIP           (clip_name1, clip_name2, type e.g. "flux")
VAELoader          → VAE            (vae_name)
CLIPTextEncode ×2  ← CLIP
EmptyLatentImage    or EmptySD3LatentImage (some models expect this variant)
KSampler / KSamplerAdvanced
VAEDecode
SaveImage
```

- `UNETLoader` outputs only `MODEL`; `DualCLIPLoader` outputs only `CLIP` — you need both
  plus a separate `VAELoader`, versus the single `CheckpointLoaderSimple` node.
- `DualCLIPLoader` takes two clip files (e.g. `clip_l.safetensors` + `t5xxl_fp16.safetensors`
  for Flux) and a `type` selector (`flux`, `sd3`, `hidream`, etc.).
- For 4-encoder models there are `TripleCLIPLoader`/`QuadrupleCLIPLoader` variants (also
  present in GGUF form, see §3).
- Flux/SD3-style models commonly need `ModelSamplingFlux` or similar sampling-shift nodes
  wired between the loader and `KSampler` — check the model's official template rather than
  assuming SD1.5 defaults transfer.

[UNET Loader guide](https://comfyui-wiki.com/en/comfyui-nodes/advanced/loaders/unet-loader) ·
[Load Checkpoint vs Load Diffusion Model](https://www.earngenix.com/tutorials/comfyui-load-checkpoint-vs-diffusion-model)

---

## 2. Canonical workflow patterns

### img2img

Same graph as txt2img except the latent source and `denoise` change:

```
LoadImage → VAEEncode (image, vae) → LATENT
KSampler(latent_image=<that LATENT>, denoise=0.4–0.7)
```

**Denoise semantics**: `denoise` is the *fraction of the noise schedule actually run* — 1.0
means full denoise from pure noise (ignores the input image's structure almost entirely at
high step counts), 0.0 means no change at all. Structure-preserving img2img sits ~0.3–0.6;
style-preserving "redraw the whole thing" sits ~0.6–0.85. This is the single most
misunderstood knob in ComfyUI — many "why does the output not look like my input"
questions are just `denoise` set too high.

### Inpainting

Three competing approaches, pick one per model type:

1. **`VAEEncodeForInpaint`** (classic/legacy, works on any SD1.5/SDXL checkpoint): encodes
   the image with masked pixels forced to gray (0.5,0.5,0.5) before encoding, feeding a
   masked latent into a normal `KSampler`. Good baseline, mediocre edge blending.
   [VAEEncodeForInpaint](https://www.runcomfy.com/comfyui-nodes/ComfyUI/VAEEncodeForInpaint)
2. **`InpaintModelConditioning`**: for checkpoints actually trained as inpaint models (SD1.5
   `-inpainting`, SDXL inpaint fine-tunes) or as the required conditioning stage feeding
   `DifferentialDiffusion`. Wires `positive`/`negative`/`vae`/`pixels`/`mask` (and optionally
   `noise_mask`) together and outputs conditioning + a latent shaped for the sampler.
   [InpaintModelConditioning](https://comfyai.run/documentation/InpaintModelConditioning)
3. **`DifferentialDiffusion`** (verified core node, `comfy_extras/nodes_differential_diffusion.py`,
   category "experimental"): patches the `MODEL` so a grayscale mask becomes a **per-pixel
   denoise-strength map** instead of a hard binary mask — every pixel gets its own effective
   `denoise` derived from mask intensity and the current sampling step, blended by a
   `strength` widget (0–1). This is the modern default for soft, seamless inpaint edges on
   *any* base model (not just inpaint-finetunes): patch the model through
   `DifferentialDiffusion`, then feed prompts/mask/image through `InpaintModelConditioning`
   into the same `KSampler`.

**Mask growth/blur**: use `GrowMask`/`FeatherMask` (or the `grow_mask_by` widget baked into
`VAEEncodeForInpaint`) to expand the mask a few pixels past the visible edit region and
soften its edge — this prevents a visible seam ring where the new content meets the old.
Community guidance: increasing `grow_mask_by` on the inpaint-encode node is often a cleaner
fix for seams than cranking outpaint feathering (see Outpainting below).

Third-party alternative worth knowing: `Acly/comfyui-inpaint-nodes` adds Fooocus-style
inpaint-head models, LaMa, and MAT for pre-filling masked regions before diffusion — actively
maintained (pushed 2026-05-31). [comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes)

### Outpainting

```
LoadImage → ImagePadForOutpaint (left/top/right/bottom, feathering) → IMAGE + MASK
          → VAEEncodeForInpaint (or InpaintModelConditioning) → KSampler → VAEDecode
```

`ImagePadForOutpaint` (verified core class, `comfy_extras`/`nodes.py:2003`) pads the canvas
in the requested directions and emits a mask marking the new (empty) area. `feathering`
softens the pad/original boundary. Practical tuning: feathering ~40–80, keep the fill option
on so the model has edge context to extrapolate from, and prefer bumping
`grow_mask_by` on the downstream inpaint-encode node over pushing feathering very high.
KJNodes ships enhanced variants (`ImagePadForOutpaintMasked`, `ImagePadForOutpaintTargetSize`)
for mask-aware and fixed-target-resolution outpaint. [Outpainting tutorial](https://docs.comfy.org/tutorials/basic/outpaint) ·
[KJNodes outpaint variants](https://www.runcomfy.com/comfyui-nodes/ComfyUI-KJNodes/ImagePadForOutpaintMasked)

### ControlNet

```
LoadImage → <aux preprocessor, e.g. CannyEdgePreprocessor> → IMAGE
ControlNetLoader → CONTROL_NET
ControlNetApplyAdvanced(positive, negative, control_net, image, strength, start_percent, end_percent)
  → positive', negative'  (feed into KSampler in place of the raw conditioning)
```

`ControlNetApplyAdvanced` (verified core class, `nodes.py:932`) is the node to reach for —
it takes both positive and negative conditioning plus explicit `strength`,
`start_percent`, and `end_percent` widgets, versus the older single-conditioning
`ControlNetApply`. `strength` 0–10 (default 1.0) scales influence; `start_percent`/
`end_percent` (0.0–1.0) schedule *when in the denoise process* the ControlNet applies —
e.g. `start=0.0, end=0.5` only guides the first half of sampling, letting the model
"finish" more freely.

**Union/Pro models**: modern union ControlNets (SDXL/Flux "union" checkpoints that fold
canny/depth/pose/etc. into one file) need a `type`/`control_type` selector node
(e.g. `SetUnionControlNetType`) before `ControlNetApplyAdvanced`, and tend to overcook at
the old default `strength=1.0`/`start=0.0` — start lower (0.5–0.8 strength) than legacy
single-purpose ControlNets. For Flux specifically there's a dedicated `Flux Union
ControlNet Apply` node in some packs.
[ControlNet tutorial](https://docs.comfy.org/tutorials/controlnet/controlnet) ·
[ControlNetApplyAdvanced params](https://comfy.icu/node/ACN_AdvancedControlNetApply)

Preprocessors live in the separate `comfyui_controlnet_aux` pack (§3), not core.

### LoRA stacking

```
CheckpointLoaderSimple → MODEL, CLIP
LoraLoader(model, clip, lora_name, strength_model, strength_clip) → MODEL', CLIP'
LoraLoader(model', clip', lora_name2, ...) → MODEL'', CLIP''   ← chain for multiple LoRAs
```

`LoraLoader` (verified `nodes.py:709`) and `LoraLoaderModelOnly` (verified `nodes.py:756`,
subclasses `LoraLoader`) are the two core nodes:

- `LoraLoader` touches both `MODEL` and `CLIP` with independent `strength_model` /
  `strength_clip` sliders (1.0 = full strength, 0.0 = disabled; most LoRAs behave best in
  the 0.5–0.9 band for `strength_model`).
- `LoraLoaderModelOnly` skips CLIP entirely — use it when a LoRA only needs to bias the
  denoising model (common for motion/style LoRAs used with a shared, unmodified text
  encoder across an A/B comparison).
- **Trigger words**: many LoRAs require a specific token in the positive prompt to actually
  activate their effect — check the model card (Civitai listing etc.); a LoRA at full
  strength with no trigger word can visually do almost nothing.
- Stack by chaining `LoraLoader` nodes in series, each consuming the previous node's
  `MODEL`/`CLIP` outputs. `rgthree-comfy`'s "Power Lora Loader" / "Lora Loader Stack" (§3)
  collapses a long chain into one node with per-LoRA toggle switches — the practical
  standard for >2 LoRAs.

### Reference-image conditioning

The IPAdapter ecosystem is fragmented and partly in maintenance mode as of 2026 — check
status before depending on a specific pack:

- **`cubiq/ComfyUI_IPAdapter_plus`** — the original, widely-copied reference implementation.
  Verified via its own README: the maintainer set it to **"maintenance-only" mode on
  2025-04-14** ("I do not use ComfyUI as my main way to interact with Gen AI anymore...
  I do not plan any consistent work on this repo"). It still works and is still the most
  copied implementation, but treat it as frozen, not actively evolving.
  [cubiq/ComfyUI_IPAdapter_plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus)
- An official mirror/successor exists under the Comfy org umbrella
  (`comfyorg/comfyui-ipadapter`) — check it before installing the original if you want
  anything closer to actively maintained.
- **PuLID** (`balazik/ComfyUI-PuLID-Flux` and SDXL variants) — identity-preserving face
  conditioning, commonly paired with **FLUX-REDUX** (Flux's own native "image variation /
  style transfer" conditioning path) for face-swap-with-style-transfer workflows: PuLID
  supplies the face embedding, Redux supplies the style/composition reference.
- **InstantID** — SDXL-only, adds explicit facial-keypoint ControlNet conditioning on top
  of an IP-Adapter-style face embedding; still the go-to for SDXL face-lock when PuLID
  (Flux-first) isn't applicable.
- **Flux Kontext** — not a reference-image adapter at all but a genuinely different
  paradigm: an *edit-conditioned* Flux checkpoint that takes a source image + text
  instruction ("make the sky purple") and edits in one pass, no mask/ControlNet/IPAdapter
  needed. Kontext Pro/Max are cloud-only (via Partner/API nodes, see §4); **Kontext Dev**
  runs locally like any other Flux checkpoint and is the closest thing 2026 ComfyUI has to
  a "native" replacement for a chunk of what IPAdapter used to be used for (instruction-driven
  edits rather than style transfer).
- Practical rule of thumb for 2026: SDXL face-lock → InstantID or IPAdapter FaceID; Flux
  style/identity transfer → PuLID-Flux + Redux; Flux instruction-based edits → Kontext.

[Face swap PuLID-Flux + Redux workflow](https://comfyui.org/en/face-swap-pulid-flux-redux-workflow) ·
[IP-Adapter vs InstantID vs ReActor](https://eastondev.com/blog/en/posts/ai/20260821-comfyui-face-identity-consistency/) ·
[Flux Kontext overview](https://diffusiondoodles.substack.com/p/flux1-kontext-dev-multimodal-image)

### Upscaling

Three distinct techniques, pick per use case:

1. **Latent upscale** (`LatentUpscale`/`LatentUpscaleBy`, core): resizes the latent tensor
   directly, cheap, then feed into a second `KSampler` pass at low `denoise` (classic
   **hires-fix / two-pass txt2img**). Fast (~20–50× faster than a full
   VAE-decode → pixel-upscale → VAE-encode round trip) but softer detail than pixel-space
   methods.
2. **Model upscale** (`UpscaleModelLoader` + `ImageUpscaleWithModel`, core, verified in
   `comfy_extras/nodes_upscale_model.py`): runs a dedicated ESRGAN-family super-resolution
   model on the decoded pixel image. Fast, deterministic, good for a final sharpen pass, but
   doesn't add new generative detail.
3. **Tiled / Ultimate SD Upscale** (`ssitu/ComfyUI_UltimateSDUpscale`, actively maintained,
   pushed 2026-06-22): splits the image into overlapping tiles, runs img2img diffusion on
   each tile at low denoise, and stitches them back — lets you upscale far beyond a single
   pass's native training resolution while re-adding fine texture. Slower, and can show tile
   seams/inconsistency at aggressive settings; use tile padding + a modest denoise (0.2–0.4).
   [ssitu/ComfyUI_UltimateSDUpscale](https://github.com/ssitu/ComfyUI_UltimateSDUpscale)

**Two-pass hires-fix recipe**: txt2img at base resolution → `LatentUpscaleBy` (1.5×–2×) →
second `KSampler` with `denoise≈0.3–0.5` reusing the same or a lighter model → `VAEDecode`.
Prefer stepping 2×→2× over a single 4× jump on small sources. 2026 guidance treats plain
Ultimate SD Upscale as a solid but no-longer-cutting-edge default — pair a fast model-upscale
pass for resolution with a light Ultimate SD Upscale/tiled pass only where you need re-added
detail, rather than always reaching for the heaviest option.
[Hires-fix example](https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/) ·
[Upscale methods comparison](https://deepwiki.com/cubiq/ComfyUI_Workflows/5.1-upscaling-methods-comparison)

### Face detailing / segmented re-diffusion

Standard "Impact Pack" pattern (`ltdrdata/ComfyUI-Impact-Pack`, actively maintained, pushed
2026-04-19):

```
UltralyticsDetectorProvider(model_name="face_yolov8m.pt")  → BBOX_DETECTOR
SAMLoader (optional)                                        → SAM_MODEL
FaceDetailer(image, model, clip, vae, positive, negative,
             bbox_detector, sam_model_opt, guide_size, ...)
  → refined IMAGE
```

`FaceDetailer` detects faces via YOLO (from the separate `Impact-Subpack`, which supplies
`UltralyticsDetectorProvider`), optionally refines the detected region into a precise
segmentation mask via SAM (`sam_model_opt` — without it you get a plain rectangular bbox
crop instead of a face-shaped cutout), crops+upscales just that region, re-runs a full
`KSampler` pass on the crop at the requested `guide_size`, and composites the result back
into the full image. This is the standard "fix garbled small faces" step in almost every
production SDXL/SD1.5 pipeline, and generalizes past faces to any YOLO/SAM-detectable class
(hands, whole-person) via the generic `Detailer`/`DetailerForEach` nodes in the same pack.
Note: PyTorch 2.6+ defaults `torch.load(weights_only=True)`, which breaks older YOLO
checkpoint loading — keep `Impact-Subpack` current if you hit a YOLO load error.
[ltdrdata/ComfyUI-Impact-Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) ·
[FaceDetailer node](https://www.runcomfy.com/comfyui-nodes/ComfyUI-Impact-Pack/FaceDetailer)

### Regional prompting / attention coupling

Core primitive: `ConditioningSetMask` (verified `nodes.py:245`) — takes a conditioning plus
a grayscale mask and restricts where that conditioning applies; combine several
masked-conditioning branches via `ConditioningCombine` before the sampler. Pattern per
region: `CLIPTextEncode` (region prompt) → `ConditioningSetMask` (region mask) → combine →
`KSampler`. Masks are typically hand-drawn or generated from segmentation.

`GLIGENLoader` + `GLIGENTextBoxApply` (both verified core, `nodes.py:1200`/`1215`) offer a
box-based alternative — condition on rectangular regions with per-box text rather than a
freeform mask, useful for compositional layout control without a mask-authoring step.

Beyond core, "Attention Couple" style custom nodes (multiple community implementations, e.g.
`AttentionCoupleRegion`) implement true cross-attention splitting rather than post-hoc
conditioning masking, generally giving cleaner region boundaries at the cost of being a
non-core dependency. [Regional prompting guide](https://www.runflow.io/blog/comfyui-regional-prompting)

### Batch and API-driven generation

- **In-graph batching**: `EmptyLatentImage.batch_size > 1` runs N images through one
  `KSampler` call sharing the same seed-derived noise batch (fast, same VRAM cost roughly
  scales with batch); or drive `seed` from a queued list and hit "Queue Prompt" repeatedly
  for independent runs.
- **API-driven**: submit N separate API-format prompt dicts to `POST /prompt`, varying only
  `seed`/`text`/`image` inputs per call — this is the standard pattern for scripted batch
  jobs (see §5's Python example) and is how most "batch and vary a workflow" tooling works
  under the hood (e.g. the local `comfy-mcp` server's `vary_workflow`/`run_workflow`
  primitives operate exactly this way — set a slot value, submit, poll, fetch).

---

## 3. Essential custom node packs

GitHub API metadata pulled live (2026-09-11) — `pushed_at` is the last commit date.

| Pack | Repo | Status (2026-09-11) | What it's for |
|---|---|---|---|
| **ComfyUI-Manager** | [Comfy-Org/ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) | Active, pushed 2026-09-10, 16.1k★ | Install/update/enable-disable custom nodes; talks to `registry.comfy.org`. Install this first. |
| **rgthree-comfy** | [rgthree/rgthree-comfy](https://github.com/rgthree/rgthree-comfy) | Active, pushed 2026-09-01, 3.5k★ | QoL power nodes: reroute, Power Lora Loader (collapsed multi-LoRA stack with toggles), fast muter/bypasser groups, context nodes. Near-universal install. |
| **ComfyUI_essentials** | [cubiq/ComfyUI_essentials](https://github.com/cubiq/ComfyUI_essentials) | **Maintenance-only since 2025-04-14** (maintainer's own README notice), pushed 2025-04, 1.2k★ | Grab-bag of "missing from core" nodes (image ops, mask ops, simple math). Still works, no active development — check individual nodes haven't been absorbed into core before relying on it long-term. |
| **was-node-suite-comfyui** | [WASasquatch/was-node-suite-comfyui](https://github.com/WASasquatch/was-node-suite-comfyui) | Active — rebranded **"WAS-NS Reborn"**, pushed 2026-09-10, 1.8k★ | Large utility grab-bag: image processing/filters, masking, text, logic, numbers, latents, files, even basic 3D-scene nodes. Note the rename — older docs referencing plain "WAS Node Suite" are talking about this same, now-revived pack. |
| **ComfyUI-Impact-Pack** | [ltdrdata/ComfyUI-Impact-Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) | Active, pushed 2026-04-19, 3.3k★ | FaceDetailer / Detailer / segmentation-driven re-diffusion, detector providers. Needs the separate **Impact-Subpack** for YOLO models. |
| **ComfyUI-KJNodes** | [kijai/ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes) | Very active, pushed 2026-09-08, 3.3k★ | Kijai's broad utility pack — outpaint padding variants, video/latent helpers, Set/Get 2.0 with subgraph support. A de-facto second "essentials" pack that IS still actively evolving (unlike `ComfyUI_essentials`). |
| **ComfyUI-Custom-Scripts** | [pythongosssss/ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts) | Active, pushed 2026-02-12, 3.2k★ | UI-focused QoL: node finder, image feed, show-text/preview nodes, workflow-quality-of-life JS. |
| **ComfyUI-Frame-Interpolation** | Kosinkadink | Not confirmed via API (404/rate-limited during this check) — re-verify before relying on this row | RIFE/FILM-style frame interpolation for video workflows. |
| **ComfyUI-VideoHelperSuite** | [Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) | Active, pushed 2026-09-02, 1.8k★ | Video load/combine/save nodes (image-sequence ↔ video, batching for AnimateDiff/Wan-style pipelines). |
| **ComfyUI-GGUF** | [city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF) | Active, pushed 2026-01-12, 4.0k★ | Quantized GGUF loading for DiT models (Flux etc.) on low-VRAM cards. Verified node classes: `UnetLoaderGGUF`, `UnetLoaderGGUFAdvanced`, `CLIPLoaderGGUF`, `DualCLIPLoaderGGUF`, `TripleCLIPLoaderGGUF`, `QuadrupleCLIPLoaderGGUF`. Swap in for `UNETLoader`/`DualCLIPLoader` 1:1. |
| **ComfyUI-AnimateDiff-Evolved** | [Kosinkadink/ComfyUI-AnimateDiff-Evolved](https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved) | Active, pushed 2026-07-28, 3.5k★ | Motion-module video generation for SD1.5/SDXL-era checkpoints. In 2026 this is largely **superseded for new projects** by native video DiTs (Wan 2.2, LTX, Hunyuan Video) driven through core/partner nodes — keep this pack only if you're specifically animating an SD1.5/SDXL checkpoint stack. |
| **ComfyUI-Advanced-ControlNet** | [Kosinkadink/ComfyUI-Advanced-ControlNet](https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet) | Active, pushed 2026-07-28, 1.0k★ | Per-frame/scheduled ControlNet strength and masking, sliding-context support — pairs with AnimateDiff-Evolved. |
| **comfyui_controlnet_aux** | [Fannovel16/comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) | Active, pushed 2026-08-27, 4.2k★ | The ControlNet preprocessor pack (canny/depth/openpose/lineart/etc. auxiliary detectors) — pair with core `ControlNetApplyAdvanced`. |
| **ComfyUI-Crystools** | [crystian/ComfyUI-Crystools](https://github.com/crystian/ComfyUI-Crystools) | Slower-moving, pushed 2025-10-26, 2.0k★ | System monitor (VRAM/RAM/CPU HUD) + misc utility nodes. Still functional, less active than the others in this table — verify it still loads cleanly on v0.35 before depending on it in a new build. |
| **ComfyUI_IPAdapter_plus** | [cubiq/ComfyUI_IPAdapter_plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus) | **Maintenance-only since 2025-04-14** (maintainer's own README notice), pushed 2025-04, 6.1k★ | Original/most-copied IPAdapter implementation. Frozen but functional; check `comfyorg/comfyui-ipadapter` or PuLID/Kontext (§2) for actively-developed alternatives on new builds. |
| **comfyui-inpaint-nodes** | [Acly/comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes) | Active, pushed 2026-05-31, 1.2k★ | Fooocus inpaint-head model, LaMa, MAT pre-fill nodes — better raw material for inpaint/outpaint than a plain gray-fill. |
| **ComfyUI_UltimateSDUpscale** | [ssitu/ComfyUI_UltimateSDUpscale](https://github.com/ssitu/ComfyUI_UltimateSDUpscale) | Active, pushed 2026-06-22, 1.6k★ | Tiled diffusion upscale (see §2). |

**Bottom line for a 2026 fresh install**: ComfyUI-Manager → rgthree-comfy → WAS-NS Reborn →
KJNodes → Impact-Pack (+Subpack) → comfyui_controlnet_aux → GGUF (if VRAM-constrained) →
VideoHelperSuite (if doing video). Treat `ComfyUI_essentials` and `ComfyUI_IPAdapter_plus`
as "still fine, but frozen" rather than "actively recommended."

---

## 4. 2026-era ComfyUI features most people miss

- **Subgraphs**: stable as of the 0.3.x line and refined through 0.3.66 — package a chunk
  of a workflow into a single reusable node with its own parameter panel; unpack it back to
  loose nodes when you need to edit internals. KJNodes' Set/Get nodes got a full rewrite to
  work across subgraph boundaries. [Subgraphs intro](https://blog.comfy.org/p/subgraphs-are-coming-to-comfyui) ·
  [docs](https://docs.comfy.org/interface/features/subgraph)
- **Partial execution / caching**: ComfyUI only re-runs nodes whose inputs actually changed
  since the last queue — a graph re-run after tweaking just a prompt string skips re-loading
  checkpoints/re-running upstream samplers whose output is still valid, which is why editing
  a downstream node and hitting Queue again is fast. Cache keys are derived from each node's
  effective input values, not wall-clock/graph position.
- **New `io.ComfyNode` / `io.Schema` node-definition API**: verified directly in core source
  (e.g. `DifferentialDiffusion`, `UpscaleModelLoader` in `comfy_extras`) — newer core nodes
  are increasingly defined via a typed `io.Schema`/`ComfyExtension`/`comfy_entrypoint()`
  pattern rather than the classic `INPUT_TYPES()` dict + `NODE_CLASS_MAPPINGS` style. Both
  styles coexist and both still produce the same `class_type` strings in API JSON — this
  only matters if you're writing new custom nodes, not for consuming existing ones.
- **API/Partner nodes**: a growing set of built-in nodes (the `comfy_api_nodes` extension)
  call paid cloud models — OpenAI, Kling, Luma, Nano Banana, Seedance, Seedream, Grok,
  Hunyuan 3D, GPT Image 2, and more — from inside an otherwise-local graph, billed in
  prepaid credits per generation via a ComfyUI account/API key, no separate SDK wiring
  needed. Distinct from **Comfy Cloud** nodes, which instead run *open* models (Wan 2.2,
  Flux, LTX, Qwen) on Comfy's own GPUs per-GPU-second, still from a local graph — useful
  when your own box can't hold the model. [Partner Nodes docs](https://docs.comfy.org/tutorials/partner-nodes/overview) ·
  [Native Partner Nodes announcement](https://blog.comfy.org/p/comfyui-native-api-nodes)
- **Templates browser**: a redesigned, filterable in-app template library (overhauled in
  frontend 0.3.66) plus a standalone browsable/searchable Astro site
  (`Comfy-Org/workflow_templates`) covering official workflow templates and "subgraph
  blueprints" (packaged reusable subgraph components).
- **Model downloader/registry**: `registry.comfy.org` is the canonical custom-node registry
  (800+ published node authors as of the registry's public numbers) that both
  ComfyUI-Manager and `comfy-cli` query; a separate in-app model browser/downloader surfaces
  checkpoints/LoRAs/VAEs without leaving the UI.
- **`comfy-cli`** (`Comfy-Org/comfy-cli`, active, pushed 2026-09-10): scriptable install/
  launch/update tooling. `comfy node registry-install <id>` talks directly to the registry
  API and extracts straight into `custom_nodes/` (bypassing Manager, `--force-download` only);
  `comfy node install <id>` instead delegates to ComfyUI-Manager's `cm-cli.py` and supports
  richer dependency flags (`--fast-deps`, `--no-deps`, `--uv-compile`). Reach for
  `registry-install` for a minimal/no-Manager environment, `node install` otherwise.
  [comfy-cli install docs](https://deepwiki.com/Comfy-Org/comfy-cli/2-installation-and-setup)
- **New frontend**: `Comfy-Org/ComfyUI_frontend` (currently v1.55.2) is a separate,
  fast-moving Vue-based rewrite decoupled from the Python backend's release cadence —
  install/update it independently when chasing the newest UI features (minimap, subgraph
  parameter panel, redesigned manager UI, node search).
- **Workflow JSON vs API JSON**: the file you `File → Save`/drag-and-drop in the UI (workflow
  format) carries node positions/colors/groups/titles for the visual editor; the file you
  actually POST to `/prompt` (API format) is keyed by numeric node ID → `{class_type, inputs}`
  only, with links represented as `["source_node_id", output_index]` pairs. Convert via
  `File → Export (API)` in the UI, or enable **dev mode** in Settings to get a persistent
  "Save (API Format)" button. Programmatic tools must consume the API-format file, not the
  raw saved workflow. [API format docs](https://docs.comfy.org/development/api-development/workflow-api-format)

---

## 5. Programmatic use

### HTTP endpoints (verified against `docs.comfy.org` server-routes page)

| Route | Method | Purpose |
|---|---|---|
| `/prompt` | POST | Submit an API-format prompt dict to the queue → `{prompt_id, number}` on success, `{error, node_errors}` on validation failure |
| `/prompt` | GET | Current queue status/execution info |
| `/history/{prompt_id}` | GET | Retrieve outputs (and status) for a completed/running prompt |
| `/history` | GET / POST | List all history / clear history |
| `/queue` | GET / POST | Inspect or mutate (clear, cancel) the pending/running queue |
| `/view` | GET | Fetch a raw output image/file by `filename`, `subfolder`, `type` |
| `/upload/image` | POST | Upload an input image |
| `/upload/mask` | POST | Upload a mask |
| `/object_info` / `/object_info/{class}` | GET | Full node-type schema introspection (all inputs/outputs/widgets) — the source of truth for building a prompt dict programmatically |
| `/interrupt` | POST | Stop the currently running execution |
| `/free` | POST | Unload specified models to reclaim VRAM |
| `/ws` | WebSocket | Real-time `status` / `execution_start` / `execution_cached` / `executing` / `progress` / `executed` events, keyed by `client_id` |

[Server routes docs](https://docs.comfy.org/development/comfyui-server/comms_routes)

### API-format prompt shape

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 156680208700286, "steps": 20, "cfg": 8,
      "sampler_name": "euler", "scheduler": "normal", "denoise": 1,
      "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}}
}
```
Each key is an arbitrary string node ID; a link is `[source_node_id, output_slot_index]`.

### Working Python example (adapted from ComfyUI's own `script_examples/websockets_api_example.py`, verified against the live source on `Comfy-Org/ComfyUI` master)

```python
import json, uuid, urllib.request, urllib.parse
import websocket  # pip install websocket-client

server = "127.0.0.1:8188"
client_id = str(uuid.uuid4())

def queue_prompt(prompt):
    payload = json.dumps({"prompt": prompt, "client_id": client_id}).encode("utf-8")
    req = urllib.request.Request(f"http://{server}/prompt", data=payload)
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]

def get_image(filename, subfolder, folder_type):
    qs = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"http://{server}/view?{qs}") as r:
        return r.read()

def get_history(prompt_id):
    with urllib.request.urlopen(f"http://{server}/history/{prompt_id}") as r:
        return json.loads(r.read())

def run(prompt):
    ws = websocket.WebSocket()
    ws.connect(f"ws://{server}/ws?clientId={client_id}")
    prompt_id = queue_prompt(prompt)
    while True:
        out = ws.recv()
        if isinstance(out, str):
            msg = json.loads(out)
            if msg["type"] == "executing":
                d = msg["data"]
                if d["node"] is None and d["prompt_id"] == prompt_id:
                    break  # done
    history = get_history(prompt_id)[prompt_id]
    images = []
    for node_output in history["outputs"].values():
        for img in node_output.get("images", []):
            images.append(get_image(img["filename"], img["subfolder"], img["type"]))
    return images

if __name__ == "__main__":
    with open("my_workflow_api.json") as f:
        prompt = json.load(f)
    prompt["3"]["inputs"]["seed"] = 42  # mutate a slot before submitting
    for i, data in enumerate(run(prompt)):
        open(f"out_{i}.png", "wb").write(data)
```

Poll-only alternative (no websocket): loop `GET /history/{prompt_id}` until the key appears,
sleeping briefly between checks — simpler, slightly higher latency, no live progress.

---

## 6. Debugging playbook

| # | Error (verbatim/paraphrased) | Cause | Fix |
|---|---|---|---|
| 1 | "When loading the graph, the following node types were not found: X" | Workflow references a `class_type`/node the install has no Python class for — custom node pack not installed | `comfy node registry-install <pack>` or ComfyUI-Manager → "Install Missing Custom Nodes"; if it silently skips a name, look it up manually at `api.comfy.org/comfy-nodes/<NodeName>/node` |
| 2 | Node installed but still shows as missing after install | Backend never restarted — refreshing the browser tab only reloads frontend JS, not Python modules | Fully restart the ComfyUI server process, not just the browser |
| 3 | "Expected all tensors to be on the same device, but found at least two devices, cuda:0 and cpu" | A model/tensor got offloaded to CPU (VRAM pressure, a node forcing `cuda:0` explicitly, or a custom node with a device bug) while the rest of the graph runs on GPU | Check for a "Force/Set CLIP Device" style node accidentally pinning a component; free VRAM (`/free`, restart); update the offending custom node |
| 4 | Black output image | Wrong/mismatched VAE for the checkpoint (esp. an SDXL VAE on an SD1.5 model or vice versa), or fp16 VAE math underflowing on some GPUs | Load the correct paired VAE explicitly via `VAELoader`; try `--force-fp32` on the VAE step or a VAE built for fp16 |
| 5 | "A tensor with all NaNs was produced in Unet" / NaN latents | Model running fp16 without enough precision (some SDXL/community checkpoints), or GPU lacking real half-precision support | Add `--no-half` / use the model's fp32 or bf16 variant; upcast cross-attention; try a different VAE precision |
| 6 | CUDA out of memory despite apparent free VRAM | Fragmented VRAM from a previous run, batch size/resolution too high for the model + LoRAs + ControlNets loaded simultaneously | Restart ComfyUI (fragmentation isn't cleared by `/free` alone); lower resolution/batch; use GGUF-quantized weights; `--cuda-device 0` on multi-GPU boxes |
| 7 | Port 8188 already in use | A previous ComfyUI process crashed without releasing the socket, or a second instance is already running | Kill the stale process, or launch with `--port <other>` |
| 8 | Progress bar stuck at 0% indefinitely ("ETA hang") | Usually a silent VRAM/driver stall or a custom node blocking synchronously — check the *server terminal*, not the browser console | Tail the actual launch terminal/log for a Python traceback; the browser devtools console never shows backend Python errors |
| 9 | Workflow loads with a wall of red nodes | Same root cause as #1, just visually — every red node is an unresolved `class_type` | Same fix as #1 |
| 10 | `/prompt` POST returns `{"error": ..., "node_errors": {...}}` | Submitted the **UI workflow-format** JSON instead of **API-format** JSON, or referenced a checkpoint/LoRA filename that doesn't exist on that server | Export via `File → Export (API)` / dev-mode "Save (API Format)"; confirm the exact filename via `/object_info` for that loader node |
| 11 | ControlNet has no visible effect / overcooks the image | Wrong `strength`/`start_percent`/`end_percent` for a modern union model (old strength=1.0 defaults are too strong on 2025-26 union ControlNets), or missing the preprocessor step entirely | Lower strength to ~0.5–0.8, narrow the start/end window; confirm the aux preprocessor node actually ran (check its IMAGE output, not just wiring) |
| 12 | Face/detail pass produces a rectangular seam instead of a natural blend | `FaceDetailer`/`Detailer` ran without a SAM model (`sam_model_opt` empty) — falls back to a plain bbox crop | Add a `SAMLoader` and wire `sam_model_opt`, or manually feather the composite mask |
| 13 | YOLO/Ultralytics detector fails to load ("weights_only" / unpickling error) | PyTorch 2.6+ defaults `torch.load(weights_only=True)`, rejecting the pickled YOLO checkpoint format Impact-Subpack historically shipped | Update `Impact-Subpack` to a version that patches the load call, or update PyTorch-compatible detector weights |
| 14 | LoRA "does nothing" even at strength 1.0 | Missing the LoRA's required trigger word in the positive prompt, or applied `LoraLoaderModelOnly` when the LoRA actually needs CLIP-side changes too | Check the model card for trigger words; switch to full `LoraLoader` if CLIP conditioning matters for that LoRA |
| 15 | img2img output barely resembles the input image (or barely changes at all) | `denoise` set too high (near 1.0, destroys input structure) or too low (near 0.0, no change) | Set `denoise` in the 0.3–0.7 band depending on how much change is wanted; remember 1.0 = effectively txt2img |

---

*Compiled 2026-09-11. GitHub metadata (`pushed_at`, stars, archived status) pulled live from
the GitHub REST API on that date; node class names cross-checked against `Comfy-Org/ComfyUI`
`master` branch source and the `city96/ComfyUI-GGUF` source. Everything else is cited inline
to its source URL — re-verify anything load-bearing before shipping, this ecosystem moves
fast.*
