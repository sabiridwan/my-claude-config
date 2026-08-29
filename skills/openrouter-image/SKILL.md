---
name: openrouter-image
description: |
  Generate an image by calling OpenRouter's chat-completions API directly
  (not a dedicated image-gen provider — one of OpenRouter's routed models
  with image output). Use when Sabi explicitly asks to go through
  OpenRouter/OR for an image: "use OR to generate an image of...",
  "use openrouter for this image", "generate via openrouter", "OR image
  gen". NOT the default image-generation path — for a plain "generate an
  image" with no provider named, prefer the higgsfield-generate skill
  (Sabi's established image/video pipeline). This skill exists specifically
  for testing/using OpenRouter's own image models on request.
allowed-tools: Bash
---

# OpenRouter Image Generation

Wraps `generate.sh` in this skill's own directory — a single self-contained
script, no CLI install needed.

## Usage

```bash
~/.claude/skills/openrouter-image/generate.sh "<prompt>" [output-path] [model]
```

- `output-path` — optional. Defaults to `openrouter-image.png` in the
  current directory. Extension is inferred from the returned image if you
  don't give one.
- `model` — optional, defaults to `google/gemini-2.5-flash-image` (cheap,
  fast, good general quality — confirmed working, ~$0.03-0.04/image at
  default size). Other verified-available OpenRouter image-output models
  as of this writing (check `https://openrouter.ai/api/v1/models` and
  filter for `architecture.output_modalities` containing `"image"` if any
  of these stop working or you want current pricing):
  - `google/gemini-2.5-flash-image` — default, cheap.
  - `google/gemini-3.1-flash-image` — newer, similar price tier.
  - `google/gemini-3-pro-image` — higher quality, more expensive.
  - `openai/gpt-5-image` / `openai/gpt-5-image-mini` — OpenAI's routed
    image model, mini is the cheap tier.

The script prints the saved file's path on success (nothing else) — read
it back with the Read tool to view it, same as any other generated image.

## Auth

Reads `$OPENROUTER_API_KEY` from the environment first. If unset, falls
back to reading it out of `wzb-admin/.env.local` in Sabi's wazobia project
(the one place this key is known to live on this machine as of this
writing). For full portability across projects, export
`OPENROUTER_API_KEY` in your shell profile (`~/.zshrc`) instead of relying
on the fallback.

## How it actually calls OpenRouter

A plain `POST /chat/completions` with `"modalities": ["image", "text"]` in
the body. The response's `choices[0].message.images` is an array of
`{type: "image_url", image_url: {url: "data:image/png;base64,..."}}` — the
script extracts the first one and writes it to disk. This is NOT
OpenRouter's `/images/generations` endpoint (that doesn't exist as a
separate route on OpenRouter) — image-output models are called exactly
like any other chat-completions model, just with `modalities` set and a
model that supports image output.

## Troubleshooting

- `"No image returned. Model said: ..."` — the chosen model replied with
  text only. Some models only produce images some of the time depending
  on the prompt; try rephrasing as a direct generation instruction
  ("Generate an image of...") rather than a question, or switch model.
- `OpenRouter error: ...` — usually an invalid/expired key or insufficient
  OpenRouter credit balance (check `https://openrouter.ai/settings/credits`).
