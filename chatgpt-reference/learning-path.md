# From a tiny computer to modern CPUs and GPUs

A course plan and learning contract · Version 1 · 25 September 2026

Start with [Unit 1: Build the smallest useful computer](unit-01-foundations.md). Its [worked answers](unit-01-answers.md) are separate so you can make predictions first.

Continue with [Unit 2: Registers, programs, and execution contexts](unit-02-programs-and-contexts.md), with a separate [Unit 2 answer key](unit-02-answers.md).

Next, study [Unit 3: Make one CPU core faster](unit-03-faster-core.md), with its [worked answers](unit-03-answers.md).

Then study [Unit 4: Add parallelism](unit-04-parallelism.md), with its [worked answers](unit-04-answers.md).

Continue into [Unit 5: Understand GPUs](unit-05-gpus.md), with its [worked answers](unit-05-answers.md).

Continue with [Unit 6: Connect the modern system](unit-06-modern-systems.md), with its [worked answers](unit-06-answers.md).

## What this course is trying to achieve

You should eventually be able to look at an unfamiliar CPU or GPU diagram, explain why its major components exist, trace how a program uses them, and make a defensible prediction about what limits performance.

The [shared discussion](https://chatgpt.com/share/6ab611eb-fc00-83eb-a398-750d27732eac) asked for an incremental progression from the simplest architectures to modern chips, with particular attention to execution context and memory. This course preserves that approach. The earlier response also suggested an ML emphasis; this first version keeps CPU and GPU coverage balanced, with optional PyTorch connections later.

Working assumption: you are comfortable with basic programming, but no electronics, assembly, or architecture knowledge is required. The first unit can also be read without running code. No GPU purchase, simulator installation, or cloud account is needed to begin.

This is a teaching sequence, not a historical timeline. Modern processors combine ideas introduced in different lessons. Some ideas are alternatives rather than successive upgrades, and adding a feature always has costs in area, energy, complexity, or predictability.

**Ready now:** the complete course outline and twenty-eight written lessons across Units 1–6, with worked exercises, separate answer keys, and interactive HTML explorations. **To develop in later units:** Lessons 29–30 covering architecture case studies and a measured capstone. Those are planned lessons, not already-written chapters.

## The recurring questions

Every lesson will answer the same questions:

1. What can our current machine do, and what limitation have we encountered?
2. What one new mechanism are we introducing?
3. What state does it add, and who owns that state?
4. How does one example execute, step by step?
5. What improves, what does not improve, and what does the mechanism cost?
6. What can we predict or measure to test our understanding?

Each full lesson should contain an explanation, a small diagram, a worked trace, a prediction exercise, a short experiment where useful, an answer key, and a mastery checkpoint. New terms are defined before they are used. Concrete machine specifications take precedence over analogies.

We follow a small family of workloads: adding two numbers, summing an array, applying the same operation to array elements, and multiplying matrices. The early examples reveal state and dependencies; the later examples reveal data reuse and parallelism. We will also use branch-heavy and pointer-chasing examples where the regular array workloads hide an important limitation.

## Unit A — Build a computer

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 1. Bits and representation | Give physical states an agreed interpretation. Binary, unsigned values, signed values, bytes, addresses. | Explain why the same bit pattern can mean different things. |
| 2. Gates and a datapath | Construct a circuit that selects and transforms values. Boolean logic, muxes, adders, an ALU. | Trace a small addition and explain why an adder cannot remember its result. |
| 3. State and time | Preserve results across time. Registers, clock edges, enables, propagation delay. | Predict which old values registers read at a clock edge. |
| 4. A stored-program accumulator machine | Let memory choose a sequence of operations. PC, instructions, decode, branches, load/store. | Trace every change to the PC, accumulator, and memory; explain a loop. |

**Milestone:** explain how a fixed circuit can execute different programs. Lessons 1–4 are written in the accompanying workbook.

Optional construction track: the official [Nand to Tetris projects](https://www.nand2tetris.org/course) provide a complementary progression through logic, arithmetic, memory, machine language, computer architecture, and an assembler. Use selected hardware projects as reinforcement; do not make finishing another full course a prerequisite.

## Unit B — Make programs and execution contexts explicit

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 5. A register machine | Keep several working values near the ALU. Register files, immediates, load/store instructions, a small RISC-V subset. | Translate a short expression and count its data-memory accesses. |
| 6. ISA versus implementation | Implement the same instruction contract with different hardware schedules. Single-cycle and multicycle datapaths, control signals. | Show the same result with different numbers and lengths of cycles. |
| 7. Calls, stacks, and execution context | Resume nested functions and interrupted work. Calling convention, stack pointer, return address, exceptions, interrupts, privilege. | State what must be preserved when switching between two execution contexts. |

**Milestone:** distinguish a program, process, software thread, saved context, and running hardware context. Explain why the stack is a convention and data structure, not a separate kind of silicon memory.

Lessons 5–7 are ready in [Unit 2: Registers, programs, and execution contexts](unit-02-programs-and-contexts.md).

Use the [RISC-V RV32I specification](https://docs.riscv.org/reference/isa/v20240411/unpriv/rv32.html) as the first real instruction contract. RV32I defines 32 integer registers, a constant-zero register, and a byte-addressed load/store model. Read only the pieces a lesson uses. For process and thread context, use the relevant chapters in [Operating Systems: Three Easy Pieces](https://pages.cs.wisc.edu/~remzi/OSTEP/).

## Unit C — Make one CPU core faster

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 8. Pipelining | Overlap different stages of successive instructions. Separate latency from throughput. | Draw a cycle timeline and calculate completion time including fill and drain. |
| 9. Hazards and forwarding | Preserve correctness when overlapped instructions share data or hardware. | Insert the necessary stalls in a dependent instruction sequence. |
| 10. Caches | Exploit reuse when fetching from DRAM is costly. Lines, tags, sets, associativity, write policies, prefetching. | Trace hits and misses for an explicit address sequence. |
| 11. Virtual memory | Give programs protected address spaces. Pages, page tables, TLBs, faults. | Distinguish a TLB miss, cache miss, and page fault. |
| 12. Branch prediction | Keep supplying instructions before a branch resolves. Prediction, speculation, recovery. | Trace a misprediction and identify which results may become architectural. |
| 13. Superscalar execution | Use more than one execution opportunity per cycle. Width, ports, dependencies. | Explain why four execution units do not guarantee four instructions per cycle. |
| 14. Renaming and out-of-order scheduling | Allow ready work to proceed around blocked work. True versus name dependencies, physical registers, issue queues. | Rename a short program and find the independent operations. |
| 15. Precise completion and memory dependencies | Make overlapping execution behave like the instruction contract. Retirement, reorder buffers, load/store queues, alias checks. | Explain a fault or a wrongly speculated load without exposing partial architectural results. |

**Milestone:** trace a load, an independent addition, and a dependent branch through an explicitly specified simplified modern core.

Lessons 8–15 are ready in [Unit 3: Make one CPU core faster](unit-03-faster-core.md). Its eight explorations cover pipelining, hazards, caches, translation, prediction, width, renaming, and retirement.

Timing models will always state their assumptions. A cache lookup and address translation can overlap in real designs; we will not treat a single serial diagram as universal. Similarly, a reorder buffer tracks ordered completion, but physical-register storage and retirement details differ between implementations.

## Unit D — Add parallelism

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 16. Multicore and coherence | Let cores share memory while caching it locally. Coherence states, ownership, false sharing. | Trace a cache-line handoff between cores. |
| 17. Ordering and synchronization | Define which cross-thread observations are legal. Memory consistency, atomics, acquire/release, barriers. | Explain why coherence alone does not synchronize an algorithm. |
| 18. Hardware multithreading and SMT | Use execution resources when one thread cannot use them all. Duplicated context and shared resources. | Explain how two hardware threads can share one physical core. |
| 19. SIMD and vectors | Apply one operation to many elements. Lanes, vector registers, masks, reductions. | Map an array loop to vector operations and handle its tail. |

**Milestone:** distinguish instruction-level, thread-level, and data-level parallelism. Identify whether a proposed change adds independent work or only more hardware.

Lessons 16–19 are ready in [Unit 4: Add parallelism](unit-04-parallelism.md), including coherence, ordering, SMT, and vector-tail explorations.

## Unit E — Understand GPUs

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 20. SIMT and the GPU programming model | Express many related logical threads. Grids, blocks/workgroups, warps/waves, SMs/CUs. | Map a one-dimensional array operation from logical threads to hardware scheduling groups. |
| 21. Scheduling, divergence, and occupancy | Keep execution resources busy while groups wait. Active masks, resident and eligible warps, resource limits. | Explain why high occupancy does not guarantee high utilization or speed. |
| 22. GPU memory traffic | Move data efficiently for groups of threads. Coalescing, transactions, caches, shared memory, banks, spills. | Predict how a stride changes transactions and useful bytes per transfer. |
| 23. Tiling and synchronization | Reuse data locally before fetching it again. Shared-memory tiles and producer/consumer coordination. | Trace one matrix tile and show why its barriers are needed. |
| 24. Performance models and measurement | Turn architectural reasoning into falsifiable predictions. Arithmetic intensity, Roofline, launch overhead, profiling. | Bound a kernel, time it correctly, and explain where the model is incomplete. |

**Milestone:** explain why a simple GPU kernel is slow and propose a change tied to a measured constraint.

Lessons 20–24 are ready in [Unit 5: Understand GPUs](unit-05-gpus.md), with eight explorations covering thread mapping, occupancy, scheduling, divergence, sectors, banks, tiling, and Roofline bounds.

Use the [CUDA programming guide](https://docs.nvidia.com/cuda/cuda-programming-guide/) to establish NVIDIA terminology, then compare with [AMD's architecture documentation](https://rocmdocs.amd.com/en/develop/reference/gpu-arch/index.html). NVIDIA vocabulary is an example, not a universal GPU specification. Wave width and scheduling details are architecture-specific. CUDA “local memory” is thread-private addressable storage, commonly backed by device memory; it is not a synonym for on-chip shared memory.

## Unit F — From processors to modern systems

**Ready to study:** [Unit 6 — Connect the modern system](unit-06-modern-systems.md) · [Worked answers](unit-06-answers.md)

| Lesson | New idea and reason for it | Evidence that you understand it |
|---|---|---|
| 25. Matrix hardware and numerical formats | Exploit structured arithmetic. Matrix tiles, accumulation, FP32/BF16/FP16/FP8 and lower precision, quantization. | Explain when a matrix instruction helps and which accuracy and layout constraints matter. |
| 26. Heterogeneous SoCs | Put different compute engines behind a memory and I/O fabric. CPU, GPU, NPU, DMA, power management. | Distinguish shared physical memory, shared virtual addressing, and coherent access. |
| 27. Packaging, HBM, and NUMA | Address bandwidth, manufacturing, and locality limits. Dies, chiplets, packages, interposers, memory controllers. | Draw where bytes travel and identify a locality boundary. |
| 28. Multiple GPUs and nodes | Split workloads larger than one accelerator. Links, topology, collectives, communication/computation overlap. | Explain why twice as many GPUs need not halve runtime. |

**Milestone:** trace an input from host memory to a kernel, across an accelerator link, and back, identifying copies, ownership, synchronization, and potential bottlenecks.

Optional extensions after these foundations: graphics pipelines and ray tracing; compiler scheduling and generated machine code; security consequences of speculation; DRAM timing; power/thermal design; FPGA or HDL construction; deep learning training and inference systems.

## Unit G — Read and assess contemporary architectures

### 29. Architecture case studies

Use a repeatable worksheet for every chip: instruction contract; execution contexts; frontend; execution resources; memory hierarchy; address translation; synchronization; packaging; power limits; and the workload the design favors. Mark undisclosed details as unknown rather than filling them from an unrelated chip.

The reading set below was checked on **25 September 2026**. It separates well-documented teaching examples from newer disclosures. The course will date-stamp specifications and refresh this unit when it is written.

| Case | Why study it | Primary reference |
|---|---|---|
| AMD Zen 5 | A modern CPU example for wide execution, prediction, and instruction-level parallelism. A teaching reference, not a claim that it is the newest CPU in every market. | [AMD Zen architecture overview](https://www.amd.com/en/technologies/zen-core.html) |
| Intel CPU and hybrid designs | Compare implementation choices and software implications while keeping the ISA/implementation distinction clear. | [Intel optimization documentation](https://www.intel.com/content/www/us/en/developer/articles/technical/intel64-and-ia32-architectures-optimization.html) |
| Arm Neoverse V3 | Compare a different instruction-set family and its server compute subsystem with the x86 examples. | [Arm's V3 platform learning path](https://learn.arm.com/learning-paths/servers-and-cloud-computing/neoverse-rdv3-swstack/1_introduction_rdv3/) |
| Apple M5 Pro / M5 Max | Examine a heterogeneous SoC joining two dies, CPU and GPU resources, and a unified memory controller. | [Apple's March 2026 architecture announcement](https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/) |
| AMD CDNA 4 | A documented compute-GPU and chiplet baseline; compare its terminology with NVIDIA. | [AMD GPU architecture reference index](https://rocmdocs.amd.com/en/develop/reference/gpu-arch/index.html) |
| NVIDIA Rubin | A frontier disclosure connecting matrix compute, HBM4, and scale-up communication. Vendor performance claims require their workload and precision qualifiers. | [Rubin architecture, 21 July 2026](https://developer.nvidia.com/blog/inside-nvidia-rubin-gpu-architecture-powering-the-era-of-agentic-ai/) |
| AMD CDNA 5 | A frontier comparison involving chiplets, HBM4, and a changed workgroup-processor organization. | [AMD CDNA architecture overview](https://www.amd.com/en/technologies/cdna.html) |
| Google TPU7x / Ironwood | Contrast GPU organization with an ML accelerator and examine how chiplet boundaries appear in the programming model. | [Google's TPU7x architecture documentation](https://docs.cloud.google.com/tpu/docs/tpu7x) |

Availability is a separate question from architectural disclosure. For example, NVIDIA's [CUDA 13.4 announcement of 9 September 2026](https://developer.nvidia.com/blog/?p=121255) describes Rubin support as a preview ahead of general availability. Do not infer widespread shipping hardware from the existence of an architecture article or peak specification.

### 30. Capstone: explain performance from first principles

Choose one CPU workload and one GPU workload. For each:

1. Specify the operation, input sizes, numerical format, hardware, and software versions.
2. Identify dependencies, parallel work, and bytes moved at a named memory boundary.
3. Predict likely limits and a plausible performance bound.
4. Measure with warm-up, repeated runs, and correct synchronization.
5. Change one thing with an architectural justification.
6. Explain whether the result supports the prediction, and what remains uncertain.

Possible CPU cases: array traversal versus pointer chasing; false sharing; dependent versus independent arithmetic. Possible GPU cases: vector addition, reduction, or tiled matrix multiplication. An optional PyTorch case traces a tensor operation into kernels and separates launch overhead, transfers, and device work. A library call is not guaranteed to correspond to one kernel.

For the GPU performance model, use the [Nsight Compute profiling guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/): its Roofline discussion combines arithmetic intensity with compute and memory ceilings. A ceiling is a bound, not a promised achieved rate.

## How to study this course

Treat the lesson numbers as a dependency order, not a deadline. For a typical lesson, reserve a reading session and a separate prediction/experiment session. Out-of-order execution, memory ordering, and GPU tiling deserve more than one pass. Set the pace after finishing Unit A; the checkpoint results will be more informative than a calendar estimate.

For each lesson, keep a short notebook entry:

> The old limitation was ___. We added ___. The new state is ___. On the worked example, ___ changes. The cost is ___. The idea fails to help when ___. I can test that by ___.

Move on when you can explain the mechanism without its original diagram and solve a changed example. If you can repeat the names but cannot trace the behavior, use another small trace before adding complexity.

## Guardrails for all future material

- Distinguish the instruction contract from one particular implementation.
- Label teaching machines, synthetic timings, and idealized bounds explicitly.
- Separate latency, throughput, bandwidth, capacity, and energy.
- Identify whose state is private, what is shared, and when results become visible.
- Introduce power, bandwidth, and physical cost alongside performance benefits.
- Use dated primary sources for vendor-specific claims. Keep reported peaks, measured results, and predictions separate.
- Reuse examples, but change workloads when an example conceals the mechanism being taught.
- Keep answer keys separate from prediction exercises.
