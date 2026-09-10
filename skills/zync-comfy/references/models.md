# ComfyUI Model Landscape — September 2026

A dense reference for choosing and wiring up image/video/audio generation models in ComfyUI. Every settings claim is cited inline. Verify version numbers against the linked source before hardcoding them into a workflow — this space moves weekly.

## Table of Contents

1. [Model families worth using (image), newest first](#1-model-families-worth-using-image-newest-first)
2. [Companion files per family](#2-companion-files-per-family)
3. [Verified sampling settings per family](#3-verified-sampling-settings-per-family)
4. [Distilled / turbo / lightning variants](#4-distilled--turbo--lightning-variants)
5. [Video and audio models](#5-video-and-audio-models)
6. [VRAM / memory tier table](#6-vram--memory-tier-table)
7. [Verified vs unverified claims](#7-verified-on-2026-09-11--unverified-claims)

---

## 1. Model families worth using (image), newest first

### SenseNova U1.5 (SenseTime) — Aug 2026
Native pixel-space Flow Matching model (not latent diffusion), "NEO-unify" architecture, up to native 4K text-to-image, single/multi-reference editing (up to 10 refs), region-controlled edits via masks/boxes/markers. ComfyUI support via community wrapper node packs (`Comfyui-SenseNova-U1.5-Wrapper-T8`), 8B MoT variant on Hugging Face (`joyfox/SenseNova-U1.5-8B-MoT-FP8`). Peak VRAM ~17GB for T2I on a 24GB card. [comfyui-wiki 2026-08-16](https://comfyui-wiki.com/en/news/2026-08-16-sensenova-u1-5-comfyui), [comfyui-wiki 2026-07-31 preview](https://comfyui-wiki.com/en/news/2026-07-31-sensenova-u1-5-preview), [HF joyfox/SenseNova-U1.5-8B-MoT-FP8](https://huggingface.co/joyfox/SenseNova-U1.5-8B-MoT-FP8)

### Flux.2 family (Black Forest Labs) — Nov 2025 → Jan 2026
Released Nov 25, 2025 as Pro (API), Flex, Dev, and Apache-2.0 Klein; Klein shipped Jan 15, 2026 in 4B and 9B sizes. Up to 4MP photorealistic output, multi-reference consistency across up to 10 images, stronger text rendering than Flux.1. [thundercompute](https://www.thundercompute.com/blog/flux-comfyui-ai-image-generation)
- **Flux.2 Dev**: best editing precision/visual understanding of the open Flux.2 tier. Non-commercial BFL license (same family as Flux.1 dev). [docs.comfy.org flux-2-dev](https://docs.comfy.org/tutorials/flux/flux-2-dev)
- **Flux.2 Klein 4B**: Apache 2.0, unrestricted commercial use, ~13GB BF16 per BFL, ~8.4GB with offload on a 5090. Runs on a 12GB card. [localaimaster](https://localaimaster.com/blog/flux-2-local-setup-guide), [earngenix](https://www.earngenix.com/workflows/flux2-klein-image-comfyui)
- **Flux.2 Klein 9B**: FLUX Non-Commercial License, ~17-20GB, FP8 ~15GB (sweet spot for a 16GB card). [localaimaster](https://localaimaster.com/blog/flux-2-local-setup-guide)

### Krea 2 (Krea AI) — June 2026
Open-sourced June 23, 2026. Not Stable-Diffusion- or Flux-based — a new architecture built by Krea AI. Ships Turbo variants for ComfyUI. [alternativeto news](https://alternativeto.net/software/flux-1-ai/news), [earngenix Krea 2 Turbo](https://www.earngenix.com/workflows/krea-2-comfyui)

### Z-Image (Alibaba Tongyi Lab) — Nov 2025 → Jan 2026
6B-parameter family, unusually cheap to run for its quality tier.
- **Z-Image-Turbo** (Nov 27, 2025): Apache 2.0, distilled, 8-step generation, ~1024×1024 in 2-3s on an RTX 4090, targets 16GB consumer GPUs. [comfyui-wiki Z-Image-Turbo](https://comfyui-wiki.com/en/news/2025-11-27-alibaba-z-image-turbo-release)
- **Z-Image-Base** (Jan 28, 2026): non-distilled raw checkpoint, Day-0 ComfyUI support, needs 30-50 steps for optimal quality, broader style range than Turbo. [comfyui-wiki Z-Image-Base](https://comfyui-wiki.com/en/news/2026-01-28-alibaba-z-image-base-release), [docs.comfy.org Z-Image](https://docs.comfy.org/tutorials/image/z-image/z-image)

### Qwen-Image / Qwen-Image-Edit (Alibaba Qwen) — 2025 → 2026 revisions (2509, 2512, "Layered")
20.4B DiT + 8.3B Qwen2.5-VL text encoder. Excellent text rendering and instruction-following edits; revisions ship as dated snapshots (`-2509`, `-2512`, `-Layered`). [thundercompute Qwen-Image-Edit](https://www.thundercompute.com/blog/qwen-image-edit-comfyui), [unsloth Qwen-Image-2512](https://unsloth.ai/docs/models/tutorials/qwen-image-2512)

### Flux.1 family (Black Forest Labs) — Aug 2024 → mid-2025, still in heavy use
- **Flux.1 dev**: non-commercial BFL license, 12B, the community workhorse for fine-tunes/LoRAs. [Wikipedia Flux](https://en.wikipedia.org/wiki/Flux_(text-to-image_model))
- **Flux.1 schnell**: Apache 2.0, distilled for 1-4 step inference.
- **Flux.1 Krea Dev** (Jul 31, 2025): BFL + Krea AI collaboration, more "natural"/less plastic-looking than base dev. [runcomfy Flux Krea workflow](https://www.runcomfy.com/comfyui-workflows/flux-krea-dev-comfyui-workflow-natural-text-to-image-ai)
- **Flux.1 Kontext (Dev/Pro/Max)**: multimodal image *editing* model — takes image + text jointly, used by Adobe Photoshop's (beta) generative fill as of Sep 2025. [comfyui-wiki Kontext](https://comfyui-wiki.com/en/tutorial/advanced/image/flux/flux-1-kontext), [diffusiondoodles](https://diffusiondoodles.substack.com/p/flux1-kontext-dev-multimodal-image)

### Chroma (lodestones) — 2025, Apache 2.0
Built on the Flux.1-schnell architecture but fully retrained/de-distilled. `Chroma1-HD` (8.9B, T2I) is the flagship; `Chroma1-Radiance` (upscaling-focused) is WIP. Fully open Apache 2.0, unlike Flux.1 dev. [HF lodestones/Chroma1-HD](https://huggingface.co/lodestones/Chroma1-HD), [ComfyUI_examples chroma](https://comfyanonymous.github.io/ComfyUI_examples/chroma/), [willitrunai Chroma](https://willitrunai.com/image-models/chroma-1)

### HiDream (HiDream-ai) — 2025 → 2026
- **HiDream-I1**: 17B, DiT+MoE, MIT license, Full/Dev/Fast variants — heaviest of the current open T2I options.
- **HiDream O1** (2026): "Pixel UiT" architecture, 8B, faster and more efficient than I1, described as modern/intelligent/fast with decent (not top-tier) quality. [DeepWiki supported model types](https://deepwiki.com/Comfy-Org/ComfyUI/4-supported-model-types), [ComfyUI_examples hidream](https://comfyanonymous.github.io/ComfyUI_examples/hidream/)

### SD 3.5 (Stability AI) — 2024, still supported
Large/Medium checkpoints, MMDiT architecture, triple text-encoder (CLIP-L + CLIP-G + T5-XXL). Superseded in most workflows by Flux/Qwen/Z-Image for quality-per-VRAM, but still used where the Stability community LoRA ecosystem matters. [ComfyUI_examples sd3](https://comfyanonymous.github.io/ComfyUI_examples/sd3/)

### SDXL + community bases (Illustrious / Pony Diffusion V6 XL / NoobAI XL) — 2023 base, thriving fine-tune ecosystem through 2026
Still the dominant stack for anime/illustration/character work because of LoRA depth. Early-2026 Civitai counts: ~4,500 Pony LoRAs, ~1,800 shared NoobAI/Illustrious LoRAs. Illustrious = cleaner linework/anatomy baseline; Pony = biggest style/character LoRA catalog; NoobAI = inherits Illustrious linework, further polish on hands/eyes/mouths. [techtactician Illustrious fine-tunes](https://techtactician.com/best-illustrious-xl-sdxl-anime-model-fine-tunes-comparison/), [aiofm Pony vs NoobAI](https://aiofm.info/en/guides/pony-vs-noobai)

### Lumina-Image 2.0 (Alpha-VLLM)
2.6B flow-based DiT, lightweight, "modern, passable" quality tier — a low-VRAM alternative when Z-Image/Flux won't fit. [DeepWiki supported model types](https://deepwiki.com/Comfy-Org/ComfyUI/4-supported-model-types)

### Nano Banana / Nano Banana 2 / Nano Banana Pro (Google Gemini image API, via ComfyUI partner/community nodes)
Not a local checkpoint — these are **API nodes** that call Google's Gemini image models (`gemini-2.5-flash-image-preview`, and the newer `gemini-3.1-flash-image-preview` = "Nano Banana 2"). Official partner node (`ComfyUI_Nano_Banana` via Comfy-Org blog) plus several community reimplementations. Supports T2I, I2I, multi-image fusion, grounding with web/image search, multi-turn chat. Billed per Gemini API token pricing, not local compute. [blog.comfy.org partner nodes](https://blog.comfy.org/p/nano-banana-via-comfyui-api-nodes), [GitHub ru4ls/ComfyUI_Nano_Banana](https://github.com/ru4ls/ComfyUI_Nano_Banana), [apiyi Nano Banana 2 tutorial](https://help.apiyi.com/en/nano-banana-2-comfyui-gemini-image-generation-tutorial-en.html)

---

## 2. Companion files per family

| Family | Diffusion/UNet file(s) | `models/` subdir | Text encoder(s) | `models/` subdir | VAE | Loader node(s) |
|---|---|---|---|---|---|---|
| Flux.1 dev/schnell | `flux1-dev.safetensors` / `flux1-schnell.safetensors` | `diffusion_models/` (dev) or `unet/` (schnell, per older docs) | `t5xxl_fp16.safetensors` + `clip_l.safetensors` | `text_encoders/` | `ae.safetensors` | `UNETLoader` + `DualCLIPLoader` + `VAELoader`; FP8-checkpoint variants (`flux1-dev-fp8.safetensors`, `flux1-schnell-fp8.safetensors`) load as one file via `CheckpointLoaderSimple` from `checkpoints/` [ComfyUI_examples flux](https://comfyanonymous.github.io/ComfyUI_examples/flux/) |
| Flux.2 Dev | `flux2_dev_fp8mixed.safetensors` | `diffusion_models/` | `mistral_3_small_flux2_bf16.safetensors` | `text_encoders/` | `flux2-vae.safetensors` | `UNETLoader` + `CLIPLoader`/`DualCLIPLoader` + `VAELoader` [docs.comfy.org flux-2-dev](https://docs.comfy.org/tutorials/flux/flux-2-dev) |
| Flux.2 Klein 4B/9B | `flux-2-klein-base-4b-fp8.safetensors` / `flux-2-klein-4b-fp8.safetensors` (etc.) | `diffusion_models/` | `qwen_3_4b.safetensors` | `text_encoders/` | `flux2-vae.safetensors` | `UNETLoader` + `CLIPLoader` + `VAELoader` [earngenix Flux2 Klein](https://www.earngenix.com/workflows/flux2-klein-image-comfyui) |
| Qwen-Image / Qwen-Image-Edit (incl. 2509/2512) | `qwen_image_fp8_e4m3fn.safetensors` / `qwen_image_edit_2509_fp8_e4m3fn.safetensors` (or GGUF equivalents) | `diffusion_models/` (or `unet/` in some community guides) | `qwen_2.5_vl_7b_fp8_scaled.safetensors` (shared across all Qwen-Image variants) | `text_encoders/` | `qwen_image_vae.safetensors` | `UNETLoader`/`UnetLoaderGGUF` + `CLIPLoader` + `VAELoader` [ComfyUI_examples qwen_image](https://comfyanonymous.github.io/ComfyUI_examples/qwen_image/), [comfyui-wiki Qwen-Image](https://comfyui-wiki.com/en/tutorial/advanced/image/qwen/qwen-image) |
| Z-Image Turbo/Base | Turbo/Base diffusion checkpoints (BF16/FP8/GGUF/NVFP4 builds ship day-of) | `diffusion_models/` | model-specific text encoder shipped alongside (bundled in official workflow) | `text_encoders/` | dedicated Z-Image VAE (bundled) | `UNETLoader` + `CLIPLoader` + `VAELoader`; GGUF via `UnetLoaderGGUF` [stablediffusiontutorials Z-Image](https://www.stablediffusiontutorials.com/2026/01/z-image.html), [docs.comfy.org Z-Image](https://docs.comfy.org/tutorials/image/z-image/z-image) |
| Chroma1-HD/Base | Chroma checkpoint (safetensors, fp8-scaled, or GGUF) | `diffusion_models/` | T5-XXL (shared with Flux) | `clip/` per official card (equivalent to `text_encoders/` in current builds) | Flux VAE (`ae.safetensors`) | `UNETLoader` + `CLIPLoader` + `VAELoader` [comfyui.nomadoor Chroma1-HD](https://comfyui.nomadoor.net/en/basic-workflows/chroma1-hd/) |
| HiDream I1/E1/O1 | `hidream_i1_dev_bf16.safetensors` / `hidream_i1_full_fp16.safetensors` / `hidream_e1_1_bf16.safetensors` / `hidream_e1_full_bf16.safetensors` | `diffusion_models/` | ALL FOUR needed: `clip_l_hidream.safetensors`, `clip_g_hidream.safetensors`, `t5xxl_fp8_e4m3fn_scaled.safetensors`, `llama_3.1_8b_instruct_fp8_scaled.safetensors` | `text_encoders/` | `ae.safetensors` (Flux VAE, reused) | `UNETLoader` + `QuadrupleCLIPLoader` + `VAELoader` [ComfyUI_examples hidream](https://comfyanonymous.github.io/ComfyUI_examples/hidream/) |
| SD 3.5 Large/Medium | single checkpoint `.safetensors` | `checkpoints/` | CLIP-L + CLIP-G + T5-XXL bundled or split | `text_encoders/` if split | bundled or `vae/` | `CheckpointLoaderSimple` (bundled) or `TripleCLIPLoader` + `UNETLoader` + `VAELoader` (split) [promptus SD3.5 setup](https://www.promptus.ai/blog/how-to-use-stable-diffusion-3-5-comfyui-setup-guide) |
| SDXL / Illustrious / Pony / NoobAI | single checkpoint `.safetensors` | `checkpoints/` | bundled CLIP-L + OpenCLIP-G | bundled | bundled | `CheckpointLoaderSimple` (one-file, classic A1111-style checkpoints) |
| Lumina-Image 2.0 | flow-DiT checkpoint | `diffusion_models/` | Gemma/T5-class encoder (model-specific) | `text_encoders/` | dedicated VAE | `UNETLoader` + `CLIPLoader` + `VAELoader` |

GGUF quantized builds of any of the above (Flux, Qwen-Image, Z-Image, Chroma, SDXL-family) load through **`ComfyUI-GGUF`** (city96): `UnetLoaderGGUF` (drop-in for `UNETLoader`/Load Diffusion Model), `CLIPLoaderGGUF`, `DualCLIPLoaderGGUF`, `TripleCLIPLoaderGGUF`, `UnetLoaderGGUFAdvanced`. DiT/transformer architectures (Flux-style) tolerate quantization far better than convolutional UNets. [GitHub city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)

---

## 3. Verified sampling settings per family

- **Flux.1 dev**: Euler sampler + simple scheduler, **20-28 steps**, guidance **3.5-5.0** via `FluxGuidance` node (NOT the KSampler `cfg` field). CFG in KSampler must stay at **1.0** — Flux bakes guidance into the model, so cfg > 1 washes the image out; keep guidance under ~6 for naturalistic results. [thundercompute Flux guide](https://www.thundercompute.com/blog/flux-comfyui-ai-image-generation), [comfyui-wiki Flux dev t2i](https://comfyui-wiki.com/en/tutorial/advanced/image/flux/flux-1-dev-t2i)
- **Flux.1 schnell**: distilled for speed — **1-8 steps** (community consensus lands on 4, some guides suggest 6-8), guidance ~3.5, Euler + normal/sgm_uniform/simple/beta scheduler; if output looks noisy/unfinished, **lower** the step count rather than raise it. [tech-insider Flux 2026](https://tech-insider.org/how-to-run-flux-locally-with-comfyui-2026/)
- **Flux.1 Kontext (editing)**: `FluxGuidance` value **2.5-6.0** — 1.5-2.5 for subtle edits/preserving the source image, 3.0-5.0 for stronger prompt adherence/dramatic changes, higher still for faces/logos/technical renders. Denoise **0.3-0.8** depending on how much of the source should survive. Chain multiple small edits rather than one drastic one. [comfyui-wiki Kontext](https://comfyui-wiki.com/en/tutorial/advanced/image/flux/flux-1-kontext), [runcomfy Kontext workflow](https://www.runcomfy.com/comfyui-workflows/flux-kontext-dev-comfyui-workflow-ai-image-editing-tool)
- **Flux.2 Dev/Klein**: same guidance-node pattern as Flux.1 (cfg 1.0 in KSampler, guidance via `FluxGuidance`); community default lands around 20-30 steps, Euler + simple, following the same "no classic CFG" rule as Flux.1. [thundercompute Flux guide](https://www.thundercompute.com/blog/flux-comfyui-ai-image-generation)
- **Qwen-Image (native, non-distilled)**: **~40-50 steps**, cfg **2.5-4.0**, sampler `euler` or `res_multistep`. Native resolution is 1328×1328 (also 928×1664 for 9:16, 1664×928 for 16:9), but running at native adds ~50% runtime over 1024×1024 for little visible gain at 40+ steps. If output looks blurry/broken, raise the model's `shift` parameter to **12-13**. [comfyui-wiki Qwen-Image](https://comfyui-wiki.com/en/tutorial/advanced/image/qwen/qwen-image), [nextdiffusion Qwen-Image-2512](https://www.nextdiffusion.ai/tutorials/create-stunning-images-with-qwen-image-2512-in-comfyui-t2i)
- **Qwen-Image (Lightning/distilled LoRA)**: **4-8 steps**, cfg **1.0**. [thundercompute Qwen-Image-Edit](https://www.thundercompute.com/blog/qwen-image-edit-comfyui)
- **Z-Image-Turbo**: 8-step distilled inference; benchmarked at ~4.8s for a 2K image on an RTX Pro 6000 Blackwell. [blog.comfy.org Z-Image Turbo](https://blog.comfy.org/p/z-image-turbo-in-comfyui-realism)
- **Z-Image-Base**: **30-50 steps** for optimal quality (it is the non-distilled counterpart to Turbo). [comfyui-wiki Z-Image-Base](https://comfyui-wiki.com/en/news/2026-01-28-alibaba-z-image-base-release)
- **Chroma1-HD**: **~40 steps**, guidance/cfg commonly cited between **3.0 and 7.0** depending on source (one official-style config uses cfg 4.0 with 40 steps/guidance 3.0; community threads push cfg to 6-7 for more saturation). Verify exact defaults in the workflow JSON before relying on a single number. [xugj520 Chroma1-HD](https://www.xugj520.cn/en/archives/chroma1-hd-open-source-ai-model.html), [willitrunai Chroma](https://willitrunai.com/image-models/chroma-1)
- **SD 3.5 Large**: **30-40 steps** (40 used as the de facto default), denoise 1.0 for T2I, triple-CLIP text encode (CLIP-L + CLIP-G + T5-XXL) feeding one merged conditioning. [promptus SD3.5](https://www.promptus.ai/blog/how-to-use-stable-diffusion-3-5-comfyui-setup-guide), [tech-insider SD3.5 2026](https://tech-insider.org/how-to-use-stable-diffusion-3-5-2026/)
- **SDXL / Illustrious / Pony / NoobAI**: classic SDXL defaults still apply — 20-35 steps, cfg 5-8, DPM++2M/Euler-a + Karras, native 1024×1024 (or SDXL bucket resolutions). *(Not independently re-verified this session — this is the standard, long-stable SDXL default and did not change with the 2026 fine-tunes; flag as carried-forward if precision matters.)*
- **HiDream**: no numeric sampler defaults surfaced in the ComfyUI official example page during this research pass — treat as **unverified**; the four-encoder requirement (CLIP-L, CLIP-G, T5-XXL, Llama-3.1-8B) is confirmed. [ComfyUI_examples hidream](https://comfyanonymous.github.io/ComfyUI_examples/hidream/)

---

## 4. Distilled / turbo / lightning variants

| Variant | Pairs with | Steps | CFG | Notes |
|---|---|---|---|---|
| **DMD2** (Distribution Matching Distillation, LoRA form) | SDXL, Pony, Illustrious | 4 (common LoRA ships as `dmd2_sdxl_4step_lora`) | raise cfg if output looks washed out/bland | Works as a standard LoRA — doesn't itself speed up sampling, just makes fewer steps viable. Also exists as a full standalone workflow (not just LoRA). [sandner.art DMD2](https://sandner.art/distribution-matching-distillation-photorealism-in-lesser-steps-comfyui-workflow-and-lora-solution/), [civitai DMD2 LoRA](https://civitai.com/models/1608870/dmd2-speed-lora-sdxl-pony-illustrious) |
| **Hyper-SD** (ByteDance) | SD1.5, SDXL | 1-8 (unified LoRA via `ComfyUI-TCD` custom node adds `TCDScheduler`) | CFG-preserved 8-step variant supports **cfg 5-8**; other step-counts typically cfg 1 | Tune the `eta` parameter in `TCDScheduler` for quality. [HF ByteDance/Hyper-SD](https://huggingface.co/ByteDance/Hyper-SD) |
| **Qwen-Image Lightning LoRA** | Qwen-Image / Qwen-Image-Edit | 4 steps (bump to 6 for slightly better quality) | 1.0 | [thundercompute Qwen-Image-Edit](https://www.thundercompute.com/blog/qwen-image-edit-comfyui) |
| **Wan 2.2 rapid/distill LoRAs** (e.g. lightx2v Moe-Distill) | Wan 2.2 14B I2V/T2V | as low as 2 steps per (high, low) stage, or 4/8-step splits when combined with regular LoRAs | 1.0 | Community "AllInOne" merges (e.g. `Phr00t/WAN2.2-14B-Rapid-AllInOne`) bake distillation directly into the checkpoint. [HF lightx2v Wan2.2 discussion](https://huggingface.co/lightx2v/Wan2.2-I2V-A14B-Moe-Distill-Lightx2v/discussions/3) |
| **MiniMax H3 Turbo LoRA** (Lightx2v/ModelTC) | MiniMax H3 (video+audio) | 4-step FL2V distillation (down from ~20) | guidance handled by the adapter | Released Aug 2026. [comfyui-wiki H3 Turbo LoRA](https://comfyui-wiki.com/en/news/2026-08-07-minimax-h3-turbo-lightx2v) |
| **MiniMax H3 Acc (PDD) LoRA** | MiniMax H3 | 8 (default/trained block size), 4 (officially sanctioned regroup), or 6 (non-uniform 8,8,4,4,4,4 partition) | 1.0, single forward pass per step | Official 8-step PDD distillation, Aug 2026. [comfyui-wiki H3 PDD LoRA](https://comfyui-wiki.com/en/news/2026-08-26-minimax-h3-pdd-acc-lora) |

No independently-verifiable source for a distillation method literally named **"Nitro"** turned up this session — if a project references it, confirm the exact repo/paper before using it; it may be a rebrand of one of the above or a closed/proprietary technique.

---

## 5. Video and audio models

### Wan 2.2 (Alibaba) — current mainline as of Sep 2026
Dual high-noise/low-noise 14B model pair for T2V and I2V (separate checkpoints per stage, switched mid-sampling), plus a 5B TI2V variant. [docs.comfy.org Wan2.2](https://docs.comfy.org/tutorials/video/wan/wan2_2)
- Files: `wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors` + `wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors` (T2V); `wan2.2_i2v_high_noise_14B_fp16.safetensors` + low-noise counterpart (I2V) → `diffusion_models/`. Shared VAE `wan_2.1_vae.safetensors` → `vae/`; shared text encoder `umt5_xxl_fp8_e4m3fn_scaled.safetensors` → `text_encoders/`. [docs.comfy.org Wan2.2](https://docs.comfy.org/tutorials/video/wan/wan2_2)
- Settings: Euler sampler + simple scheduler + **shift 5** is the commonly-cited safe combination; full (non-distilled) runs typically use higher step counts, while several rapid/distilled community merges run as low as 2-4 steps per stage at cfg 1. Sampler/scheduler choice materially changes output quality for this family — don't assume defaults port from SDXL. *(Numeric step/cfg claims here are less consistent across sources than for Flux/Qwen — treat as approximate.)* [stable-diffusion-art Wan2.2](https://stable-diffusion-art.com/wan-2-2-text-to-video/)
- VRAM: 5B fits **6-8GB** with native ComfyUI ram offloading; 14B wants **24GB+** for 480p/720p. Q4/Q5 GGUF + T5 CPU offload gets 14B down to **~6-8GB VRAM** at 480p, but wants **24-32GB system RAM**. [willitrunai Wan VRAM](https://willitrunai.com/blog/wan-2-2-vram-requirements), [runpod Wan2.2](https://www.runpod.io/articles/guides/comfyui-wan-2-2)
- **Wan VACE** (2.1 and a 2.2 block-set): unifies T2V, reference-to-video, video-to-video (pose/depth control), inpainting/outpainting in one framework via a dedicated VACE diffusion model (not the plain T2V checkpoint) — 14B is the primary size. VACE 2.2 ships as extra blocks layered onto the (frozen) 2.2 base, mainly intended for `WanVideoWrapper`-style pipelines. [docs.comfy.org VACE](https://docs.comfy.org/tutorials/video/wan/vace), [stable-diffusion-art VACE ref](https://stable-diffusion-art.com/wan-vace-ref/)
- **Wan 2.5**: as of the most recent confirmation this session, **no publicly downloadable Wan 2.5 weights** exist yet for self-hosted ComfyUI use — 2.2 remains the latest self-deployable version; treat any "Wan 2.5 ComfyUI" guide as either speculative or referring to a closed API. [thundercompute Wan2.2 guide](https://www.thundercompute.com/blog/wan-2-2-comfyui-ai-video-model)

### LTX-2.3 (Lightricks) — March 5, 2026
Open-weights video+audio engine, Day-0-adjacent native ComfyUI support (merged March 2026). Single diffusion pass produces synchronized video **and** audio. Up to **4K at 50fps**, up to **20 seconds** of footage. 22B dev model needs **32GB+** VRAM at BF16; FP8 checkpoint + FP4-mixed Gemma text encoder + sequential CPU offload gets it to **16GB**; **40GB** is the realistic minimum for comfortable 1080p. On 16GB cards, 512×512/4-6s is workable with occasional OOM on aggressive motion; 24GB+ handles 768×432–768×768 at 5-8s smoothly. Motion-heavy clips benefit from higher fps (up to 50); static shots can drop to 15fps to save compute. Lower-end fallback: 4s @720p (16GB) or 3s @540p (12GB). [thundercompute LTX-2.3](https://www.thundercompute.com/blog/ltx-2-3-comfyui), [ltxworkflow VRAM tiers](https://ltxworkflow.com/resources/community/ltx-23-vram-requirements-12gb-16gb-24gb), [nvidia LTX-2 quickstart](https://www.nvidia.com/en-sg/geforce/news/rtx-ai-video-generation-guide/)

### HunyuanVideo 1.5 (Tencent)
Runs on a single RTX 4090 from **~14GB VRAM** with FP8 + CPU offload (down from ~47GB unquantized). 129 frames @ 24fps at FP16 in the original HunyuanVideo; 1.5 is regarded as leading on cinematic motion quality among open video models. ~6 minutes per clip on an RTX 4090. [thundercompute video models 2026](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models), [comfyonline video comparison](https://www.comfyonline.app/blog/open-source-video-generation-models-comparisons)

### Mochi 1 (Genmo)
~20GB at FP8; ~8 minutes per generation on an RTX 4090; noted for strong fine-tuning/LoRA-training support. [comfyonline video comparison](https://www.comfyonline.app/blog/open-source-video-generation-models-comparisons)

### CogVideoX (Zhipu/THUDM)
5B variant runs on 24GB; 2B variant on 16GB. Noted for strong prompt adherence relative to its size class. [thundercompute video models 2026](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models)

### MiniMax H3 — Aug 3, 2026
Omni-modal generation (text/image/video/audio together); generates video with **native stereo audio** (voice, SFX, music) in a single forward pass. Open-sourced and merged into ComfyUI natively the same day. Has both a still-image mode (`ComfyUI-MiniMax-H3-Image-Studio`) and 4/8-step Turbo/Acc distilled LoRAs (see §4). [comfyui-wiki MiniMax H3](https://comfyui-wiki.com/en/tutorial/advanced/video/minimax/minimax-h3)

### Audio

- **ACE-Step** (StepFun + ACE Studio, Apache 2.0): open music generation foundation model — text-to-music, cover/remix, repaint, multilingual (19 languages), voice cloning, lyric editing. Native ComfyUI node since May 2025; **v1.5 released Jan 28, 2026** is current. [GitHub ace-step/ACE-Step](https://github.com/ace-step/ACE-Step), [comfyui-wiki ACE-Step](https://comfyui-wiki.com/en/tutorial/advanced/audio/ace-step/ace-step-v1)
- **Stable Audio Open 1.0** (Stability AI): all-in-one checkpoint (diffusion + text encoder + VAE bundled), runs fully local, composable with ControlNets/LoRAs/upscalers inside ComfyUI. [comfy.org Stable Audio Open 1.0](https://comfy.org/p/supported-models/stable-audio-open-1-0/)
- **Stable Audio 3.0** (May 20, 2026): current flagship, trained on fully-licensed music data, commercially licensed. Ships Small-SFX, Small-Music, and Medium variants via a dedicated subgraph node; template shipped Day-0 in the ComfyUI template library's Audio category. [blog.comfy.org Stable Audio 2.5→3](https://blog.comfy.org/p/stable-audio-25-is-now-in-comfyui), [comfyuitemplates Stable Audio 3.0](https://comfyuitemplates.com/blog/stable-audio-30-day-0-support-in-comfyuifrom-sound-effects-to-longer-more-musical-tracks/)

### Realistic on a 36GB unified-memory Apple M4 Max
- **Fits comfortably**: Wan 2.2 5B (t2v/i2v), Z-Image Turbo/Base, Flux.1/Flux.2 Klein (4B) at fp16 or fp8, Qwen-Image with fp8 or GGUF, SDXL-family, HunyuanVideo 1.5 with FP8+offload, CogVideoX-2B, Mochi 1 at fp8 (~20GB).
- **Fits but tight / needs quantization or offload**: Flux.1 dev fp16 (~24GB checkpoint footprint is fine at 36GB but leaves little headroom for a 4K VAE decode or a second model resident), Wan 2.2 14B (GGUF Q4/Q5 recommended over fp16/fp8 at this memory budget), CogVideoX-5B, HiDream I1 (17B + four text encoders is a lot of resident weight even before the diffusion pass), LTX-2.3 FP8 (documented 16GB minimum, but 1080p+ output wants closer to 40GB — expect to cap resolution/length).
- **Realistically out of reach at 36GB**: LTX-2.3 BF16 dev (32GB+ *just* for the model, before VAE/text-encoder overhead — thin margin, risk of OOM at anything but short/low-res clips), MiniMax H3 full pipeline at native settings, HiDream Full (fp16) alongside its four encoders.
- Apple Silicon runs via PyTorch **MPS**, not CUDA — expect slower per-step wall time than an equivalent-VRAM Nvidia card, but the unified-memory pool means **no hard "out of VRAM" wall** the way discrete GPUs have; a 64GB Mac config can load Flux dev fp16 (~33GB) with zero quantization. [heyuan110 Mac Mini M4 benchmark](https://www.heyuan110.com/posts/ai/2026-02-15-mac-mini-local-image-generation/), [willitrunai M4 Max for AI](https://willitrunai.com/blog/m4-max-for-ai-local-models)

---

## 6. VRAM / memory tier table

| Tier | What runs | Notes |
|---|---|---|
| **≤8GB** | SDXL/Illustrious/Pony/NoobAI (fp16 checkpoint), Flux.1 schnell/dev via Q2_K-Q4_0 GGUF (4.15-6.32GB) + Lightning/Turbo LoRA, Qwen-Image at Q2_K/Q3_K_S with Lightning LoRA (soft/lower quality), Z-Image Turbo (designed for ~16GB but degrades gracefully lower with quantization), Wan 2.2 5B and Wan 2.2 14B GGUF Q3-Q4 + T5 CPU-offload at 480p | Below this, plan on aggressive GGUF quantization + CPU offload everywhere; expect visible quality loss. [thundercompute Qwen guide](https://www.thundercompute.com/blog/qwen-image-edit-comfyui), [willitrunai Wan VRAM](https://willitrunai.com/blog/wan-2-2-vram-requirements) |
| **12-16GB** | Flux.1 dev fp8 checkpoint (~17.2GB is tight even here — prefer GGUF Q4-Q5 or the fp8 split files), Flux.2 Klein 4B (fits a 12GB card) and 9B fp8 (~15GB, "sweet spot" for 16GB), Qwen-Image fp8 ("sweet spot" at 16GB, near-full quality without GGUF), Z-Image Turbo (native target), Chroma1-HD fp8/GGUF, HunyuanVideo 1.5 fp8+offload (~14GB), CogVideoX-2B, LTX-2.3 512×512 4-6s clips (16GB, occasional OOM on heavy motion) | This is the most crowded, best-value tier for current-gen models. [localaimaster Flux2 local](https://localaimaster.com/blog/flux-2-local-setup-guide), [thundercompute Qwen](https://www.thundercompute.com/blog/qwen-image-edit-comfyui) |
| **24GB** | Flux.1 dev full fp8/fp16 comfortably, HiDream I1 (with care on encoder residency), SD3.5 Large, Wan 2.2 14B fp8 at 480-720p, LTX-2.3 768×432-768×768 5-8s "smoothly", Mochi 1 (~20GB fp8), CogVideoX-5B, Chroma1-HD fp16 (~7.3s/1024px on a reference RTX 4090 at 28 steps), SenseNova U1.5 T2I (~17GB peak) | The reference "does everything reasonably" desktop-GPU tier (RTX 3090/4090-class). [willitrunai Chroma](https://willitrunai.com/image-models/chroma-1), [comfyui-wiki SenseNova](https://comfyui-wiki.com/en/news/2026-08-16-sensenova-u1-5-comfyui) |
| **36GB+ unified (Apple Silicon)** | See the Apple-specific breakdown above — most current image models fp8/fp16, most video models with quantization/offload; LTX-2.3 BF16 dev and full-precision HiDream/MiniMax H3 are the realistic ceiling-breakers | MPS backend, not CUDA — slower per step, but no hard VRAM wall; 64GB+ configs can run Flux dev fp16 natively with zero quantization. [heyuan110](https://www.heyuan110.com/posts/ai/2026-02-15-mac-mini-local-image-generation/) |
| **40GB+ / multi-GPU / datacenter** | LTX-2.3 BF16 dev at comfortable 1080p, HiDream Full fp16 + all four encoders resident, MiniMax H3 at full native settings, batch/production Wan 2.2 14B fp16 pipelines | [thundercompute LTX-2.3](https://www.thundercompute.com/blog/ltx-2-3-comfyui) |

---

## 7. Verified on 2026-09-11 / unverified claims

**Verified this session (cited above, cross-checked against docs.comfy.org, comfyanonymous GitHub Pages, blog.comfy.org, comfyui-wiki, or Hugging Face model cards):**
- Flux.2 family timeline/licensing, Flux.2 Klein file layout and VRAM figures
- Krea 2 open-source date and architecture claim
- Z-Image Turbo (Nov 2025) and Z-Image-Base (Jan 2026) release dates, license, step counts
- Qwen-Image/Qwen-Image-Edit file names, directories, encoder sharing, Lightning LoRA steps/cfg
- Flux.1 dev/schnell file names, directories, license, FluxGuidance-vs-cfg behavior
- Flux.1 Kontext guidance-value ranges
- Chroma1-HD/Base architecture lineage, license, file placement
- HiDream I1/O1 architecture, encoder requirement (four encoders), file names
- SD3.5 triple-CLIP requirement and step count range
- SDXL-era community bases (Illustrious/Pony/NoobAI) still-active status and rough LoRA counts (early-2026 snapshot)
- ComfyUI-GGUF node names (`UnetLoaderGGUF`, `CLIPLoaderGGUF`, `DualCLIPLoaderGGUF`, `TripleCLIPLoaderGGUF`)
- Wan 2.2 file names/directories, dual high/low-noise architecture, VACE framing
- LTX-2.3 release date, native audio+video claim, resolution/fps ceiling, VRAM tiers
- HunyuanVideo 1.5, Mochi 1, CogVideoX VRAM figures and relative-strength claims (per one comparison source — see below)
- MiniMax H3 release date and native-ComfyUI-support date, Turbo/Acc LoRA step counts
- ACE-Step v1.5 (Jan 2026) and Stable Audio 3.0 (May 2026) release dates and license/commercial status
- SenseNova U1.5 architecture, VRAM, release timeline
- ComfyUI v0.35.0 (Sep 9, 2026) changelog highlights (Pixal3D Multi-View, SenseNova U1.5, MiniMax-H3 PDD LoRA)

**Explicitly unverified / low-confidence — confirm before depending on these:**
- Exact numeric sampler defaults for **HiDream** (steps/cfg/sampler/scheduler) — no source surfaced concrete numbers this session.
- Precise Chroma1-HD cfg default — sources disagree (3.0-4.0 vs 6-7); pull the actual default from the shipped workflow JSON rather than trusting a blog number.
- Wan 2.2 numeric step/cfg defaults for the *non-distilled* full pipeline — sources were inconsistent (2-step-per-stage claims conflict with 4/8-step-split claims elsewhere); the "Euler + simple + shift 5" combination is the most consistently repeated claim but wasn't found in Comfy's own docs page.
- SDXL/Illustrious/Pony/NoobAI numeric sampler defaults in this doc are carried forward from long-standing SDXL convention, not re-verified against a 2026 source specifically.
- The existence of a distillation technique literally named **"Nitro"** — not found; do not assume it exists under that name.
- Wan 2.5: could not confirm any public self-hostable release as of this session; treat as either API-only or not yet shipped.
- HunyuanVideo/Mochi/CogVideoX relative-quality rankings ("leads on cinematic motion," "leads on prompt adherence," etc.) come from a single comparison-site source (comfyonline) and should be treated as one reviewer's opinion, not an industry consensus.
- File-size figures for Flux.2 Dev's `flux2_dev_fp8mixed.safetensors`, and for most Qwen-Image/Z-Image/Chroma/HiDream individual files, were not directly confirmed — direct GB figures were unavailable in the fetched pages within this session's time budget; check the Hugging Face file listing directly before writing exact numbers into a workflow doc.
