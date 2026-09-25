# Gates → GPUs: Computer Architecture Notes

Interactive study notes that build a computer from logic gates up to modern multi-core CPUs and GPUs. Every lesson starts from the limitation of the previous machine, introduces one new mechanism, and explains what it costs. Diagrams, worked examples and in-browser explorers throughout.

**Start here:** [`notes/index.html`](notes/index.html) (the course map)

## Contents

| Section | Topics |
|---|---|
| [Unit 1 · Build a computer](notes/unit-01-build-a-computer.html) | Bits and representation, gates and the ALU, clocked state, a stored-program machine (NIB-8 simulator) |
| [Unit 2 · Programs & contexts](notes/unit-02-registers-programs-contexts.html) | Registers and RISC-V, ISA vs. implementation, calls, stacks, traps and thread contexts |
| [Unit 3 · A faster core](notes/unit-03-faster-core.html) | Pipelining, hazards, caches, virtual memory, branch prediction, superscalar, renaming and out-of-order, precise retirement |
| [Unit 4 · Parallelism](notes/unit-04-parallelism.html) | Multicore and coherence, memory ordering, SMT, SIMD and vectors |
| [Unit 5 · Understand GPUs](notes/unit-05-gpus.html) | SIMT and the thread hierarchy, occupancy, warp scheduling, divergence, coalescing and banks, tiling and barriers, Roofline and measurement |
| [Unit 6 · Connect the modern system](notes/unit-06-modern-systems.html) | Matrix units and number formats, quantization, heterogeneous SoCs and shared memory, pipelining, packaging, HBM and NUMA, ring all-reduce and multi-GPU scaling |
| [CS149 lecture companions](notes/cs149/index.html) | Self-contained pages following Stanford CS149 *Parallel Computing* (Fall 2023); Lecture 1: *Why Parallelism? Why Efficiency?*; Lecture 2: *A Modern Multi-Core Processor*; Lecture 3: *Multi-Core Part II + Parallel Programming Abstractions* |

Unit 7 (case studies) is planned.

## Viewing locally

The notes are plain HTML, CSS and JavaScript, with no build step and no dependencies. Open `notes/index.html` in a browser. Fonts load from Google Fonts when online and fall back to system fonts offline.

To serve them locally, for example to test on a phone on the same network:

```bash
python3 -m http.server 8000 --directory notes
```

Then open <http://localhost:8000>.

## Publishing on GitHub Pages

1. Push this repository to GitHub (public, or private on a plan that supports Pages).
2. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and the `/ (root)` folder.
3. The notes appear at `https://<username>.github.io/<repository>/`. The root `index.html` redirects to `notes/`, and `.nojekyll` tells GitHub to serve the files as they are, with no Jekyll processing.


## Repository layout

```
index.html             redirects the site root to notes/
notes/                 the published site
  index.html           course map
  unit-0N-*.html       units 1–6
  cs149/               Stanford CS149 lecture companions
  assets/              shared stylesheet and script
chatgpt-reference/     ChatGPT-generated drafts (units 1–6) used as inspiration (not linked from the site)
Stan-CS149/            place for local copies of lecture slides (ignored by git)
```

## Sources and copyright

- The explanations, diagrams and interactive models in `notes/` are original study material.
- The CS149 companion pages follow the structure and examples of Stanford CS149 (Fall 2023), taught by Kayvon Fatahalian and Kunle Olukotun. The course slides are © Stanford University and the instructors. They are **not** included in this repository (see `.gitignore`). Get them from the [course site](https://gfxcourses.stanford.edu/cs149/fall23).
- Processor specifications (Intel Kaby Lake, NVIDIA V100, H100 and others) are as published by their vendors or as presented in the lectures. Teaching machines (NIB-8, the five-stage pipeline, the tiny caches) are simplified models for tracing, not real products.
