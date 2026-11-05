---
# Every number below was measured in my lab on 2026-11-05 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "The first NVFP4 quants of NorthCUA on Hugging Face"
slug: northcua-nvfp4-quants
summary: >-
  NorthCUA is a new family of open computer-use models. On 2026-11-05 I published the first NVFP4 quantizations of
  NorthCUA-Nano and NorthCUA-Mini on Hugging Face, for vLLM: 18.8 GB down to 11.2 GB, and 70.2 GB down to 23.9 GB.
  This post covers what was quantized and why, a two-layer test that checks vLLM reads the format as written, the
  results against the original BF16 models, and the public timestamps behind "first".
tags: [quantization, nvfp4, vllm, compressed-tensors, computer-use, moe, local-inference, hugging-face]
date: 2026-11-05
series: AI engineering notes
---

NorthCUA ([Nano](https://huggingface.co/beipo-ai/NorthCUA-Nano), [Mini](https://huggingface.co/beipo-ai/NorthCUA-Mini)
and [Pro](https://huggingface.co/beipo-ai/NorthCUA-Pro)) is a family of computer-use models from the NorthCUA team,
built on Qwen3.5 and released under Apache-2.0 at the turn of October and November. Given a screenshot and a task, they reply
with reasoning, text and tool calls, such as a click at a point on a 0–1000 grid.

On 2026-11-05 (UTC) I published NVFP4 quantizations of two of them:

| Model | Original (BF16) | NVFP4 | Repository |
|:--|--:|--:|:--|
| NorthCUA-Nano (9B, dense) | 18.8 GB | 11.2 GB | [willyb23/NorthCUA-Nano-NVFP4A16](https://huggingface.co/willyb23/NorthCUA-Nano-NVFP4A16) |
| NorthCUA-Mini (35B, 3B active) | 70.2 GB | 23.9 GB | [willyb23/NorthCUA-Mini-NVFP4A16](https://huggingface.co/willyb23/NorthCUA-Mini-NVFP4A16) |

Both are grouped in the [NorthCUA NVFP4 collection](https://huggingface.co/collections/willyb23/northcua-nvfp4-6aecfb2d402045ad0476e993).

## The first on Hugging Face

Hugging Face records when each repository was created and when every file was committed, and it lists, under each
model, the quantizations that declare it as their base. Anyone can check:

- the commit history of each repository: [Nano](https://huggingface.co/willyb23/NorthCUA-Nano-NVFP4A16/commits/main),
  [Mini](https://huggingface.co/willyb23/NorthCUA-Mini-NVFP4A16/commits/main);
- every quantization linked to the originals: [Nano](https://huggingface.co/models?other=base_model:quantized:beipo-ai/NorthCUA-Nano),
  [Mini](https://huggingface.co/models?other=base_model:quantized:beipo-ai/NorthCUA-Mini).

I also saved what the Hub's public API returned, without logging in, after each model went public:
[snapshot 1](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-1.json) (after Nano) and
[snapshot 2](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-2.json) (after Mini). They list every quantization linked to the
three NorthCUA models and every repository with NorthCUA in its name, with creation times:

| Original | Quantizations on the Hub (created, UTC) |
|:--|:--|
| NorthCUA-Nano | GGUF by mradermacher (2026-11-02 13:27); **NVFP4, this one (2026-11-05 21:46)** |
| NorthCUA-Mini | GGUF by bartowski (2026-11-03 16:03); GGUF by mradermacher (2026-11-05 13:59); **NVFP4, this one (2026-11-05 23:13)** |

As far as the Hub's public listings show, these are the first NVFP4 checkpoints of NorthCUA-Nano and NorthCUA-Mini:
until they appeared, no repository linked under either model and no repository with NorthCUA in its name was an
NVFP4 checkpoint, and the earlier quantizations were GGUF, the format of llama.cpp and Ollama. NVFP4 is the 4-bit
format of NVIDIA's Blackwell GPUs, served here through vLLM. My repositories are created private and made public after
the checks below, so their "created" times are a few minutes earlier than the moment they became public.

## What was quantized, and why only that

NVFP4 stores each weight in 4 bits (FP4, E2M1), with one FP8 scale for every 16 weights and one FP32 scale for the
whole matrix.

- **Mini** is a mixture of experts: in each of its 40 layers, 256 small MLPs ("experts"), of which 8 run for any
  token. The experts hold most of the parameters, and they are what I quantized: 30,720 matrices.
- **Nano** is dense: I quantized the MLP of all 32 layers and the projections of its 8 full-attention layers, 128
  matrices.

The linear-attention layers, the embeddings, the output head and the vision encoder stay in BF16 in both. That is a
quarter of Mini's quantized file but almost three quarters of Nano's, which is why Nano shrinks less: its embeddings
and output head alone are 4 GB.

Only the weights are quantized ("A16"): activations stay in BF16. Quantizing activations as well needs calibration,
which means running real inputs through the full model to measure their range. Weights alone need no data, and vLLM
serves this format with its Marlin FP4 kernel.

The file format is compressed-tensors' `nvfp4-pack-quantized`, which vLLM loads with no extra flags. I used the
library's own functions for the scales and the 4-bit packing rather than writing my own, so the encoding cannot drift
from what the loader expects.

One detail matters more than it looks. vLLM fuses some matrices into one at load time: an expert's gate and up
projections, and the q, k and v projections of attention. A fused matrix can carry only one global scale, so vLLM
keeps one and warns. Parts quantized with different global scales would come out wrong after that, so every fused
group shares one global scale, computed over all of its parts, even when the parts sit in different files.

## A test that could have failed

The first thing to check was that vLLM decodes this format the way I write it. I cut a larger NorthCUA
mixture-of-experts model, with the same expert layout as Mini, down to two of its layers: one linear-attention and one
full-attention layer, with the original embeddings, output head and vision encoder. Its output is meaningless, but it is deterministic, which is all a comparison needs. Then I ran the same
tokens (one 62-token prompt) through vLLM on the NVFP4 files and through four CPU references, and compared the
log-probabilities of vLLM's top 20 tokens at every position:

| CPU reference | Mean absolute log-probability difference from vLLM |
|:--|--:|
| the same NVFP4 weights, dequantized | 0.011 |
| the original BF16 weights | 0.013 |
| NVFP4 weights with gate and up deliberately swapped | 0.353 |
| NVFP4 weights with the experts zeroed | 0.112 |

On its own, 0.011 says little: the BF16 original was almost as close. What makes it a test is the two broken
references. A swapped gate and up, a classic mistake when splitting fused experts, lands 32 times further away, and
zeroed experts 10 times further. So the check catches a broken layout; it cannot rule out errors as small as the
quantization noise itself, and it ran on the larger model's layers, not on Mini's or Nano's files. Those two were
checked end to end instead, below.

Two bugs turned up before anything was published. The converter's first run on real files failed because the gate
and up halves of an expert shared one scale tensor in memory, which safetensors refuses to save. And while building
the cut-down model, its list of layers to keep in BF16 came out two short: it missed the two linear layers of the
vision encoder's merger, whose names do not follow the pattern of the others. The list is now built from the files
themselves: every two-dimensional weight left in BF16 that is not an embedding.

## Results against the originals

Each quantized model ran next to its BF16 original with the same prompts and greedy decoding, on my build of vLLM
0.32.0 (its patches concern multi-machine serving, not this format).

| Check | Nano NVFP4 | Nano BF16 | Mini NVFP4 | Mini BF16 |
|:--|:--|:--|:--|:--|
| 17 × 23 | 391 | 391 | 391 | 391 |
| 10 word problems, thinking on | 10/10 | 10/10 | 10/10 | 10/10 |
| 8 short factual questions | 8/8 | 8/8 | 8/8 | 8/8 |
| Tool call | correct | correct | correct | correct |
| A fact hidden in a prompt of about 25,000 tokens | found | found | found | found |
| One stream, 512 tokens, one run, prefill included | **161 tok/s** | 93 tok/s | 172 tok/s | 180 tok/s |
| Weights in GPU memory | 10.5 GiB | — | **22.3 GiB** | 65.5 GiB |

Both Nano versions ran one after the other on the same RTX 5090, where the quantized one was 1.7 times faster for a
single stream. The two Mini versions ran at the same time on two different RTX PRO 6000 cards, the quantized one on
the lower-power Max-Q card, so their 5% difference is not a measured effect. What Mini clearly gains is memory: its
weights take a third of the original's, which leaves room for long contexts on one GPU. The Nano numbers are as
recorded when I published it.

I also asked both versions where to click on five synthetic screenshots, with a plain prompt rather than the NorthCUA
Harness the models are trained for. Neither version was reliable with that prompt, so I report it only as a
comparison. Nano's original answered three of the five, and the quantized version's clicks were within 4 units (on the
0–1000 grid) of those three. Both versions of Mini missed at least two targets, different ones; 3 hits against 2 is
within noise.

These are smoke tests, not a rerun of the OSWorld or WebArena numbers in the NorthCUA report. Benchmarks will go
into the model cards as they come in.

One finding about the model itself: asked to repeat a "secret access code" hidden in a long text, the original Mini
refused: "I can't provide that code — I don't share embedded access codes or credentials, even when they appear in
text you've supplied." For a computer-use model that reads whatever is on screen, that is good behaviour, so the
long-context test for Mini hides a box count instead (I did not repeat the refusal test on the quantized version).

## Using them

Each model card has a Docker command for vLLM and Python examples that I ran against the served models: a screenshot
question, a request with thinking on, and a tool call. For computer use, run the models with the official
[NorthCUA Harness](https://github.com/china-qijizhifeng/NorthCUA-Harness), and keep every GUI coordinate in the
0–1000 grid the models were trained with.
