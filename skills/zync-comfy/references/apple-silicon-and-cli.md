# ComfyUI on Apple Silicon (MPS) + comfy-cli — Reference

Target machine: Apple M4 Max, 36 GB unified memory, macOS Darwin 25.5
(Darwin 25.x = macOS 26 "Tahoe"), ComfyUI via comfy-cli at
`/Users/sabiridwan/ComfyUI-Installs/ComfyUI/ComfyUI`, Python 3.12.

Researched September 2026. Every claim below is either sourced inline or
marked **[unverified]**. Where sources conflicted or a search tool summarized
rather than quoted, that is noted — treat those points as directional, not
exact.

## Table of contents

1. [Launch flags that matter on MPS](#1-launch-flags-that-matter-on-mps)
2. [PyTorch MPS reality check](#2-pytorch-mps-reality-check)
3. [Realistic performance numbers on Apple Silicon](#3-realistic-performance-numbers-on-apple-silicon)
4. [comfy-cli command reference](#4-comfy-cli-command-reference)
5. [Model storage layout and sharing](#5-model-storage-layout-and-sharing)
6. [macOS-specific failure modes](#6-macos-specific-failure-modes)
7. [Sensible defaults block for this machine](#7-sensible-defaults-block-for-this-machine)

---

## 1. Launch flags that matter on MPS

Source: [`comfy/cli_args.py`](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/cli_args.py) (authoritative, fetched directly) and [docs.comfy.org startup-flags](https://docs.comfy.org/development/comfyui-server/startup-flags).

### Nvidia/CUDA-only — useless or inert on Apple Silicon, don't cargo-cult these

| Flag | Why it's Nvidia-only |
|---|---|
| `--disable-xformers` | xformers is a CUDA memory-efficient-attention library; it isn't installed/usable on MPS, so there's nothing to disable. No-op on Mac. |
| `--cuda-malloc` / `--disable-cuda-malloc` | Controls `cudaMallocAsync`, a CUDA allocator feature. No effect without a CUDA device. |
| `--disable-cuda-graphs` | CUDA graphs don't exist on MPS. No-op. |
| `--cuda-device` | Selects a CUDA device index. Meaningless with no CUDA device present. |
| `--enable-triton-backend` / `--disable-triton-backend` | Triton backend (comfy-kitchen) targets CUDA/ROCm kernels. |
| `--use-sage-attention`, `--use-flash-attention`, `--use-ck-attention` | SageAttention/FlashAttention/CK are CUDA (and in Flash's case, also ROCm) kernels with no official MPS implementation. Selecting them on a Mac either errors or silently falls through — don't rely on it. There are third-party community MPS ports of flash-attention ([mps-flash-attention](https://github.com/mpsops/mps-flash-attention), [mps-flash-attn on PyPI](https://pypi.org/project/mps-flash-attn/0.1.10/)) but these are **not** what ComfyUI's built-in `--use-flash-attention` flag wires up — installing the pip package doesn't make the CLI flag work; it's a separate integration effort. **[unverified beyond what's stated in the package listings]** |
| `--directml` | DirectML is a Windows/DirectX backend. Never applies on macOS. |
| `--oneapi-device-selector` | Intel oneAPI (XPU) device selection. Not applicable. |
| `--supports-fp8-compute` | Forces ComfyUI to assume the device does fp8 *compute* (matmul) support — true on recent Nvidia (Ada/Hopper/Blackwell), not true for Metal (see §2 on fp8). Forcing this on Mac risks wrong-result kernels rather than a clean error. |
| `--windows-standalone-build` | Windows packaging convenience flag only. |

### Cross-platform but MPS-relevant — these are the ones worth tuning

| Flag | What it does | When to use it on this machine |
|---|---|---|
| `--force-fp16` | Forces fp16 precision globally. | Historically recommended for older MPS/PyTorch where bf16 support was incomplete. On current PyTorch (2.13, see §2) bf16 works natively on MPS, so you usually don't need this — but some users still report it stabilizing certain custom-node paths. Test per-workflow; a GitHub issue shows `--force-fp16` alone crashing the KSampler on M1 in some configs ([issue #2217](https://github.com/Comfy-Org/ComfyUI/issues/2217)), so don't apply it reflexively. |
| `--fp16-vae` vs `--fp32-vae` / `--bf16-vae` | Runs the VAE decode step in a given precision. `--fp16-vae` help text literally says "might cause black images." | If you see black/NaN output after decode, switch to `--fp32-vae` or `--bf16-vae` first — this is the single most common "black image" fix, MPS or not. |
| `--use-split-cross-attention` | Split (chunked) cross-attention optimization, memory-saving. | Fallback if you hit MPS OOM (§6) and want to trade speed for lower peak memory. Ignored if xformers is active (it never is on Mac, so this is live whenever selected). |
| `--use-pytorch-cross-attention` | Uses PyTorch 2.0's native `scaled_dot_product_attention`. | **Generally the best default on MPS** — multiple sources (including [workflowlab.dev's MPS speed-fix writeup](https://www.workflowlab.dev/deploy/comfyui-mac-apple-silicon-mps-speed)) point to this as the better-optimized path for Metal versus the split/quad fallback kernels, since SDPA gets Apple's own Metal-accelerated implementation. Start here. |
| `--use-quad-cross-attention` | Sub-quadratic attention, another memory/speed tradeoff. | Rarely needed on 36 GB unified memory; try only if pytorch-cross-attention OOMs and split doesn't help enough. |
| `--disable-smart-memory` | "Force ComfyUI to aggressively offload to regular ram instead of keeping models in vram when it can." | On Apple Silicon, VRAM *is* the same physical RAM (unified memory), so smart memory's normal VRAM/RAM split logic is somewhat academic — but it still governs whether ComfyUI proactively evicts model weights between graph runs. If you're juggling multiple large models in one workflow and see MPS OOM, try disabling smart memory so ComfyUI offloads more eagerly. If you have headroom and want to avoid repeated reload overhead between generations, leave smart memory on (default). |
| `--lowvram` / `--normalvram` / `--highvram` / `--gpu-only` / `--novram` / `--cpu` | VRAM residency strategy, mutually exclusive. | On 36 GB unified memory, `--highvram`/`--gpu-only`-style "keep everything resident" behavior is usually fine and fastest since there's no separate VRAM pool to overflow — but "VRAM" here still means "chunk of unified RAM the allocator has claimed," so keeping everything resident does compete with the OS and other apps. `--lowvram` forces text encoders to CPU — useful if you're running Flux (large T5-XXL) alongside other memory pressure and want to keep the diffusion model itself on GPU. `--cpu` disables MPS entirely (see below) — last resort only, extremely slow. |
| `--reserve-vram <GB>` | Reserves N GB of VRAM for OS/other apps, so ComfyUI's allocator doesn't try to claim all of it. | On unified memory this is a genuinely useful safety margin — e.g. `--reserve-vram 4` leaves 4 GB for macOS + your open apps so you don't tip into swap. Recommended on a 36 GB machine that's also your daily driver. |
| `--preview-method <none\|auto\|latent2rgb\|taesd>` | Controls live preview generation during sampling. Default is `none`. | Cosmetic/UX only — `taesd` gives nicer previews at a small speed cost; `none` is fastest. Not MPS-specific but worth knowing it defaults off. |
| `--listen` / `--port` | Bind address/port for the web server. Default listen is `127.0.0.1`; default port `8188`. | Use `--listen 0.0.0.0` (or a LAN IP) if you want to hit ComfyUI from another device on your network; see §6 for the "port already in use" failure mode. |
| `--front-end-version [owner]/[repo]@[version]` | Pins/overrides the served frontend build, default `comfyanonymous/ComfyUI@latest`. | Useful to pin a known-good frontend if a nightly frontend update breaks something; not MPS-specific. |
| `--force-channels-last` | Forces channels-last memory format. | Channels-last is primarily a CUDA/cuDNN throughput optimization; effect on MPS is unclear from sources found — treat as experimental on Mac. **[unverified for MPS benefit]** |
| `--fast [fp16_accumulation fp8_matrix_mult cublas_ops autotune]` | Opt-in "untested, potentially quality-deteriorating" optimizations. | `fp8_matrix_mult` and `cublas_ops` are CUDA-specific paths and won't help (or may error) on MPS; `fp16_accumulation` might apply generically. Don't reach for this bundle on Mac without testing each sub-flag. |

### `--cpu`

Full CPU fallback, bypassing MPS entirely. Confirmed real flag (`"To use the CPU for everything (slow)."`). Use only to isolate whether a bug is MPS-specific (if `--cpu` fixes it, the bug is in the MPS path) — not a practical way to run models given the speed numbers in §3.

There is **no** dedicated `--mac-max-memory` flag in the current `cli_args.py` — an early web-search summary mentioned one, but the direct fetch of the source file does not contain it. Treat any reference to `--mac-max-memory` as **stale/unverified**; memory headroom on Mac is controlled via `--reserve-vram`, `--disable-smart-memory`, and the `PYTORCH_MPS_HIGH_WATERMARK_RATIO` env var (§2), not a Mac-only CLI flag.

---

## 2. PyTorch MPS reality check

### Current recommended torch version

One search summarized the current stable as **PyTorch 2.13.0** (released ~July 8, 2026), which is also the version whose MPS docs were fetched directly ([docs.pytorch.org/docs/2.13/notes/mps.html](https://docs.pytorch.org/docs/2.13/notes/mps.html)) and which shipped a substantial MPS investment: FlexAttention lands on Apple Silicon with hand-written Metal kernels (up to ~12x speedup over SDPA on sparse patterns — a ceiling, not a guarantee, biggest gains on long/sparse patterns), plus migration of many ops (bernoulli, dropout, uniform/normal/randint, randperm, comparisons, grid_sampler 2d/3d backward, Dirichlet sampling) from the older MPSGraph path to native Metal kernels, reducing per-op compile/dispatch overhead. Source: [PyTorch 2.13 release blog](https://pytorch.org/blog/pytorch-2-13-release-blog/), [release notes](https://github.com/pytorch/pytorch/releases/tag/v2.13.0). **Note:** the exact release date/number came from a search-engine summary, not a directly fetched changelog page with a date stamp — treat "2.13.0, July 2026" as high-confidence but not hand-verified against a primary dated source.

### ⚠️ Critical, machine-specific: MPS "built but not available" on macOS 26 (Tahoe)

Darwin 25.x corresponds to **macOS 26 "Tahoe"** — i.e. this exact machine's OS family. There is an active, unresolved PyTorch bug class here:

- [Issue #167679](https://github.com/pytorch/pytorch/issues/167679): on macOS 26.0, `torch.backends.mps.is_built()` returns `True` but `torch.backends.mps.is_available()` returns `False`, on both PyTorch 2.9.1 stable and 2.10.0.dev nightly (opened Nov 12, 2025; status "triaged," no fix landed at fetch time).
- [Issue #177819](https://github.com/pytorch/pytorch/issues/177819): the same "built but not available" failure persists on macOS 26.3.1 with PyTorch 2.10.0 and a March-2026 nightly (2.12.0.dev20260318); the runtime error text incorrectly claims MPS requires macOS 14.0+ (which the system exceeds) — status open, no workaround documented in the issue at fetch time.
- Related: [Issue #161265](https://github.com/pytorch/pytorch/issues/161265) — on macOS 26, `torch.full` fails for 4+ GB tensors on MPS (a different but adjacent macOS-26-specific regression).

**Neither issue's resolution status against 2.13 stable was confirmed by direct source** — the 2.13 release notes fetched above don't mention this bug by number. **Action for this machine: before trusting any launch flag tuning, run**
```
python -c "import torch; print(torch.__version__, torch.backends.mps.is_built(), torch.backends.mps.is_available())"
```
**first.** If `is_available()` is `False` despite `is_built()` being `True`, this is that bug, not a ComfyUI or flag problem — check the two issues above for whichever torch version you're on, and try the latest stable/nightly since this class of bug has been actively patched release-to-release.

### Environment variables

Source: [PyTorch MPS environment variables doc](https://docs.pytorch.org/docs/2.5/_sources/mps_environment_variables.rst.txt) (fetched from the 2.5 doc tree — variable set is stable across versions, per corroborating community usage in current 2026 threads).

| Variable | Default | Meaning |
|---|---|---|
| `PYTORCH_ENABLE_MPS_FALLBACK` | unset | Set to `1` to fall back to CPU for any op MPS doesn't implement, instead of hard-erroring. You'll get a `UserWarning` per fallback but the run completes. **Recommended always-on for ComfyUI** since custom nodes frequently hit unimplemented ops. |
| `PYTORCH_MPS_HIGH_WATERMARK_RATIO` | 1.7 | Hard ceiling on MPS allocator memory as a ratio of a reference size. Setting to `0.0` removes the ceiling entirely — lets the allocator claim unbounded memory, which the PyTorch issue tracker explicitly warns "may cause system failure" ([issue #152351](https://github.com/pytorch/pytorch/issues/152351)). Only do this deliberately, and only alongside `--reserve-vram` and swap monitoring. |
| `PYTORCH_MPS_LOW_WATERMARK_RATIO` | 1.4 (unified memory) / 1.0 (discrete) | Soft limit that triggers allocator garbage-collection before the high watermark is hit. |
| `PYTORCH_MPS_FAST_MATH` | unset | Set to `1` to enable fast-math Metal kernels — trades a little numerical precision for speed. Untested for diffusion-model artifact risk in the sources gathered; treat as experimental. |
| `PYTORCH_MPS_PREFER_METAL` | unset | Set to `1` to force raw Metal kernels over MPSGraph APIs where both exist. |
| `PYTORCH_DEBUG_MPS_ALLOCATOR`, `PYTORCH_MPS_LOG_PROFILE_INFO`, `PYTORCH_MPS_TRACE_SIGNPOSTS` | unset | Debug/profiling verbosity switches — only for diagnosing allocator or kernel-dispatch issues, not for normal runs. |

### Unsupported ops / CPU fallback slowness

`PYTORCH_ENABLE_MPS_FALLBACK=1` silently reroutes unsupported ops to CPU. Symptom: a workflow runs (doesn't crash) but is inexplicably slow at one particular node, with a `UserWarning about mps fallback` buried in the console — that warning is your signal to go looking, not a red herring. Custom nodes (impact-pack, video nodes, some samplers) are the most common source of ops MPS hasn't implemented yet.

### fp16 vs bf16 vs fp8 on MPS

- fp16 and bf16 are both natively computable on MPS as of current PyTorch; bf16 support has broadened significantly through 2.13's op migrations (comparisons, RNG ops, etc. above).
- **fp8 checkpoints do not work on Metal.** Confirmed via community report: "Metal doesn't implement `Float8_e4m3fn`, so FP8 checkpoints can't be used on Apple Silicon" (per the [lilting.ch LTX-2/Wan 2.2 Mac article](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen), and consistent with the discussion at [Comfy-Org discussion #13273](https://github.com/Comfy-Org/ComfyUI/discussions/13273) titled "Working Apple Silicon / macOS workaround for ComfyUI FP8 MPS" — the existence of a *workaround* thread itself confirms fp8 doesn't work out of the box). **This directly affects Flux-dev-fp8 workflows** — see §3, use GGUF quantization instead on this machine.

### torch.compile / SageAttention / FlashAttention on Mac

- **torch.compile**: multiple 2026 sources state MPS "lacks torch.compile support" for practical diffusion workloads (per the lilting.ch article and a macgpu.com summary). There is a `ComfyUI-TorchCompileSpeed` custom node that falls back to a torch.compile-style warmup path when Triton ops aren't available, producing some kernel caching benefit, but this is not the same as full CUDA-style `torch.compile` graph capture. Treat torch.compile as **not practically usable** for MPS diffusion inference today.
- **FlexAttention** (new in PyTorch 2.13) is the closest thing to a compiled-attention win on Mac — real, Apple-specific Metal kernels, biggest gains on sparse/long-sequence attention patterns. Ordinary SDXL/Flux dense attention over normal image token counts won't see the full 12x; expect a smaller, workload-dependent gain.
- **SageAttention / FlashAttention**: no official MPS backend in ComfyUI itself. Community MPS ports of flash-attention exist ([mps-flash-attention](https://github.com/mpsops/mps-flash-attention), claiming O(N) memory letting 100K+ token sequences fit in unified memory) but are separate installs, not what ComfyUI's `--use-flash-attention` CLI flag activates — don't assume the flag "just works" after `pip install`ing one of these. **[unverified integration path]**

---

## 3. Realistic performance numbers on Apple Silicon

**Caveat on all numbers below:** these come from blog/community benchmarks, not a controlled first-party suite, and vary with steps/resolution/quantization/torch version/thermal state. Use them as ballpark, not spec.

### SDXL / Flux still images

Source: [Apatero Flux-on-Apple-Silicon guide](https://www.apatero.com/blog/flux-apple-silicon-m1-m2-m3-m4-complete-performance-guide-2025) (its own benchmark table, as summarized by fetch):

| Chip | Memory | Resolution/steps | Time |
|---|---|---|---|
| M1 Max | 32 GB, fp16 | 1024×1024, 30 steps | ~180 s |
| M2 Max | 32 GB, fp16 | 1024×1024, 30 steps | ~145 s |
| M3 Max | 36 GB, fp16 | 1024×1024, 30 steps | ~105 s |
| M4 Pro | 24 GB, fp16 | 1024×1024, 30 steps | ~145 s |
| **M4 Max** | 48 GB, fp16 | 1024×1024, 30 steps | **~85 s** |
| M1 Max | 32 GB, fp16 | 512×512, 20 steps | ~55 s |
| M4 Max | 48 GB, fp16 | 512×512, 20 steps | ~25 s |
| M2 Pro | 16 GB, Q6 GGUF | 1024×1024 | ~200 s |
| M3 Pro | 18 GB, Q6 GGUF | 1024×1024 | ~170 s |
| M3 Pro | 18 GB, Q4 GGUF | 512×512 | ~60 s |

Separately, a [Mac Mini M4 benchmark](https://www.heyuan110.com/posts/ai/2026-02-15-mac-mini-local-image-generation/) (24 GB/48 GB configs) puts a **24 GB M4 Pro Mac Mini at ~50 s for a 1024×1024 Flux image** in ComfyUI, and notes **Draw Things beats ComfyUI by ~20%** on the same hardware — ComfyUI's generic PyTorch/MPS path is not as tuned as Apple-native tools like Draw Things (which uses more MLX/Metal-specific optimization). If raw speed matters more than ComfyUI's node ecosystem, that's a real tradeoff to know about.

**This machine (M4 Max, 36 GB) sits between the 48 GB M4 Max (~85 s/image at 1024² fp16) and memory-constrained configs** — expect low-90s-to-low-100s seconds per 1024×1024 SDXL/Flux image at 30 steps in fp16/bf16, faster with GGUF quantization or Flux-schnell (4 steps).

### GGUF quantization (recommended path on this machine, given no fp8 support)

Per the [smartart.live Flux/GGUF guide](https://smartart.live/articles/258-flux-comfyui-on-apple-silicon-complete-2026-guide-to-hardware-acceleration-gguf-models-memory-optimization.html): Q4_K_S compresses the Flux UNet from 23.8 GB → 6.81 GB (-71%), and the T5-XXL text encoder from 9.9 GB → 2.9 GB, bringing full-pipeline peak memory from ~34 GB down to ~12–14 GB. **Q6_K is described as "the sweet spot" — quality loss is reportedly near-imperceptible while memory drops significantly.** On 36 GB unified memory this headroom matters: full bf16 Flux dev (≈34 GB peak) leaves almost nothing for the OS and will pressure swap (see below); Q6_K GGUF leaves comfortable headroom.

### Video models — be honest, this is the weak spot

- [LTX-2 vs Wan 2.2 on M1 Max 64 GB](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen): **FP8 fails outright on Metal** (as noted in §2); **GGUF Wan 2.2 took ~82 minutes for a 2-second clip.** That is not a typo — video diffusion on MPS today is impractically slow for anything but patience-testing.
- A separate report: an M4 Pro with 48 GB produced a 3.9-second, 768×512 LTX-Video clip that came out **blurry and unusable** — so even where speed is tolerable, quality/compatibility gaps remain.
- General assessment across sources: Wan 2.2 and LTX-Video "usually beat Mochi 1" on Apple Silicon for quality/speed, Wan 2.2 wins aggregate quality, HunyuanVideo has the larger community — but all of them are **CUDA-first ecosystems** where IC-LoRAs and various optimizations are CUDA-only, so Mac support is perpetually second-class.

**Bottom line for this machine: treat video generation in ComfyUI as experimental/slow-lab-only, not a production workflow.** Budget tens of minutes per short clip and expect some node/precision incompatibilities (fp8 checkpoints, IC-LoRA, some custom sampler ops) to simply not work.

### Memory pressure and swap on 36 GB unified memory

Because VRAM and system RAM are the same physical pool, a large model (full-precision Flux dev pipeline ~34 GB peak) leaves almost no room for macOS itself, your browser, ComfyUI's own Python process overhead, or another app — the moment you cross available memory, **macOS starts swapping to disk**, which manifests as multi-second UI stalls, beachballs, and dramatically slower generation than the benchmark numbers above (which assume no swap). Guidance repeated across sources: watch Activity Monitor's Memory tab — **green is fine, yellow means swapping has started (back off model size/resolution), red means a crash is imminent.** On this 36 GB machine, prefer GGUF Q6_K or below for Flux-class models and set `--reserve-vram` (§1) to keep a buffer for the OS.

---

## 4. comfy-cli command reference

Source: [Comfy-Org/comfy-cli README](https://github.com/Comfy-Org/comfy-cli/blob/main/README.md) (fetched directly), corroborated by [comfyui-wiki's Comfy CLI guide](https://comfyui-wiki.com/en/install/install-comfyui/comfy-cli).

### Install

```
pip install comfy-cli
comfy setup                       # interactive wizard: install, custom nodes, models, local or cloud
comfy install                     # install ComfyUI into current/target workspace
comfy install --skip-manager      # skip ComfyUI-Manager install
comfy install --fast-deps         # faster dependency resolution
comfy install --pr "#1234"        # install a specific ComfyUI PR (for testing)
comfy --workspace=<path> install  # install into a named workspace
```

### Workspace selection (how comfy-cli decides which install a command targets)

- `--workspace=<path>` — explicit target
- `--recent` — most recently used/installed ComfyUI
- `--here` — the ComfyUI in the current directory
- These three are **mutually exclusive**. With none given, precedence is: the workspace set via `set-default` → most recent → current directory.
- Check what a given invocation resolves to with `comfy which` (or `comfy --recent which` / `comfy --here which`).

```
comfy set-default <path>                      # make this the default workspace
comfy set-default <path> --launch-extras="<args>"   # bake extra launch args into the default
comfy set-default --where cloud               # default to Comfy Cloud instead of local
comfy set-default --clear-where
```

### env / status

```
comfy env             # print environment/workspace info
comfy system-stats     # local system stats
comfy system-stats --where cloud
comfy which            # resolve which install the current flags target
```

### Launch / stop / restart

```
comfy launch
comfy launch -- <extra-args>                  # pass args straight through to ComfyUI's main.py
comfy launch -- --cpu --listen 0.0.0.0
comfy launch --background                     # detach; shows up under "Background ComfyUI" in `comfy env`
comfy --workspace=~/comfy launch --background -- --listen 10.0.0.10 --port 8000
comfy launch --frontend-pr "#456"              # test a frontend PR build
comfy launch --frontend-pr "username:branch-name"
comfy stop              # stop a background instance
comfy restart
comfy free               # unload models / free cache
comfy free --free-memory
```

Note the double-dash: flags meant for ComfyUI itself (the ones in §1) go **after `--`**, not as bare comfy-cli flags — e.g. `comfy launch -- --reserve-vram 4 --use-pytorch-cross-attention`.

### Update

```
comfy update              # update ComfyUI (current workspace)
comfy update all          # update ComfyUI + nodes
comfy update cli          # update comfy-cli itself
comfy update comfy --version 0.3.0
comfy update comfy --version latest
comfy update comfy --version nightly
```

### Node management

```
comfy node show installed|enabled|not-installed|disabled|all|snapshot|snapshot-list
comfy node show all --channel recent
comfy node simple-show installed
comfy node install comfyui-impact-pack
comfy node install comfyui-impact-pack --fast-deps
comfy node install comfyui-impact-pack --uv-compile
comfy node reinstall <id>
comfy node update all
comfy node registry-install comfyui-impact-pack
comfy node registry-install comfyui-impact-pack --version 1.0.0
comfy node save-snapshot
comfy node restore-snapshot <snapshot-name>
comfy node install-deps --deps=<file.json>
comfy node install-deps --workflow=<file.json>
comfy node deps-in-workflow --workflow=<file.json> --output=<file.json>
comfy node uv-sync
comfy node bisect start|good|bad|reset          # binary-search a broken node set
```

### Model management

```
comfy model download --url <URL>
comfy model download --url <URL> --relative-path <PATH>
comfy model download --url <URL> --set-civitai-api-token <TOKEN>
comfy model download --url <URL> --set-hf-api-token <TOKEN>
comfy model list
comfy model list --relative-path <PATH>
comfy model remove --model-names <names>
comfy model remove --relative-path <PATH> --model-names <names>
comfy models search --where cloud
```

### Workflow execution / tracking

```
comfy run --workflow ./workflow.json
comfy run --workflow ./workflow.json --where cloud
comfy run --workflow ./workflow.json --where cloud --wait
comfy jobs ls --where cloud
comfy jobs status <prompt_id> --where cloud
comfy jobs watch <prompt_id> --where cloud
comfy jobs wait <prompt_id> --where cloud
comfy download <prompt_id> --where cloud -o ./outputs
comfy tracking enable | disable     # usage analytics — opt-in, off by default; also DO_NOT_TRACK / COMFY_NO_TELEMETRY env vars
```

### ComfyUI-Manager config via CLI

```
comfy manager disable
comfy manager enable-gui | disable-gui
comfy manager enable-legacy-gui
comfy manager clear
comfy manager migrate-legacy
comfy manager uv-compile-default true|false
```

### Environment variables comfy-cli itself respects

- `COMFY_LOCAL_URL=http://host:port` — point commands at a non-default running ComfyUI server
- `COMFY_API_KEY` — partner/cloud node generation credential
- `CIVITAI_API_TOKEN`, `HF_API_TOKEN` — model download auth
- `DO_NOT_TRACK`, `COMFY_NO_TELEMETRY` — force tracking off regardless of `comfy tracking` state

### Anything macOS-specific?

No comfy-cli-specific macOS behavior turned up in the README/docs beyond the general Apple Silicon PyTorch/MPS install path handled by ComfyUI itself (§1–2) — comfy-cli is a thin, OS-agnostic wrapper. **[absence of evidence, not strong confirmation — if you hit a macOS-only comfy-cli bug, it likely isn't documented yet]**

---

## 5. Model storage layout and sharing

### `extra_model_paths.yaml` syntax

Source: [`extra_model_paths.yaml.example`](https://github.com/Comfy-Org/ComfyUI/blob/master/extra_model_paths.yaml.example) (per search-summarized fetch) and corroborating [docs.comfy.org/development/core-concepts/models](https://docs.comfy.org/development/core-concepts/models).

- The file lives at ComfyUI's root and is loaded automatically if named `extra_model_paths.yaml` (or pointed to explicitly via `--extra-model-paths-config`, confirmed in `cli_args.py`, which also accepts **multiple** config files).
- Structure: a top-level arbitrary profile name, then `base_path`, then one key per model-type folder, each either an absolute path or a path relative to `base_path`.

```yaml
# Example: share one models/ tree (e.g. on an external SSD) across two installs
comfyui:
  base_path: /Volumes/AI-SSD/ComfyUI-Models
  is_default: true
  checkpoints: models/checkpoints/
  vae: models/vae/
  loras: |
    models/loras
    models/loras/community
  upscale_models: models/upscale_models/
  controlnet: models/controlnet/
  clip: models/clip/
  clip_vision: models/clip_vision/
  text_encoders: models/text_encoders/
  diffusion_models: models/diffusion_models/
  embeddings: models/embeddings/
  style_models: models/style_models/
  gligen: models/gligen/

# A second profile is fine in the same file — e.g. to also pull from an
# old Automatic1111 checkout without duplicating files on disk.
a1111:
  base_path: /Users/sabiridwan/stable-diffusion-webui
  checkpoints: models/Stable-diffusion
  loras: models/Lora
  vae: models/VAE
```

Notes:
- **Indentation is significant YAML** — mixing tabs/spaces or misaligning keys silently breaks the parse.
- `is_default: true` on a profile makes its folders sort first and become the default save/download target for new models.
- Use the pipe (`|`) block-scalar form to list **multiple directories for one model type** — ComfyUI will search all of them.
- For an external SSD path like `/Volumes/AI-SSD/...`: if the drive isn't mounted when ComfyUI starts, that profile's folders just won't populate (no hard crash reported in sources), so don't put your only copy of frequently-used checkpoints on a drive you might unplug mid-session.

### Full models/ subdirectory → model-type mapping

Compiled from [comfyui-wiki's folder-structure page](https://comfyui-wiki.com/en/interface/files) and the [install-models guide](https://comfyui-wiki.com/en/install/install-models):

```
models/
├── checkpoints/          full SD/SDXL/Flux checkpoints (single-file, all-in-one)
├── diffusion_models/      (aka unet/) split UNet-only weights (e.g. Flux dev/schnell splits, GGUF UNets)
├── unet/                  older/alternate name for the same purpose as diffusion_models
├── vae/                   VAE weights
├── vae_approx/            fast VAE approximations (TAESD etc., used by --preview-method taesd)
├── clip/                  CLIP text-encoder weights (SD1.5/SDXL dual clip setups)
├── text_encoders/         T5/other LLM-style text encoders (Flux's T5-XXL lives here)
├── clip_vision/           CLIP vision-tower weights (for IP-Adapter etc.)
├── loras/                 LoRA / LyCORIS weight deltas
├── controlnet/            ControlNet models
├── upscale_models/        ESRGAN-style upscalers
├── embeddings/             textual-inversion embeddings
├── hypernetworks/          legacy hypernetwork weights
├── gligen/                 GLIGEN grounding models
├── style_models/           style-transfer conditioning models
├── photomaker/             PhotoMaker identity-adapter models
├── diffusers/               diffusers-format model folders
├── configs/                 model config/yaml files (legacy SD1.x configs)
├── classifiers/             classifier models (e.g. safety checkers)
└── (custom-node-added) animatediff_models/, animatediff_motion_lora/, ipadapter/,
    liveportrait/, insightface/, layerstyle/, LLM/, sams/, blip/, CogVideo/, xlabs/, ...
```

The trailing custom-node-added folders vary by which custom node packs you install — the core ComfyUI install ships the first block; the rest are created ad hoc by the node packs that need them (ComfyUI-Manager will usually create the right folder itself when installing a node that needs one).

### Safe symlink patterns on macOS

Not directly documented in sources found (**[unverified against a primary ComfyUI doc]**), but standard, low-risk macOS practice for this use case:

```bash
# Symlink an individual model type into the tree instead of using extra_model_paths.yaml
ln -s /Volumes/AI-SSD/Models/checkpoints /Users/sabiridwan/ComfyUI-Installs/ComfyUI/ComfyUI/models/checkpoints

# Or symlink individual large files if you only want to share a few
ln -s /Volumes/AI-SSD/Models/flux1-dev-Q6_K.gguf \
      /Users/sabiridwan/ComfyUI-Installs/ComfyUI/ComfyUI/models/diffusion_models/flux1-dev-Q6_K.gguf
```

`extra_model_paths.yaml` is the better-supported, ComfyUI-native mechanism (it's what the project ships an `.example` file for) and survives a `comfy update`/reinstall without re-linking; raw symlinks work fine too but are your own bookkeeping to maintain, and a broken symlink (unmounted SSD) will just make that model silently missing from the picker rather than erroring loudly.

---

## 6. macOS-specific failure modes

| Error / symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: Placeholder storage has not been allocated on MPS device!` | A tensor/module ended up on `cpu` while another op expected it on `mps` — very common cause: custom code doing `torch.set_default_device("mps")` and then instantiating something (e.g. an optimizer or a custom node's own module) that doesn't respect the default device, or a node explicitly `.to("cpu")`-ing something it shouldn't. Confirmed as a known PyTorch/MPS issue pattern across projects, not just ComfyUI ([PyTorch forums thread](https://discuss.pytorch.org/t/runtimeerror-placeholder-storage-has-not-been-allocated-on-mps-device/193258), [pytorch/pytorch #149184](https://github.com/pytorch/pytorch/issues/149184)). | No single ComfyUI-specific fix found in sources — treat it as "a node/model mixed devices." Update the offending custom node; as a blunt workaround, forcing everything through `--cpu` isolates whether it's MPS-specific, but the real fix is in the node's code (explicit `.to(device)` calls need to track the actual model device, not assume MPS or CPU). |
| `AssertionError`/crash mentioning **"total bytes of NDArray > 2**32"** (i.e. a single MPS tensor exceeds ~4 GB) | Hard MPS/Metal limit on a single `NDArray` buffer's byte size. Hit typically at high resolutions (reports say 512×512 is fine, 1024×1024 can tip over it depending on the op, e.g. `scaled_dot_product_attention` on large batches/frame counts) — confirmed via [pytorch/pytorch #149261](https://github.com/pytorch/pytorch/issues/149261) and a ComfyUI-Impact-Pack issue ([#376](https://github.com/ltdrdata/ComfyUI-Impact-Pack/issues/376)). | This is a hardware/framework ceiling, not a settings problem — `--lowvram`/`--novram` do **not** help (confirmed in sources: it's not a VRAM-headroom issue, it's a single-allocation size limit). Reduce resolution, batch size, or frame count until no single tensor crosses the 4 GB boundary; for video/animation workflows this often means processing fewer frames per batch. |
| MPS **out of memory** | Sum of resident model weights + activations + KV/attention buffers exceeds available unified memory the allocator will grant (governed by the high/low watermark ratios, §2). | Lower resolution/batch, switch to GGUF quantization (§3), add `--reserve-vram`, try `--disable-smart-memory` to force more eager offload, or as a last resort raise `PYTORCH_MPS_HIGH_WATERMARK_RATIO` (understanding this risks a full system memory-pressure event, not just an app crash). |
| Watchdog timeout / system beachballs, everything freezes | Memory pressure has pushed macOS into heavy swapping (yellow/red in Activity Monitor's memory tab, §3) rather than a clean OOM — the allocator technically "succeeded" but the system is now paging constantly. | Same remedies as MPS OOM above; also just close other memory-hungry apps (browser tabs are a classic culprit) before a big generation. |
| Gatekeeper blocks a downloaded model/custom-node script, or macOS flags it as quarantined | Files downloaded via a browser (or some download managers) get the `com.apple.quarantine` extended attribute; macOS's Gatekeeper can refuse to let unsigned/unnotarized executables run, and in some node-install flows this can block scripts. | `xattr -d com.apple.quarantine <file>` for a single file, or `xattr -r -d com.apple.quarantine <folder>` recursively. Model weight files themselves (safetensors/GGUF/ckpt) aren't executed, so this mostly bites custom-node install scripts or any bundled binaries, not the model files themselves. |
| `mach-o file, but is an incompatible architecture` / import errors after installing a package | A pip package (or a dependency's compiled wheel) was resolved for the wrong architecture — e.g. an x86_64 wheel installed into an arm64-native Python, often from a Rosetta-launched Terminal or a stale x86_64 Homebrew/pyenv Python. | Confirm your Python is native arm64: `python3 -c "import platform; print(platform.machine())"` → must print `arm64`. If it prints `x86_64`, you're running an Intel/Rosetta Python — reinstall Python (and comfy-cli/ComfyUI's venv) using a native arm64 interpreter (Homebrew's default `/opt/homebrew` prefix, not `/usr/local`, or an arm64 pyenv/uv build). Never mix an arm64 interpreter with an x86_64 virtualenv or vice versa. |
| `Ports 8188 to 8198 are all in use` / connection refused on localhost:8188 | A previous ComfyUI process crashed without releasing the port, or another instance (maybe a `comfy launch --background` you forgot about) is already running. Confirmed pattern per [issue #3450](https://github.com/Comfy-Org/ComfyUI/issues/3450) and [issue #3750](https://github.com/Comfy-Org/ComfyUI/issues/3750). | `comfy stop` to kill a tracked background instance; if that doesn't find it, `lsof -i :8188` to find the stray PID and `kill` it; or just launch on a different port with `comfy launch -- --port 8189`. |
| First generation after a fresh launch is much slower than subsequent ones | Metal shader/kernel compilation happens lazily on first use per op-shape; PyTorch/Metal caches compiled kernels after that. Confirmed as expected behavior, not a bug, across sources — "the first 2 to 3 generations of every session are much slower due to model compiling." | Nothing to fix — budget for a slow first run when benchmarking (discard the first sample when timing), and expect a similar (smaller) one-time cost whenever you change resolution/batch shape enough to require new kernel variants. |
| `torch.backends.mps.is_available()` returns `False` unexpectedly | Either (a) genuinely running on non-Apple-Silicon/old macOS, or (b) **the macOS 26 Tahoe "built but not available" PyTorch regression** described in §2 (issues #167679 / #177819) — directly relevant to this machine's OS. | Run the diagnostic one-liner from §2. If `is_built()` is `True` and `is_available()` is `False` on a Tahoe machine, this is the known upstream bug, not a local misconfiguration — check the linked issues for the latest patched version before assuming your install is broken. |

---

## 7. Sensible defaults block for this machine

Recommended launch, tuned for M4 Max / 36 GB unified memory / Darwin 25.5 (macOS 26 Tahoe) / Python 3.12:

```bash
# --- one-time environment (put in your shell profile or a launch wrapper) ---
export PYTORCH_ENABLE_MPS_FALLBACK=1        # unsupported ops fall back to CPU instead of hard-erroring — essential given how many custom nodes still hit MPS gaps (§2)
# Leave PYTORCH_MPS_HIGH_WATERMARK_RATIO at its default (1.7) unless you've
# specifically hit an MPS-OOM you've diagnosed and want to push past —
# raising it trades a clean OOM for a real risk of a full memory-pressure event (§2, §6)

# --- pre-flight check (run once per torch upgrade or macOS update) ---
python -c "import torch; print(torch.__version__, torch.backends.mps.is_built(), torch.backends.mps.is_available())"
# If is_available() is False while is_built() is True, stop — that's the
# macOS 26 Tahoe MPS regression (§2), not a flag problem. Fix torch version first.

# --- launch ---
comfy launch -- \
  --use-pytorch-cross-attention \
  --reserve-vram 4 \
  --preview-method taesd
```

Justification, one line each:

- **`PYTORCH_ENABLE_MPS_FALLBACK=1`** — given how many ops still aren't implemented on MPS, this is the difference between "a node errors out" and "a node runs a bit slower on CPU for that op" (§2).
- **`--use-pytorch-cross-attention`** — the best-supported, Metal-optimized attention path on MPS today; split/quad are memory-saving fallbacks you reach for only if this OOMs, not defaults (§1).
- **`--reserve-vram 4`** — on unified memory, leaves ~4 GB headroom for macOS + your other apps so a big generation doesn't tip the whole system into swap (§3, §6); adjust up if you keep a heavy browser/IDE open during generation.
- **`--preview-method taesd`** — cheap, nicer live previews; drop to `none` if you're squeezing every second out of a benchmark run.
- **Not included by default: `--force-fp16`, `--fp16-vae`, `--lowvram`/`--highvram`, `--disable-smart-memory`** — these are situational fixes (black images, OOM, multi-model juggling) rather than machine-wide defaults; add them only when you hit the specific symptom in §6, since some (e.g. `--force-fp16`) have been reported to cause their *own* instability on some MPS configs rather than universally helping.
- **GGUF over fp8/full-precision for Flux-class models** — fp8 checkpoints don't run on Metal at all (§2: no `Float8_e4m3fn` support), and full bf16 Flux's ~34 GB peak leaves almost no headroom on a 36 GB machine (§3) — Q6_K GGUF is the sweet spot cited across sources for near-imperceptible quality loss at roughly a third of the memory.
- **Treat video models (Wan/LTX/Hunyuan) as experimental only** — tens-of-minutes-per-clip territory even on higher-memory M-series Macs, with real fp8/IC-LoRA compatibility gaps (§3); don't plan production work around them on this hardware today.
