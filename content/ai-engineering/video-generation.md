---
slug: video-generation
title: Video generation with LTX-2.5 on local GPUs
summary: >-
  Short films with synchronized speech, rendered by LTX-2.5 on three local GPUs
  and driven by an agent. Faces come from a reference image and voices from
  reference audio, and every clip is checked before it ships.
capability: Video generation
oneLiner: >-
  LTX-2.5 (22B, NVFP4) on ComfyUI across two RTX PRO 6000s and an RTX 5090 —
  native speech and lip sync, a multi-shot film pipeline, and per-clip checks
  for speech, voice and silence.
tags: [video, comfyui, ltx-video, agents, gpu]
date: 2026-10-17
status: shipped
stack: [LTX-2.5 22B distilled (NVFP4), ComfyUI, Gemma-4-12B text encoder, faster-whisper, ffmpeg, Python, Turnstone agent harness, rootless Docker]
howItWorks:
  - Three ComfyUI render workers — one per RTX PRO 6000 on the main workstation and one on the RTX 5090 in a second machine — load the same NVFP4 weights from one NFS share; all three cards are sm_120, so the same image and kernels run everywhere.
  - A shot list becomes one generation per shot, pulled off a shared queue so the faster card takes more shots; two to four connected shots can be rendered in a single generation when one character must hold across cuts.
  - LTX-2.5 generates speech and lip sync natively from the prompt. The face is anchored by a reference image and the voice by a reference audio clip — the two are independent and compose.
  - Prompts are written as prose, the way the model's guide asks — shot, scene, action, character, camera and audio in one paragraph, spoken lines in quotes, a beat of stillness before speech.
  - Every clip is verified, not sampled — transcribed with Whisper to catch wrong or repeated lines, compared against the reference voice, and checked for unwanted speech in cutaways.
  - An agent drives it — the video skills run in Turnstone (moved from a Hermes Agent setup), reaching ComfyUI and the GPUs only through brokers, and finished films are exported from its sandbox.
proof:
  - A text-to-video render on the RTX 5090 completes in 70–80 s, including the first load of the 18.7 GB transformer over NFS
  - Across five film builds, 22 of 24 shots passed their checks on the first try; the two failures were prompt-bound and passed after rewording
  - Native multi-shot generation held the voice within a 12.1 Hz pitch spread, against 41–68 Hz for every stitching scheme tried
  - Cutaways with no people in frame stayed silent in 18 of 19 renders; a person on screen talks even when told not to
limits:
  - The renders stay in the lab; there are no public samples yet.
  - Voice consistency is measured with a pitch proxy, not a speaker-embedding model, and its threshold has not been calibrated against listening tests.
  - The GPUs are shared with the language models — the 5090 runs either the routing tier or ComfyUI, and the workstation cards render only when the big model leaves room.
  - On the 5090 (32 GB) the model, text encoder and VAEs do not fit at once; the text encoder is evicted to host RAM between steps.
  - Chained continuations decay past about eight clips and can repeat a quoted line, so long scenes are cut into one generation per shot.
---

The first conclusion here was wrong, and it is worth recording: I decided the
model could not do dialogue without a separate text-to-speech stage, from
reading node descriptions. One render with a quoted line in the prompt showed
synchronized speech. Test the capability before declaring it missing.

### Measurement mistakes that cost four rebuilds

- **A visual fix judged with an audio metric.** Seeding each shot from a
  reference image was scored on voice pitch, called worse, and dropped. It was
  the right fix for the face all along. Match the measure to the mechanism.
- **Sampling hid half a defect.** Checking only the first clip of each speaking
  shot showed five clean matches while half the dialogue clips were broken.
- **The metric became the target.** Making "no speech" the pass condition for
  cutaways produced dead air. Asking for specific background sound fixed it.

Watching the output caught what four rounds of instrumentation missed.
