---
# Every number below was measured in my lab on 2026-11-05 and 2026-11-06 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "The first NVFP4 quants of NorthCUA on Hugging Face"
slug: northcua-nvfp4-quants
summary: >-
  NorthCUA is a new family of open computer-use models. On 2026-11-05 and 2026-11-06 I published the first NVFP4
  quantizations of all three on Hugging Face, for vLLM: Nano 18.8 GB down to 11.2 GB, Mini 70.2 GB down to 23.9 GB,
  and the 397B Pro 794 GB down to 238 GB, the only quantization of Pro in any format as of 2026-11-06. This post covers what was
  quantized and why, a two-layer test that checks vLLM reads the format as written, benchmarks against the original
  BF16 models, Pro on four DGX Sparks, and the public timestamps behind "first".
tags: [quantization, nvfp4, vllm, compressed-tensors, computer-use, moe, local-inference, hugging-face]
date: 2026-11-05
series: AI engineering notes
---

NorthCUA ([Nano](https://huggingface.co/beipo-ai/NorthCUA-Nano), [Mini](https://huggingface.co/beipo-ai/NorthCUA-Mini)
and [Pro](https://huggingface.co/beipo-ai/NorthCUA-Pro)) is a family of computer-use models from the NorthCUA team,
built on Qwen3.5 and released under Apache-2.0 at the turn of October and November. Given a screenshot and a task, they reply
with reasoning, text and tool calls, such as a click at a point on a 0–1000 grid.

I published NVFP4 quantizations of all three, Nano and Mini on 2026-11-05 and Pro on 2026-11-06 (UTC):

| Model | Original (BF16) | NVFP4 | Repository |
|:--|--:|--:|:--|
| NorthCUA-Nano (9B, dense) | 18.8 GB | 11.2 GB | [willyb23/NorthCUA-Nano-NVFP4A16](https://huggingface.co/willyb23/NorthCUA-Nano-NVFP4A16) |
| NorthCUA-Mini (35B, 3B active) | 70.2 GB | 23.9 GB | [willyb23/NorthCUA-Mini-NVFP4A16](https://huggingface.co/willyb23/NorthCUA-Mini-NVFP4A16) |
| NorthCUA-Pro (397B, 17B active) | 794 GB | 238 GB | [willyb23/NorthCUA-Pro-NVFP4A16](https://huggingface.co/willyb23/NorthCUA-Pro-NVFP4A16) |

All three are grouped in the [NorthCUA NVFP4 collection](https://huggingface.co/collections/willyb23/northcua-nvfp4-6aecfb2d402045ad0476e993).

## The first on Hugging Face

Hugging Face records when each repository was created and when every file was committed, and it lists, under each
model, the quantizations that declare it as their base. Anyone can check:

- the commit history of each repository: [Nano](https://huggingface.co/willyb23/NorthCUA-Nano-NVFP4A16/commits/main),
  [Mini](https://huggingface.co/willyb23/NorthCUA-Mini-NVFP4A16/commits/main),
  [Pro](https://huggingface.co/willyb23/NorthCUA-Pro-NVFP4A16/commits/main);
- every quantization linked to the originals: [Nano](https://huggingface.co/models?other=base_model:quantized:beipo-ai/NorthCUA-Nano),
  [Mini](https://huggingface.co/models?other=base_model:quantized:beipo-ai/NorthCUA-Mini),
  [Pro](https://huggingface.co/models?other=base_model:quantized:beipo-ai/NorthCUA-Pro).

I also saved what the Hub's public API returned, without logging in, after each model went public:
[snapshot 1](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-1.json) (after Nano) and
[snapshot 2](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-2.json) (after Mini),
[snapshot 3](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-3.json) (when the Pro
repository went public, upload still running) and
[snapshot 4](https://willboyden.github.io/portfolio/posts/northcua-nvfp4-quants/hub-snapshot-4.json) (after Pro was
complete and tested). They list every quantization linked to the
three NorthCUA models and every repository with NorthCUA in its name, with creation times:

| Original | Quantizations on the Hub (created, UTC) |
|:--|:--|
| NorthCUA-Nano | GGUF by mradermacher (2026-11-02 13:27); **NVFP4, this one (2026-11-05 21:46)** |
| NorthCUA-Mini | GGUF by bartowski (2026-11-03 16:03); GGUF by mradermacher (2026-11-05 13:59); **NVFP4, this one (2026-11-05 23:13)** |
| NorthCUA-Pro | **NVFP4, this one** (created private 2026-11-05 21:10; public by 2026-11-06 02:40 with a placeholder card; complete about 07:45); nothing else as of snapshot 4 (2026-11-06 08:11) |

As far as the Hub's public listings show, these are the first NVFP4 checkpoints of all three models, and the Pro one
is the only quantization of NorthCUA-Pro in any format: until they appeared, no repository linked under any of them and no repository with NorthCUA in its name was an
NVFP4 checkpoint, and the earlier quantizations were GGUF, the format of llama.cpp and Ollama. NVFP4 is the 4-bit
format of NVIDIA's Blackwell GPUs, served here through vLLM. My repositories are created private and made public after
the checks below, so their "created" times are minutes to a few hours earlier than the moment they became public. Pro is the
exception: its 238 GB upload outgrew the free account's private storage, so its repository went public by about
02:40 UTC on 2026-11-06 with a notice not to use it yet while the files were still arriving, and the full card replaced the
notice once the last file was up and the model had passed its tests (about 07:45 UTC).

## What was quantized, and why only that

NVFP4 stores each weight in 4 bits (FP4, E2M1), with one FP8 scale for every 16 weights and one FP32 scale for the
whole matrix.

- **Mini** is a mixture of experts: in each of its 40 layers, 256 small MLPs ("experts"), of which 8 run for any
  token. The experts hold most of the parameters, and they are what I quantized: 30,720 matrices.
- **Pro** has the same design at a larger size: 512 experts in each of its 60 layers, 10 of them per token, about
  97% of its parameters. Its 92,160 expert matrices are quantized the same way.
- **Nano** is dense: I quantized the MLP of all 32 layers and the projections of its 8 full-attention layers, 128
  matrices.

The linear-attention layers, the embeddings, the output head and the vision encoder stay in BF16 in all three. That is a
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

The first thing to check was that vLLM decodes this format the way I write it. I cut NorthCUA-Pro, which has the
same expert layout as Mini, down to two of its layers: one linear-attention and one
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
quantization noise itself, and it ran on two of Pro's layers, not on Mini's or Nano's files. All three were checked
end to end as well, below.

Two bugs turned up before anything was published. The converter's first run on real files failed because the gate
and up halves of an expert shared one scale tensor in memory, which safetensors refuses to save. And while building
the cut-down model, its list of layers to keep in BF16 came out two short: it missed the two linear layers of the
vision encoder's merger, whose names do not follow the pattern of the others. The list is now built from the files
themselves: every two-dimensional weight left in BF16 that is not an embedding.

## Results against the originals

Nano and Mini each ran next to their BF16 original with the same prompts and greedy decoding, on my build of vLLM
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
single stream (2.2 times in a second single run during the benchmarks, so treat the ratio as rough). The two Mini
versions ran at the same time on two different RTX PRO 6000 cards, the quantized one on the lower-power Max-Q card, so
their 5% difference is not a measured effect; a later single run during the benchmarks gave 181.8 against 181.9 tok/s. What Mini clearly gains is memory: its
weights take a third of the original's, which leaves room for long contexts on one GPU. The Nano numbers are as
recorded when I published it.

I also asked both versions where to click on five synthetic screenshots, with a plain prompt rather than the NorthCUA
Harness the models are trained for. Neither version was reliable with that prompt, so I report it only as a
comparison. Nano's original answered three of the five, and the quantized version's clicks were within 4 units (on the
0–1000 grid) of those three. Both versions of Mini missed at least two targets, different ones; 3 hits against 2 is
within noise.

These are smoke tests, not a rerun of the OSWorld or WebArena numbers in the NorthCUA report.

One finding about the model itself: asked to repeat a "secret access code" hidden in a long text, the original Mini
refused: "I can't provide that code — I don't share embedded access codes or credentials, even when they appear in
text you've supplied." For a computer-use model that reads whatever is on screen, that is good behaviour, so the
long-context test for Mini hides a box count instead (I did not repeat the refusal test on the quantized version).

## Benchmarks (added 2026-11-06)

To measure what the smoke tests cannot, I ran three benchmarks on Nano and Mini, quantized and BF16, with identical
requests: [ScreenSpot-Pro](https://huggingface.co/datasets/likaixin/ScreenSpot-Pro) (1,581 professional screenshots;
one click per screenshot, which must land inside the target box), and GSM8K and IFEval through lm-evaluation-harness.
Thinking was off and decoding greedy. For ScreenSpot-Pro the prompt follows the NorthCUA Harness's coordinate rules
and gives the model the Harness's `click` tool. Because each question was answered by both versions, I compared them
question by question with an exact McNemar test. A p below 0.05 is evidence of a difference; a p above it is not proof
that there is none, only that these sample sizes did not find one.

| Benchmark | Mini NVFP4 | Mini BF16 | p | Nano NVFP4 | Nano BF16 | p |
|:--|--:|--:|--:|--:|--:|--:|
| ScreenSpot-Pro (GUI grounding) | **62.05%** | 60.78% | 0.11 | 13.73% | **18.28%** | < 0.001 |
| GSM8K, 1,319, flexible extract | 87.04% | 86.73% | 0.80 | 81.65% | 83.78% | 0.047 |
| GSM8K, strict match | 82.11% | 82.94% | | 68.23% | 60.96% | |
| IFEval, 541, prompt-level strict | 78.74% | 80.41% | 0.33 | 68.95% | 69.32% | 0.91 |

**Mini shows no significant difference** on any of the three, and scored slightly higher on grounding. At these sample
sizes that rules out large losses, not small ones: IFEval's 95% interval for the difference reaches about −4.6
points.

**Nano loses grounding accuracy**: 4.55 points of ScreenSpot-Pro, a quarter of its hits (p < 0.001; the 95% interval
is about −6.0 to −3.1 points). GSM8K is inconclusive: under the flexible extraction the quantized version scores 2
points lower (p 0.047, the weakest of the six tests), and under strict matching it scores 7 points higher.
Instruction following is unchanged. A variant of Nano with its attention left in BF16 matched the original on GSM8K
(83.62% against 83.78%) but stayed low on grounding (14.23%), so the grounding loss comes from the quantized MLPs. One
possible reason, which I have not tested: in Mini each token's output mixes 8 quantized experts with a BF16 shared
expert, so independent rounding errors can partly cancel, while in Nano one dense MLP carries them all. A calibrated
quantization, which tunes the scales on real screenshots, is the next thing to try for Nano; meanwhile its card warns
about the grounding loss and points to the BF16 original for click accuracy. The NorthCUA authors did not publish
their exact grounding prompt, so these absolute scores are not comparable with their report; the comparison between
versions is.

## Pro on four DGX Sparks (added 2026-11-06)

Pro's BF16 original is 794 GB, more than the combined GPU memory of my machines, so it has no side-by-side
comparison. The quantized version is 238 GB, and at tensor-parallel 4 each GPU holds 55.7 GiB of weights. That fits
four NVIDIA DGX Spark machines (one GB10 GPU and 128 GB of memory each), linked by 200 GbE RoCE. I ran it there with
the stock vLLM 0.32.0 image:

| Check | Pro NVFP4, four DGX Sparks |
|:--|:--|
| 17 × 23 | 391 |
| 10 word problems, thinking on | 10/10 |
| 8 short factual questions | 8/8 |
| Tool call | correct |
| Click targets on five synthetic screenshots (the same plain prompt as above; not a grounding benchmark) | 5/5 inside the target |
| A fact hidden in a prompt of about 25,000 tokens | found |
| One stream, 512 tokens, prefill included | 24.1 tok/s |

It loaded in about ten minutes from a network share, and vLLM chose the same Marlin FP4 kernel as on the RTX 5090 and
RTX PRO 6000 in the earlier tests. The sampled weight error after quantization is 9.2% on average and 9.6% at most
(one expert in 64 measured in each of the 120 files that hold experts), against Mini's 9.5%. Weight error alone does
not predict the damage, though: Nano had the same error as Mini and still lost grounding accuracy. My expectation
that Pro's quantization costs as little as Mini's rests on their shared design, a mixture of experts quantized the
same way, and that is an inference, not a measurement of Pro.

I then ran the same ScreenSpot-Pro benchmark on Pro, with exactly the requests used for Mini and Nano. It scored
**68.56%** (1,084 of 1,581): 82.7% on text targets and 45.7% on icons. Question by question that is 6.5 points
better than Mini's quantization (95% interval 4.3 to 8.7 points; exact McNemar p < 0.001). The run took most of an
afternoon, because the Sparks reached my temperature limits (GPU 86 °C, SoC 93 °C) every few minutes and the
benchmark paused again and again to let them cool.

## Twice as fast with a drafter (added 2026-11-06)

Speculative decoding makes generation faster without changing which model answers: a small drafter proposes several
tokens, and the big model checks them all in one step, keeping the ones it agrees with. The usual drafter for a
Qwen3.5 model is its own multi-token-prediction (MTP) layer, but the NorthCUA checkpoints ship without it: their
configs set `mtp_num_hidden_layers` to 0 and contain no MTP weights. So I tried three replacements on each model,
on the same eight requests (four computer-use steps with a screenshot and the Harness's `click` tool, two word
problems, a short function and a copy-edit task), greedy, one request at a time:

| Model, hardware | Without drafter | Base model's MTP layer, grafted back | Prompt lookup (n-gram) | DFlash drafter, 7 tokens |
|:--|--:|--:|--:|--:|
| Nano, one RTX PRO 6000 | 158 tok/s | 1.08× | 1.07× | **2.25×** |
| Mini, one RTX PRO 6000 | 182 tok/s | 1.02× | 1.13× | **1.86×** |
| Pro, four DGX Sparks | 24.4 tok/s | not tried | not tried | **2.03×** |

The MTP layer from the base Qwen3.5 checkpoints loads cleanly once grafted back (I fetched only those tensors and
quantized its experts like the rest), but its drafts were mostly rejected: it was trained on the base model's hidden
states, and the fine-tune moved them. The DFlash drafters published by z-lab for the base models did much better,
although they were not trained on NorthCUA's outputs either. With eight requests in flight the gain shrinks (1.68× for
Nano, 1.34× for Mini), and it is smallest on computer-use steps, whose output is short and specific: 1.2 to 1.7×
on Nano, 1.0 to 1.2× on Mini and 1.4 to 1.75× on Pro. Word problems and code gain 2 to 3.5×, copying text 4 to 5×.

Speculative decoding is not bit-for-bit neutral: verifying several tokens at once uses slightly different GPU
arithmetic, so a greedy answer can change where two tokens are nearly tied. Without the drafter, the same request
always gave the same text. So I reran the three benchmarks on Mini and Nano with the drafter on. Nothing changed
significantly: Mini scored 61.10% on ScreenSpot-Pro (62.05% without; paired p 0.20), 85.44% on GSM8K (87.04%; p
0.11) and 78.74% on IFEval (the same), and Nano 14.23% (13.73%; p 0.13), 81.20% (81.65%; p 0.39) and 67.47%
(68.95%; p 0.27). On Pro I measured only the speed. Each model card now has the one-line vLLM option.

## Using them

Each model card has a vLLM command and Python examples that I ran against the served models: a screenshot question, a
request with thinking on, and a tool call. For computer use, run the models with the official
[NorthCUA Harness](https://github.com/china-qijizhifeng/NorthCUA-Harness), and keep every GUI coordinate in the
0–1000 grid the models were trained with.

On other engines: these checkpoints are tested on vLLM only. SGLang reads compressed-tensors checkpoints but has not
been tried with this layout yet. llama.cpp and Ollama load GGUF files instead, and GGUF quantizations of Nano and
Mini already exist (linked from their cards). TensorRT-LLM's NVFP4 support is built around NVIDIA's own ModelOpt
checkpoint layout, and I have not tried it with these files.

I posted a short note about each quantization in the NorthCUA team's community tab:
[Nano](https://huggingface.co/beipo-ai/NorthCUA-Nano/discussions/3),
[Mini](https://huggingface.co/beipo-ai/NorthCUA-Mini/discussions/3) and
[Pro](https://huggingface.co/beipo-ai/NorthCUA-Pro/discussions/2).
