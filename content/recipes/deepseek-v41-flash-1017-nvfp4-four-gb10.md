---
# Every number below was measured on my four-GB10 lane between 2026-10-23 and
# 2026-10-24 (source: my private lab notes, "Measured" section).
# Host names, addresses, ports, user names and keys are placeholders on purpose.
title: DeepSeek-V4.1-Flash-1017 (NVFP4) on four GB10 boxes
summary: >-
  One vLLM engine across four GB10 boxes serves DeepSeek-V4.1-Flash-1017 in
  NVFP4 with a 1M-token window. Two fixes cut a decode step from ~79 to ~61 ms.
tags: [deepseek, vllm, nvfp4, gb10, dgx-spark, speculative-decoding, local-inference]
date: 2026-10-24
hardware: 4 × NVIDIA GB10 (DGX Spark class), 128 GB unified memory each, ConnectX-7 on a 200 GbE switch
model: DeepSeek-V4.1-Flash-1017, NVFP4 W4A4 experts (LibertAIDAI quant, rev 5be99cd)
engine: vLLM nightly 0cbac6cd1 + 9 Python-only patches · tensor-parallel 4 · DSpark, 5 drafts
status: in-use
results:
  - Decode step, 32K–180K context = ~61 ms
  - Agent loop, thinking on = 71 tok/s
  - Prefill, text not seen before = 2.5–3.0K tok/s
  - Context window = 1,048,576 tokens
---

This is how I run DeepSeek's October 17 release of V4.1 Flash as **one** engine across four GB10 machines: the exact
checkpoint, the image, every flag, the storage and kernel settings that mattered, the measured speeds, and the tests
behind them. It is written so you can rebuild it. Where my setup has a machine name, an address, a port or a key, this
page has a placeholder in angle brackets.

The short version: the published four-GB10 recipe got me running at the speeds its author reported, and two changes
made it about 25% faster per decode step on real agentic coding work. One was a storage setting on the server that
holds the weights. The other was turning on part of vLLM's kernel autotuning, after the full autotune deadlocked.

## What runs

