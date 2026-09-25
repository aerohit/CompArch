# Unit 4 — Worked answers

Lessons 16–19 · Version 1 · 25 September 2026

Use with [Unit 4: Add parallelism](unit-04-parallelism.md). Make predictions first; this answer key continues at question 63.

## Lesson 16

**63.** A has **M**, B has **I**, and the lower-level copy still has **x = 0**. The current x = 1 resides in A's modified line. Invalidating B's copy prevents it from legally using its old cached value. A write-back cache does not have to update the lower-level data on every store.

**64.** B receives **1** from the current modified copy. In this specified MSI model, A supplies the line and updates the lower-level copy, then both A and B end in **S**. The lower-level x also becomes 1. A different protocol could use additional ownership states; use the stated rules for this trace.

**65.** Same line: **4 write-permission requests and 3 invalidations**. Separate lines: **2 requests and 0 invalidations**. Each writer's second store then hits in its own M line. We count abstract requests, not all network messages. The writes target different words in both scenarios; changing line placement removes the false-sharing conflict.

**66.** Speedup = 1 / (0.2 + 0.8 / 4) = 1 / 0.4 = **2.5**. The limit as the number of ideal cores grows is 1 / 0.2 = **5**. This assumes a fixed workload, perfect scaling of its parallel portion, and no extra communication or scheduling overhead.

**67.** Coherence organizes writes and cached copies for a location. A publication protocol also needs an ordering relationship across the payload and flag, plus the language-level rules for their accesses. Correct handling of x's line alone does not establish that seeing a flag authorizes reading the intended version of x.

## Lesson 17

**68.** Each store is still in its issuing core's buffer when the other core loads that location. Each load accesses the other location and sees the initial 0 in shared memory. Both stores drain later. No incoherent cached copies are required; the missing constraint is store-to-later-load ordering across distinct addresses in this model.

**69.** Name the events Ax (A stores x), Ay (A loads y), By (B stores y), and Bx (B loads x). Program order requires Ax < Ay and By < Bx. Reading zero requires Ay < By and Bx < Ax because each location has only its initial zero and one later store of 1. Combined: **Ax < Ay < By < Bx < Ax**, impossible in a total order.

**70.** The acquire load must read the true value published by the producer's release store. That synchronizes the threads so the earlier payload write happens before the later payload read. An acquire load returning the initial false value has not observed that publication and does not establish the same relationship. The one-shot assumptions also exclude later concurrent modifications of the payload.

**71.** Two separate atomic operations do not make their whole sequence indivisible. Both threads can load 0 and later store 1. Atomic fetch_add instead performs one indivisible read-modify-write in the counter's modification order: one increment observes 0, the next observes 1, and the final value is **2** under the stated assumptions. It still does not protect an arbitrary multi-operation invariant or publish unrelated data when used with relaxed ordering.

**72.** Atomic read-modify-write protects one update to an atomic object. A mutex protects an agreed critical section that may contain many operations. A memory fence orders specified memory operations but does not wait for all threads to arrive. A thread barrier coordinates participants at a phase boundary and supplies its defined visibility guarantees. **C++ volatile does not replace these synchronization relationships** for the publication example.

## Lesson 18

**73.** Selecting only one thread each cycle takes **8 cycles**; SMT using both ports takes **4 cycles**. A ends with **x5 = 4** and B with **x5 = 140**. The register name is the same, but the contexts and values are separate.

**74.** Eight additions require eight issue opportunities. With one available opportunity per cycle, neither policy can issue all eight in fewer than **8 cycles**. The bottleneck is the shared ALU issue capacity. Keeping a second context resident does not duplicate that capacity.

**75.** There are **8 logical processors**, assuming all four cores support and expose two contexts. Each pair shares a core's execution machinery and some other resources. Eight independently schedulable contexts therefore do not imply eight cores' worth of arithmetic or memory bandwidth.

**76.** PCs, architectural register values, and relevant control/exception state must remain distinct. Execution units, physical storage, queues, predictors, cache capacity, and bandwidth may be shared or partitioned. Hardware selection among resident contexts need not save and reload the entire architectural context in memory each time. An OS context switch replaces the software thread assigned to a hardware context and preserves enough state for later resumption.

