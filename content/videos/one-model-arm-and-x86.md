---
title: "Splitting an LLM Across ARM and x86 Machines for a 2.35x Speed Boost"
slug: one-model-arm-and-x86
summary: >-
  DeepSeek-V4.1-Flash-1017 is too big for any machine I own, so it runs across
  four Arm GB10 boxes (DGX Spark class) and an x86 workstation with two RTX PRO
  6000 cards. Splitting it by layers left the fast cards computing for under
  30% of each step; putting the trunk and the most-read experts on them, and
  the other experts on the GB10 boxes, made the same six GPUs 2.35 times
  faster at 16 requests. The narrator's voice and the video's pictures are
  AI-generated.
tags: [video, vllm, deepseek, moe, dgx-spark, local-inference, local-ai]
date: 2026-11-15
url: https://willboyden.github.io/portfolio/podcasts/one-model-arm-and-x86.mp3
provider: audio
duration: 7 min
speakers: [Narrator (AI voice)]
transcriptUrl: https://willboyden.github.io/portfolio/podcasts/one-model-arm-and-x86.txt
videoUrl: https://www.youtube.com/watch?v=FXo2z-qwjvA
thumbnail: /podcasts/one-model-arm-and-x86.webp
thumbnailAlt: "Cover with the words My fastest GPUs waited 70% of every step and the label Moved the experts: 2.35×, beside an AI-generated picture of a black graphics card with two fans"
---