| Part | What I used |
|---|---|
| Model | `deepseek-ai/DeepSeek-V4.1-Flash-1017`: 40 layers, 384 routed experts (6 active per token) plus 1 shared expert, two Engram n-gram tables (layers 1 and 14), its own speculative drafter (DSpark) |
| Checkpoint | [`LibertAIDAI/DeepSeek-V4.1-Flash-1017-NVFP4`](https://huggingface.co/LibertAIDAI/DeepSeek-V4.1-Flash-1017-NVFP4) at revision `5be99cd15675589fb6693d0a8651e413bcb9a396`: 48 shards, 399.5 GiB |
| Quantization | routed experts NVFP4 W4A4 (a bit-exact transcode of the MXFP4 originals); Engram tables MXFP4 (lossy: cosine 0.9934 against the FP8 source); everything else as released |
| Machines | two ASUS Ascent GX10 and two Gigabyte AI TOP ATOM (all GB10: 20 Arm cores, 128 GB LPDDR5X shared by CPU and GPU) |
| Network | one ConnectX-7 port per box into one switch, RoCE v2, MTU 9000 |
| Host software | NVIDIA driver 580.178.04, Docker 29.6 with GPU access; everything else is inside the image |
| Engine | vLLM nightly `0.30.1rc1.dev558` (commit `0cbac6cd1`) plus nine Python-only patches |
| Layout | tensor-parallel 4: one process per box, vLLM's own multiprocessing launcher (no Ray) |
| Window | 1,048,576 tokens; the KV pool holds 2,508,742 tokens (8 GiB per box) |
| Speculative decoding | DSpark, 5 draft tokens per step |
| API | OpenAI-compatible, on node 0, behind an API key |

## The measured result

All numbers are from 2026-10-24, sampling at temperature 1.0 and top_p 1.0 (what the model card asks for; lower
temperatures make this model loop in its reasoning).

| Test | Result |
|---|---|
| Decode step at 32K / 100K / 180K tokens of context | 62.0 / 60.7 / 60.5 ms |
| Decode speed in that test | 58.8 / 73.0 / 71.8 tok/s (tokens per step varies with what it is writing) |
| Agent loop, thinking on, 3 rounds, engine totals | **71.3 tok/s**, 60.5 ms per step, 4.32 tokens per step; 3/3 rounds pass |
| Time to first token on a turn whose prompt is cached | 0.44–0.51 s |
| Prefill of text the model has not seen before | 2.5–3.0K tok/s (10.6 s for a fresh 30K-token prompt) |
| Boot, launch to first answer | 4–6 minutes |

How each of these was measured is in [How I measured](#how-i-measured). For comparison, the published recipe I started
from reports 65–67 tok/s for single-stream code; my first boot measured 67.3 tok/s on the same kind of test, before
either change below.

## 1. Hardware and network

- **Four GB10 machines.** Mixed vendors are fine; mine are two ASUS Ascent GX10 and two Gigabyte AI TOP ATOM. Each has
  128 GB of memory that the CPU and the GPU share (122 GiB visible to Linux). That sharing matters twice below: the KV
  cache is set in bytes, not as a share of GPU memory, and anything that allocates GPU memory also squeezes the Linux
  page cache.
- **One network.** One ConnectX-7 port per machine into one switch, MTU 9000, RoCE v2. GB10 shows that port as two
  RDMA devices (two PCIe halves); NCCL uses both (`rocep1s0f1` and `roceP2p1s0f1` on mine; `ls /sys/class/infiniband`
  lists yours). Keep this network to these machines only: vLLM's traffic between ranks is not authenticated.
- **The RoCE v2 IPv4 GID** is index 3 on all four of mine. Check yours with `show_gids` or
  `cat /sys/class/infiniband/<dev>/ports/1/gid_attrs/types/*`.
- **A separate storage server** exports the model folder over NFS (NFS over RDMA in my case), and every GB10 mounts it
  read-only at the same path. I use `/srv/models` on this page.
- **Cooling.** Node 0 (the one serving the API) runs hottest, because it also runs vLLM's API server and engine core.
  Under sustained decode its SoC reached 85–89 °C, and several times it touched 90–91 °C. Benchmarks here run under a
  watchdog that stops them at GPU 82 °C or SoC 90 °C; the other three boxes stayed at 65–80 °C. Idle, node 0 sits at
  45–50 °C.

## 2. The weights

Download only what vLLM needs. The repository also carries Python scripts (DeepSeek's reference inference code and the
quantizer's conversion scripts); vLLM needs none of them, and this setup never passes `--trust-remote-code`.

```bash
HF_HUB_DISABLE_XET=1 hf download LibertAIDAI/DeepSeek-V4.1-Flash-1017-NVFP4 \
  --revision 5be99cd15675589fb6693d0a8651e413bcb9a396 \
  --cache-dir /srv/models/hub --max-workers 2 \
  --include '*.safetensors' --include config.json --include hf_quant_config.json \
  --include model.safetensors.index.json --include tokenizer.json --include tokenizer_config.json \
  --include LICENSE --include README.md
```

Two traps:

- **xet off, two workers.** With xet on, `huggingface_hub` 2.x assembles whole files in RAM. With 52 GB shards that
  means tens of GB of RAM per worker.
- **Shards 47 and 48 refuse to download without xet.** They are 52.4 GB each: the two Engram tables. `hf` 2.2.0 stops
  with "The file is too large to be downloaded using the regular download method". I fetched those two with resumable
  HTTP range requests from the Hub's resolve URL, then checked each file's sha256 against its LFS id before linking it
  into the snapshot:

```bash
url=https://huggingface.co/LibertAIDAI/DeepSeek-V4.1-Flash-1017-NVFP4/resolve/5be99cd15675589fb6693d0a8651e413bcb9a396/model-00047-of-00048.safetensors
until curl -fL --retry 5 -C - -o model-00047.part "$url"; do sleep 10; done
sha256sum model-00047.part   # must equal the LFS oid the Hub lists for this file
```

Then prove the whole snapshot matches the Hub byte for byte: the sha256 of all 48 shards against their LFS ids, and
the git blob sha1 of the small files. Mine passed with 55 files checked, 0 problems.

### Put the Engram shards on small records

If the share is ZFS, do this now. It was the biggest fix in this whole recipe (section 6 tells the story).

The engine reads Engram rows, 136 bytes each at random offsets, straight from those two shard files on every step.
A dataset with `recordsize=1M` makes every 4 KB read cost a full 1 MiB record. Rewrite just those two files with
16 KiB records and leave the rest of the dataset as it was. ZFS fixes a file's block size when the file is written,
so:

```bash
sudo zfs set recordsize=16K <pool>/<dataset>
for blob in <sha256-of-shard-47> <sha256-of-shard-48>; do        # blob names under hub/.../blobs/
  dd if="$blob" of="$blob.16k" bs=16M iflag=fullblock conv=fsync status=none
  [ "$(sha256sum < "$blob.16k" | cut -d' ' -f1)" = "$blob" ] && mv -f "$blob.16k" "$blob"
done
sudo zfs set recordsize=1M <pool>/<dataset>
stat -c %o <blob>    # ZFS reports the file's record size here: 16384 afterwards
```

Use `dd`, not `cp`. On a pool with block cloning (OpenZFS 2.2+ with `feature@block_cloning` active), `cp`'s
`copy_file_range` clones the old 1 MiB blocks instead of rewriting them, and nothing changes. Do the rewrite with the
engine stopped: the ranks memory-map these files over NFS, and swapping a file under them leaves stale file handles.

## 3. The image

**Base:** the vLLM nightly for commit `0cbac6cd1`, pinned by digest:
`vllm/vllm-openai@sha256:8e6e3752946ff2dde451b313cbaec2ea8e7b52221b21bfbcf53fb68dd4f4c42e` (a multi-arch manifest;
the GB10s use its arm64 image).

**Patches:** nine, all Python, applied with zero fuzz. They are the set from
[calvarado2004/deepseek-v41-1017-nvfp4](https://github.com/calvarado2004/deepseek-v41-1017-nvfp4) at `8f57fb8`
(the published four-GB10 recipe this one starts from), unchanged:

| Patch | What it does | Origin |
|---|---|---|
| 0001 | Engram rows read from the checkpoint file each step (`--engram-config {"disk_offload": true}`) | [ondigo-winder](https://github.com/ondigo-winder/deepseek-v4_1-1017-4-gb10) |
| 0002 | V4.1 on sm_12x: per-layer KV page sizes, a null-block fix, the DSpark drafter's experts on MXFP4 | ondigo-winder |
| 0003 | MXFP4 Engram tables (this checkpoint), widened to E4M3 on the GPU. Only works through 0001's disk path | ondigo-winder |
| 0004 | the V4.1 encoder synced with the 1017 reference (Python part of vllm#62196) | vLLM |
| 0005 | DeepGEMM: restore SM12x contiguous-layout alignment 64 (vllm#58681) | vLLM |
| 0006 | `draft_context_window` for DSpark (vllm#61261) | vLLM |
| 0007 | fresh random draws across block-verification rounds (vllm#61161) | vLLM |
| 0008 | skip bonus-logit reductions for short drafts (vllm#61451) | vLLM |
| 0009 | V4.1 image order follows rendered content (vllm#60792) | vLLM |

I skipped that recipe's 0010 (a faster InstantTensor loader). Before using any of them I read every hunk: they only
open checkpoint files read-only, and they add no subprocess, network, `eval` or pickle calls.

**Why this nightly and not the v0.32.0 release:** on v0.32.0 the patch set leaves seven hunks to merge by hand,
including 0001's Engram reader, whose lookup-kernel call changed signature. A mistake there corrupts output without
an error. On this nightly all nine apply cleanly.

**Build without running anything.** Because the patches are pure Python, the image needs no `RUN` step:

1. List the files the patches touch (`+++ b/...` lines).
2. Copy each original out of the base with `docker create` and `docker cp`, so nothing in the image runs.
3. Apply the patches with `patch -p1 --fuzz=0`. Any reject stops the build.
4. Byte-compile the patched files with the image's own Python 3.12, in a container with `--network none`.
5. COPY the result over the installed package.

```dockerfile
FROM vllm/vllm-openai@sha256:8e6e3752946ff2dde451b313cbaec2ea8e7b52221b21bfbcf53fb68dd4f4c42e
COPY vllm/ /usr/local/lib/python3.12/dist-packages/vllm/
COPY no-merge.jinja /opt/recipe/no-merge.jinja
```

`no-merge.jinja` is one line, `{% for m in messages %}{{ m['content'] }}{% endfor %}`. DeepSeek ships no Jinja
template, and the V4.1 tokenizer mode builds the prompt itself, but vLLM still wants a template file. The line and that
reason come from the reference recipe's launcher.

With no `RUN` steps, one `docker buildx build --platform linux/amd64,linux/arm64 --network none` works on an x86 box
without QEMU. Building on one GB10 works too. Export the arm64 image with `docker save`, put the tar and its sha256 on
the share, and on every GB10 check the sha256 before `docker load`. Every rank must run byte-identical Python: compare
the sha256 of the patched files across nodes before the first boot.

## 4. Launch

One container per machine, the same image, the same flags; only the node rank differs. Start nodes 3, 2 and 1 first,
then node 0, which also serves the API.

```bash
docker run -d --name dsv41-r<RANK> \
  --gpus all --network host --ipc host --shm-size 32g \
  --device /dev/infiniband --cap-add IPC_LOCK \
  --ulimit memlock=-1 --ulimit stack=67108864 --ulimit nofile=1048576:1048576 \
  -v /srv/models:/srv/models:ro -v /srv/vllm-cache:/cache \
  -e VLLM_HOST_IP=<THIS_NODE_FABRIC_IP> \
  -e NCCL_SOCKET_IFNAME==<FABRIC_NETDEV> -e GLOO_SOCKET_IFNAME=<FABRIC_NETDEV> \
  -e NCCL_IB_HCA==rocep1s0f1,roceP2p1s0f1 \
  -e NCCL_NET=IB -e NCCL_IB_DISABLE=0 -e NCCL_NET_PLUGIN=none \
  -e NCCL_IB_ROCE_VERSION_NUM=2 -e NCCL_IB_GID_INDEX=3 \
  -e NCCL_IB_MERGE_NICS=0 -e NCCL_CROSS_NIC=0 -e NCCL_NVLS_ENABLE=0 -e NCCL_CUMEM_ENABLE=0 \
  -e NCCL_MAX_NCHANNELS=8 \
  -e HF_HUB_OFFLINE=1 -e TRANSFORMERS_OFFLINE=1 -e HF_HUB_DISABLE_TELEMETRY=1 \
  -e VLLM_NO_USAGE_STATS=1 -e DO_NOT_TRACK=1 \
  -e VLLM_WORKER_MULTIPROC_METHOD=spawn -e VLLM_ENGINE_READY_TIMEOUT_S=3600 \
  -e PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True -e VLLM_SAFETENSORS_CLONE_ON_LOAD=1 \
  -e HOME=/cache -e HF_HOME=/cache/hf -e XDG_CACHE_HOME=/cache -e VLLM_CACHE_ROOT=/cache/vllm \
  -e TRITON_CACHE_DIR=/cache/triton -e TORCHINDUCTOR_CACHE_DIR=/cache/inductor -e CUDA_CACHE_PATH=/cache/nv \
  -e FLASHINFER_WORKSPACE_BASE=/cache/fi -e VLLM_FLASHINFER_AUTOTUNE_CACHE_DIR=/cache/fi-autotune \
  -e VLLM_FLASHINFER_AUTOTUNE_SKIP_OPS=mxfp8_gemm,trtllm::fused_moe::gemm1,trtllm::fused_moe::gemm2 \
  --entrypoint vllm <IMAGE> serve /srv/models/hub/models--LibertAIDAI--DeepSeek-V4.1-Flash-1017-NVFP4/snapshots/5be99cd15675589fb6693d0a8651e413bcb9a396 \
  --served-model-name deepseek-v4.1-flash-1017 \
  --tensor-parallel-size 4 --pipeline-parallel-size 1 \
  --distributed-executor-backend mp --nnodes 4 --node-rank <RANK> \
  --master-addr <NODE0_FABRIC_IP> --master-port <MASTER_PORT> \
  --max-model-len 1048576 --kv-cache-memory-bytes 8589934592 --gpu-memory-utilization 0.80 \
  --max-num-seqs 16 --max-num-batched-tokens 8192 \
  --language-model-only --enable-prompt-tokens-details \
  --chat-template /opt/recipe/no-merge.jinja \
  --kernel-config '{"enable_flashinfer_autotune": true}' \
  --engram-config '{"disk_offload": true, "disk_offload_threads": 64}' \
  --attention-config '{"indexer_kv_dtype": "mxfp4"}' \
  --speculative-config '{"method": "dspark", "num_speculative_tokens": 5, "draft_sample_method": "probabilistic", "rejection_sample_method": "block", "enable_adaptive_verification": false, "draft_context_window": 32768}' \
  --reasoning-parser deepseek_v41 --enable-auto-tool-choice --tool-call-parser deepseek_v41 \
  --override-generation-config '{"temperature": 1.0, "top_p": 1.0}' \
  <ON NODE 0: --host <NODE0_FABRIC_IP> --port <PORT> and --env-file <file holding VLLM_API_KEY=...>>
  <ON NODES 1-3: --headless>
```

Why these values:

- **`--kv-cache-memory-bytes 8589934592`** (8 GiB): set the KV pool in bytes. With it set, vLLM skips its memory
  profiling and `--gpu-memory-utilization` only gates start-up, which is what you want when CPU and GPU share one pool.
  8 GiB per rank gives 2,508,742 tokens: 2.39 full 1M-token requests.
- **`--engram-config` with `disk_offload`**: at tensor-parallel 4 the MXFP4 Engram tables do not fit beside 77.6 GiB of
  weights per rank. Rows are read from the shard files through the page cache instead. With this checkpoint it is
  also the only path patch 0003 supports.
- **`--attention-config {"indexer_kv_dtype": "mxfp4"}`**: the sparse-attention indexer's K cache in MXFP4 instead of
  FP8, which grows the KV pool (about 40% on GB10, per the reference recipe; sm_12x only).
- **`--language-model-only`**: text only. Image and URL inputs are off.
- **`--override-generation-config`**: the model card's sampling becomes the server default, so clients that send
  nothing still get temperature 1.0 and top_p 1.0.
- **`NCCL_MAX_NCHANNELS=8`**: GB10 has no GPUDirect RDMA, so each NCCL connection pins about 9 MiB of host memory for
  the NIC. Eight channels keeps that to about 2.7 GiB per node.
- **`--kernel-config` autotune plus the skip list**: see section 7. Leave the skip list out and the boot can hang.

**Ready check.** The first boot takes 4–6 minutes: about 3.5 minutes of weight loading over NFS (target model, then
the drafter), JIT kernel warmup, then CUDA-graph capture. `/health` answering 200 does not prove the peers are alive,
so prove the engine with a real completion:

```bash
curl -s http://<NODE0_FABRIC_IP>:<PORT>/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model": "deepseek-v4.1-flash-1017", "max_tokens": 64,
       "chat_template_kwargs": {"thinking": false},
       "messages": [{"role": "user", "content": "What is 17*23? Answer with just the number."}]}'
# expect "content": "391", finish_reason "stop"
```

## 5. Using it

- **Thinking is on by default.** Send `"chat_template_kwargs": {"thinking": false}` on `/v1/chat/completions` to turn it
  off for a request. With thinking on, give `max_tokens` room (4096 or more), or a short cap returns empty content.
- **When streaming, the thinking arrives in a delta field named `reasoning`**, not `reasoning_content`. A client or
  benchmark that ignores it times the first answer token instead of the first token, and over-counts decode speed.
- **Tool calls work** with the `deepseek_v41` parser and come back with `finish_reason: "tool_calls"`.
- **Expect the first few minutes after any restart to be slower.** Loading ~78 GB of weights through the page cache
  pushes the Engram rows out. My first agent run after a boot measured 58–65 tok/s; later runs measured about 71.

## 6. The fix that mattered most: Engram on small records

**How I found it.** I ran the lane on a normal agentic-coding session with opencode (about 100 requests) and read
vLLM's own Prometheus metrics afterwards:

- **Prompts were big:** a median of 108K tokens, p90 182K, but 98% of prompt tokens came from the prefix cache.
- **Decode was nearly all the time:** 89% of request time (1,198 of 1,342 s), prefill 10%, queueing 0.
- **The step rate:** ~79 ms per decode step, 3.9 tokens per step, so ~49 tok/s.
- **Draft acceptance by position:** 85 / 70 / 56 / 45 / 35%.

So decode step time was the target. A sweep showed it did not depend on context length (78 / 78 / 77 / 82 ms at 2K /
32K / 100K / 180K), which pointed at fixed per-step costs.

Then one request with about 326K tokens of context and new content took **8 minutes 40 seconds** to prefill. The
evidence during that stall:

- one GB10 sat at 61% iowait with its GPU idle, while two others spun at 96% "utilization" (really NCCL waiting for
  it);
- the storage server answered ~97 MB/s of NFS reads while its pool read **1.5 GB/s** from the drives.

**Why.** The dataset holding the model had `recordsize=1M` and `primarycache=metadata`, settings that are right for
streaming 400 GB of weights. Engram rows are tiny and random, and the engine gathers them before every step. Each rank
maps ~47 GiB of rows, but the page cache beside the weights holds only ~13–17 GiB. New n-grams keep landing on rows
that aren't cached, and every miss cost a full 1 MiB read on the server. During the normal session the server
answered 400–4,000 NFS reads per second, about 130–170 per decode step.

I made the stall worse myself: an NCCL benchmark I had just run allocated GPU memory, which on GB10 is page-cache
memory, and evicted the warm rows.

**The change:** the two Engram shards on 16 KiB records (section 2). Measured right after a restart, with every row
cold:

| Test | 1 MiB records | 16 KiB records |
|---|---|---|
| Time to first token, fresh prompt 32K / 100K / 180K | 19.6 / 36.2 / 49.9 s | 12.2 / 20.2 / 25.4 s |
| Prefill of new text | 1.5–1.7K tok/s | 2.5–3.0K tok/s |
| Agent loop, thinking on (decode median) | 59.0 tok/s | 63.8 tok/s |

With vLLM's `VLLM_ENGRAM_TIMING=1` log, a decode step now spends ~1.0–1.5 ms per table gathering 36–40 rows per rank.
That is about 3 ms of a step. So this fixed prefill and the stalls, but it did not explain the rest of the 75 ms.

## 7. The second fix: decode-only FlashInfer autotune

**Profile first.** vLLM's torch profiler (`--profiler-config '{"profiler": "torch", "torch_profiler_dir": "...",
"delay_iterations": 5, "max_iterations": 40}'`, then `POST /start_profile`, one request, `POST /stop_profile`) captured
40 decode steps on every rank. Every rank did the same GPU work, about 72 ms per step:

| Kernel family | Per step |
|---|---|
| MXFP8 dense GEMMs (`DeviceGemmMxfp8GemmSm120`, ~5.7 per layer) | 25.8 ms: 229 calls × 112 µs |
| MoE grouped GEMMs | 23.2 ms: 80 calls × 290 µs, close to GB10's memory bandwidth already |
| BF16 GEMMs on old SM80 WMMA kernels | ~9.5 ms |
| attention + indexer, norms, Engram, sampling | ~6 ms |

By my estimate the MXFP8 GEMMs ran 6–7× slower than just reading their weights would take: each call gets a 6-row
input (one verify step), and the default kernel used a 128 × 32 × 128 tile. Picking the right kernel variant for a
shape is what FlashInfer's autotuner does. It was off, because the configuration I started from disables it.

**The full autotune deadlocked.** With `enable_flashinfer_autotune: true` vLLM runs two passes.

1. **A decode-sized pass.** Rank 0 tunes alone and broadcasts the result; it tuned `mxfp8_gemm` and the fused-MoE
   GEMMs and saved 77 configs.
2. **A prefill-sized pass.** All ranks tune in lockstep over a CPU process group. At the end of this one, rank 0 sat
   in an NCCL kernel while the other three waited on the CPU group, for good.

That was not slow storage: the server served zero NFS reads and the GB10s showed no iowait.

**The workaround.** vLLM has a skip list for the second pass, `VLLM_FLASHINFER_AUTOTUNE_SKIP_OPS`. Listing the three ops
the first pass already tuned (`mxfp8_gemm`, `trtllm::fused_moe::gemm1`, `trtllm::fused_moe::gemm2`) makes the second
pass finish in about 6 seconds, and the decode configs stay loaded on every rank. The cache lives in
`VLLM_FLASHINFER_AUTOTUNE_CACHE_DIR`, so later boots reuse it. Prefill keeps the default tactics. If a newer image
hangs after "Running FlashInfer autotune", add the op it was tuning to the list.

**The result**, measured the same way before and after:

| Test | Engram fix only | + decode autotune |
|---|---|---|
| MXFP8 GEMM per call | 112 µs | 51 µs |
| Decode step at 32K / 100K / 180K | 74.1 / 71.6 / 87.5 ms | 62.0 / 60.7 / 60.5 ms |
| The same profiled 400-token request | 24.1 s | 15.2 s |
| Agent loop, thinking on (decode median) | 63.8 tok/s | 78.9 tok/s with warm rows |

From this morning's 77–82 ms per decode step to ~61 ms: about 25% less time per step.

## 8. What did not help

All measured, all reverted.

| Tried | Result |
|---|---|
| 7 draft tokens (the reference recipe's choice) | Same agent-loop speed as 5 (68.1 vs 69.3 tok/s) and node 0 hit SoC 90–91 °C |
| 6 draft tokens, after the autotune | 69.0 ms per step at 32K for 3.89 tokens (5 drafts: 62.0 ms for 3.65), and node 0 hit 90 °C |
| 4 draft tokens | 69.4 tok/s against 71.3 with 5 (agent loop, engine totals). On real sessions, dropping a draft costs ~9% of tokens to save ~4% of time |
| KV pool 4 GiB instead of 8 (4 GiB more page cache per node) | No measurable change: 69.5 vs 71.3 tok/s, same NFS traffic. New text keeps hitting rows it has never seen |
| NCCL tuning | Already near its floor: ~76 µs per decode-size all-reduce across four nodes, ~9 ms of a step. `NCCL_PROTO=LL` was no faster, one RDMA device instead of two the same, and `NCCL_ALGO=Tree` is refused ("invalid usage") |
| cuBLASLt for the BF16 GEMMs (`TORCH_BLAS_PREFER_CUBLASLT=1`) | Identical to cuBLAS on these shapes in a microbenchmark |
| torch.compile | Off by design for this model: vLLM runs it with breakable CUDA graphs and its own fused kernels |

What is left needs code, not settings: small-M kernels (or FP8 weights) for the BF16 projections, and tuned tactics
for prefill once the lockstep autotune stops deadlocking.

## How I measured

Every benchmark ran under a watchdog that sampled all four machines every 5 seconds and stopped the run at GPU 82 °C or
SoC 90 °C. The numbers come from vLLM's own counters, so client overhead is not in them.

- **Real use:** the counters on node 0's `/metrics` over the session window.
  - Decode vs prefill time: `vllm:request_decode_time_seconds_sum` and `vllm:request_prefill_time_seconds_sum`.
  - Steps: `vllm:spec_decode_num_drafts_total`, one per verify step.
  - Acceptance: `vllm:spec_decode_num_accepted_tokens_per_pos_total`.
  - Prefix-cache hits: `vllm:prefix_cache_hits_total` over `vllm:prefix_cache_queries_total`.
- **Context sweep:** one instruction ("list the files above, one line each") after 2K, 32K, 100K and 180K tokens of
  source code, thinking off, 700 output tokens, one request at a time. Per request: decode seconds ÷ verify steps from
  the counter deltas = ms per step.
- **Agent loop:** a scripted coding task against a small generated repository: read two files (parallel tool calls),
  write the fix, run the tests, summarize. Thinking on, 3 rounds after a warm-up run, every tool call answered. A round
  passes only if the fix is correct and the tests ran after it. Reported as engine totals (tokens ÷ decode seconds),
  which is steadier than a per-turn median.
- **Profiles:** vLLM's torch profiler as in section 7, then GPU time per kernel name per step from the trace.
- **NCCL:** a torch.distributed all-reduce benchmark on the same four ranks, image and NCCL settings, median of 200
  calls per size. A 20-call run read 180–200 µs because its median still included connection warm-up.

## How I got here

1. **Start from the published recipe.** The four-GB10 card from calvarado2004 (built on ondigo-winder's patches) is a
   published, measured vLLM configuration for this exact checkpoint on GB10. I pinned the same base, the same patches
   and most of its settings, and my first boot matched its reported speed (67.3 vs 65–67 tok/s single-stream code).
   Differences: weights on a network share instead of local NVMe, stock NCCL through a switch instead of a switchless
   ring, the stock model loader, and no `--trust-remote-code`.
2. **Tune for my traffic.** I kept 5 drafts instead of 7: the same speed in my agent loop, and less heat on node 0.
3. **Measure real use, not just benchmarks.** One working session showed decode was 89% of the time, and that step time
   did not depend on context. That ruled out attention and pointed at fixed per-step costs.
4. **Chase the stall.** iowait on one node, NCCL spin on the others and the server's drive throughput pointed at the
   storage. The record size explained it.
5. **Profile before guessing.** The per-kernel profile showed one kernel family 6–7× off its bandwidth limit, and that
   is the kind of problem an autotuner fixes.
6. **When the autotune hung, find out where.** Two passes; only the second deadlocks; vLLM already had the skip list.
   My first reaction had been to write autotune off. It was worth the second look.
7. **Try the cheap ideas too, and keep only what measures.** Draft count, KV size, NCCL settings and BLAS backend all
   came back flat (section 8).

## Security notes

- Keep the inter-node network private to these machines. vLLM's traffic between ranks (its TCP store, ZMQ and NCCL)
  is not authenticated.
- Put the API behind a key (`VLLM_API_KEY` from an env file, not on the command line), bind it to the private address
  only, and put a router or gateway in front if anything else needs it.
- Run offline: `HF_HUB_OFFLINE=1` and the telemetry switches above. The weights are read-only on every node.
- Never pass `--trust-remote-code` for this checkpoint, and do not download the repository's Python files; vLLM needs
  neither.
- Read the patches before you build. They change the engine's Python, and you are running them as root inside a
  container with host networking.

## Credits

- [DeepSeek](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017) for the model (MIT licence).
- [LibertAIDAI](https://huggingface.co/LibertAIDAI/DeepSeek-V4.1-Flash-1017-NVFP4) for the NVFP4 quantization.
- [ondigo-winder](https://github.com/ondigo-winder/deepseek-v4_1-1017-4-gb10) for the GB10 patches 0001–0003 (Apache-2.0).
- [calvarado2004](https://github.com/calvarado2004/deepseek-v41-1017-nvfp4) for the four-GB10 recipe this one starts from.
- The [vLLM](https://github.com/vllm-project/vllm) contributors behind patches 0004–0009.
- DevQuasar's write-up on [mixing a DGX Spark and an RTX 6000 Pro in one cluster](https://devquasar.com/ai/edge-ai/distributed-inference-cluster-dgx-spark-rtx-6000-pro/),
  which started me on clustering these machines.