**77.** Yes. The added thread can fill some formerly idle issue slots, increasing combined work per second, while also competing for cache space or memory bandwidth that the original thread previously used alone. Per-thread completion time and aggregate throughput measure different outcomes. This is a possibility, not a guarantee for every pair of workloads.

## Lesson 19

**78.** **3 groups** are required. The final group names indices 8, 9, 10, and 11, with mask **[1, 1, 0, 0]** in that lane order. Only c[8] = **117** and c[9] = **119** are written. The masked memory contract prevents accessing nonexistent a/b elements at indices 10 and 11.

**79.** Width four: 10 / (3 × 4) = **83.3%**. Width eight: 10 / (2 × 8) = **62.5%**. The wider case needs fewer groups; which runs faster also depends on vector throughput, instruction latency, memory supply, and masking costs. Slot utilization alone is insufficient.

**80.** Each result needs 4 + 4 input bytes and 4 output bytes: **12 × 10 = 120 useful bytes**. Actual traffic at a cache or DRAM boundary can include line fills, ownership/write allocation, writebacks, and bytes not used by the loop. Cache reuse may also keep some useful accesses from crossing that boundary at all.

**81.** VLMAX = LMUL × VLEN / SEW = 1 × 128 / 32 = **4 elements**. This is an architectural capacity for the selected configuration. Hardware can process those elements over multiple beats or with different execution resources, so it does not specify physical lane count or latency.

**82.** A reduction combines values across elements into one result, requiring communication or an accumulation structure. Independent elementwise addition produces a separate output per element. Cross-iteration dependencies, potentially overlapping arrays, unsafe memory accesses, or floating-point reassociation constraints can prevent a naive vector transformation.

## Integrated case — Parallel array work still needs coordination

Each length-10 partition takes ceil(10 / 4) = **3 vector groups**, so two partitions take **6 groups total**. If equal cores run them in parallel, each still has three groups to process; six groups of total work does not mean six elapsed cycles. The visual does not specify group timing.

Each partition transfers 120 useful array bytes, giving **240 useful bytes** across the logical array boundary. This excludes completion counters, metadata, cache-line effects, and extra traffic across lower memory levels.

The counters can false-share because write permission applies to the line containing both. Put per-thread counters on suitably separated lines or reduce the frequency of shared updates, while considering the footprint cost. Padding alone does not establish synchronization.

The coordinator can join both threads using the language/library's join guarantee before reading their outputs. A release/acquire protocol is another option when correctly specified for each producer, its flag, and the lifetime/reuse of the output. Seeing a coherent flag in a hardware sketch is not itself a language-level proof that non-atomic output reads are safe.

Moving both threads onto SMT siblings preserves their distinct register contexts but shares one core's vector execution resources and other capacity. Their combined runtime may change substantially. Measure against the actual resource limits and keep aggregate throughput separate from individual thread latency.

## Transfer exercises

**A. Does a coherent cache always contain the globally newest value?** An invalid line may contain stale physical bits that cannot be used as a valid copy. A valid read participates in the protocol and memory model; not every storage location must be rewritten immediately after every store.

**B. Does an atomic counter make the whole algorithm thread-safe?** It makes the specified atomic accesses obey their guarantees. It does not automatically protect other fields, establish every required happens-before relationship, or make a multi-step invariant indivisible.

**C. Does a 256-bit vector instruction imply eight hardware threads?** No. With 32-bit elements it names eight element positions, under one instruction stream. They are neither eight software threads nor eight independent architectural PCs. Physical execution may use a different lane count.

**D. Can multicore, SMT, and SIMD coexist?** Yes. A system may have several cores, multiple hardware contexts on each, and vector instructions within each context. Their resource limits and shared state still need to be analyzed separately.

## Readiness check

Trace an MSI handoff without assuming DRAM always has the latest bytes. Prove why the store-buffer example differs from SC. Explain the publication relationship in the C++ example. Account for the contexts and ports in the SMT example. Finally, process an array tail without an invalid memory access.

The [learning path](learning-path.md) continues with Unit E: GPUs, SIMT, scheduling groups, memory traffic, tiling, and performance models.
