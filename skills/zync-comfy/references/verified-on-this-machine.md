# Verified on this machine — Sabir's Mac, 2026-09-11

Findings proven by reading the installed source or by an actual crash here, not from
the web. These outrank any general guide.

## Contents

- [Hardware and installs](#hardware-and-installs)
- [fp8 + LoRA is impossible on MPS](#fp8--lora-is-impossible-on-mps-verified-in-source)
- [Which quantizations DO accept a LoRA on MPS](#which-quantizations-do-accept-a-lora-on-mps)
- [Memory reality at 36 GB unified](#memory-reality-at-36-gb-unified)
- [Two installs, three model roots](#two-installs-three-model-roots)

## Hardware and installs

| Fact | Value |
|---|---|
| Chip / memory | Apple M4 Max, 36 GB unified (`vram state: SHARED`) |
| macOS | Darwin 25.5 / Mac Version (26, 5, 2) |
| Desktop app install | `/Users/sabiridwan/ComfyUI-Installs/ComfyUI (1)/ComfyUI` — ComfyUI 0.35.1, python 3.13.12, torch 2.12.1 |
| comfy-cli install | `/Users/sabiridwan/ComfyUI-Installs/ComfyUI/ComfyUI` — ComfyUI 0.35.0, python 3.12.11, comfy-cli 1.20.0 |
| Which one comfy-mcp drives | **split, and this matters.** Server-backed reads (`search_models`, `nodes`, `system_stats`, `validate_workflow`, `run_workflow`) go over HTTP to whatever is live on **port 8188** — usually the Desktop app. Write/launch verbs (`download_model`, `launch_comfyui`, `install_node`) act on the **cli workspace**. Check `server_info` + the `url` field in a tool's reply to know which one answered. |
| Shared models root | `/Users/sabiridwan/ComfyUI-Shared/models` |
| comfy_kitchen backends available | `eager` only. `cuda`, `hip`, `triton` all unavailable — expected on Apple. |
| comfy-aimdo | logs `unsupported operating system: Darwin`. Harmless, ignore it. |

The path `ComfyUI (1)` contains a space and parentheses. Quote it in every shell command.

## fp8 + LoRA is impossible on MPS (verified in source)

**Symptom**, at KSampler, ~56 s in, after the model loads fine:

```
TypeError: Trying to convert Float8_e4m3fn to the MPS backend but it does not have support for that dtype.
```

**Why**, from the installed code:

- `comfy/model_patcher.py:899` — `patch_weight_to_device` returns the weight untouched
  when `key not in self.patches`. This is why a plain fp8 model works: nothing is
  written back, and compute runs in bf16 via manual cast (`model weight dtype
  torch.float8_e4m3fn, manual cast: torch.bfloat16`).
- `comfy/model_patcher.py:918` — once a key **does** have patches (any LoRA, any model
  patch), the merged weight must be written back in the *original* dtype:
  `comfy.float.stochastic_rounding(out_weight, weight.dtype, ...)`.
- `comfy/float.py:72-77` — `weight.dtype` of `float8_e4m3fn` routes into the fp8 path,
  ending at `sign.to(torch.float8_e4m3fn)` on an MPS tensor. Torch has no fp8 dtype on
  MPS, so it raises. The non-comfy_kitchen fallback a few lines down does
  `torch.empty_like(value, dtype=dtype)` and fails identically — **both** branches are
  dead on Apple Silicon.

**Therefore:** on MPS, a raw-fp8 `.safetensors` diffusion model plus any LoRA is a hard
architectural failure. No launch flag, torch version, or memory setting changes it.
Do not waste time on `--force-fp16`, `--fp32-vae`, or `PYTORCH_ENABLE_MPS_FALLBACK`.

**The two real fixes:**

1. Remove the LoRA (bypass with Ctrl+B) and retune — a 4/8-step Lightning LoRA's
   settings are wrong without it, so go back to the base model's steps and cfg.
2. Replace the fp8 file with a quantization whose ops expose `set_weight` — GGUF or
   int8. See below.

The first real occurrence here: `qwen_image_edit_2509_fp8_e4m3fn.safetensors` (19 GB)
plus `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` (811 MB).

## Which quantizations DO accept a LoRA on MPS

`comfy/model_patcher.py:216-231` (`get_key_weight`) looks for a `set_<param>` method on
the owning module, and `:928` returns through `set_func(...)` when one exists —
**skipping `stochastic_rounding` entirely**. So the rule is:

| Weight format | LoRA on MPS | Why |
|---|---|---|
| raw fp8_e4m3fn / fp8_e5m2 safetensors | **breaks** | plain `Parameter`, no `set_weight`, forced fp8 write-back |
| GGUF (via ComfyUI-GGUF) | works | GGUF ops implement `set_weight`; dequant to compute dtype |
| int8 / mixed-precision with quantization metadata | works | loads through `MixedPrecisionOps`, which owns its setters. This machine's Qwen text encoder proves it: it loaded and patched fine in the same run that crashed on the diffusion model (`Found quantization metadata version 1` / `Using MixedPrecisionOps for text encoder`) |
| bf16 / fp16 | works | `stochastic_rounding` short-circuits for these dtypes at `float.py:66-71` |
| int8 kernels present on this Mac? | yes | comfy_kitchen `eager` reports `quantize_int8_*`, `dequantize_int8_*`, `int8_linear`, `w4a8_int8_linear` |

Practical consequence: **prefer GGUF or int8 builds over fp8 on this machine, always.**
fp8 buys nothing here — MPS has no fp8 math either way, so it is dequantized to bf16 for
compute regardless, and it forecloses LoRAs.

For a 20B-class model on 36 GB: GGUF `Q5_K_M` for quality, `Q4_K_M` (~13 GB) when memory
is tight. Full bf16 of a 20B model is ~40 GB and does not fit.

## Memory reality at 36 GB unified

The crashing run started with **16.3 GB free of 36 GB** — the rest was other apps. A
19 GB fp8 model plus a 7.9 GB text encoder does not fit in that, so even the
dtype-correct version of that workflow would have swapped hard.

Before any big run:

1. `system_stats` → read `vram_free`, not `vram_total`.
2. `free_memory` (it is applied when the queue worker next iterates, so re-check).
3. Quit browsers. On a shared-memory Mac, "VRAM" is the same RAM Chrome is using.
4. Prefer the smaller quant. A Q4 that fits beats a Q8 that swaps by a wide margin.

`vram state: SHARED` in the log is normal and correct on Apple Silicon — it is not a
misconfiguration to fix.

## Model paths are now unified (fixed 2026-09-11)

Both installs read one tree: **`/Users/sabiridwan/ComfyUI-Shared/models`**.

| Install | How it points there |
|---|---|
| Desktop app | `~/Library/Application Support/Comfy Desktop/instance-model-paths/inst-*.yaml`, `comfy.desktop_0.base_path`, `is_default: true`. Auto-generated — **never hand-edit it**; the app rewrites it. |
| comfy-cli | `/Users/sabiridwan/ComfyUI-Installs/ComfyUI/ComfyUI/extra_model_paths.yaml`, block `zync_shared`, `is_default: true`. Written by hand, mirrors the Desktop key set (40 folder types). |

Verified by loading the cli install's own `folder_paths` with that config: `checkpoints`,
`loras` and `diffusion_models` all resolve to the shared files.

Leftovers, deliberately harmless:

- The Desktop config also registers a second root, `~/Documents/ComfyUI/models`. It is
  empty and auto-generated; leave it alone.
- The cli workspace still has its own `models/` tree, now empty of real files, listed
  *after* the shared root in `get_folder_paths`. Anything landing there still works, it
  is just no longer where things go.
- The 2 GB `v1-5-pruned-emaonly-fp16.safetensors` was moved from the cli tree into
  `ComfyUI-Shared/models/checkpoints/` so `generate_image`'s default template keeps
  working from either install.

**The rule:** every new download goes to `~/ComfyUI-Shared/models/<type>/`.
`download_model` with `relative_path` writes into the **cli workspace**, not the shared
tree — so for anything you intend to keep, download to the shared path directly (curl /
hf CLI) or move it afterwards, then confirm with `search_models`.

Input/output dirs are still **not** unified: Desktop uses `~/Documents/ComfyUI/{input,output}`,
the cli uses its workspace. Outputs therefore land in different places depending on which
server ran the job — check `fetch_outputs`' reported paths rather than assuming.
