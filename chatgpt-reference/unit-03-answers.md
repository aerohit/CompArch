# Unit 3 — Worked answers

Lessons 8–15 · Version 1 · 25 September 2026

Use with [Unit 3: Make one CPU core faster](unit-03-faster-core.md). Questions continue from Unit 2 at number 31. Try each prediction before opening its solution.

## Lesson 8

**31.** I1 is in M, I2 in E, I3 in D, and I4 in F. None has completed W yet. Four instructions are in flight; that is different from four completed instructions.

**32.** The pipelined machine takes 100 + 5 − 1 = 104 cycles, or 104 × 1.1 = **114.4 ns**. The unpipelined machine takes 100 × 5 = **500 ns**. Speedup is 500 / 114.4 ≈ **4.37**. It is below five because the pipeline has boundary overhead and a finite fill/drain cost.

**33.** The clock period must be at least 2 + 0.1 = **2.1 ns** under the model. Simply inserting registers elsewhere does not shorten E's logic path. Splitting E into additional stages might help, but changes the stage count, overhead, dependency timing, and potentially branch recovery costs. The new design needs a new timing calculation.

**34.** No. They can be successive instructions from one software thread. The new state consists of intermediate values, instruction identity, destination/control information, and valid bits for multiple in-flight instructions. The pipeline does not imply four independent architectural register sets or four independently resumable software threads.

## Lesson 9

**35.** I1's data appears at the **end** of cycle 4, whereas I2 would need it at the **beginning** of that cycle. A forwarding wire cannot send a value backward in time. Stall I2 for one cycle; it enters E in **cycle 5** and uses the value retained after I1's M stage.

**36.** With forwarding: **8 cycles**. I1 occupies F1/D2/E3/M4/W5. I2 has F2/D3, remains in D during cycle 4, then E5/M6/W7. I3's fetch is held during cycle 4; it reaches D5/E6/M7/W8.

Without forwarding: **11 cycles**. I2 reads x5 when I1 writes it in W5, then uses E6/M7/W8. I3 reads x6 in D8 and uses E9/M10/W11. There are four additional stalled cycles relative to the ideal seven-cycle sequence. These counts require the stated same-cycle W-to-D register-file timing.

**37.** **Zero data-hazard stalls** under these assumptions. The first add's result at the end of E3 feeds I2's E4, and I2's result feeds I3's E5. The three instructions finish in seven cycles. Their true dependencies still exist; forwarding satisfies them without waiting for register writeback.

**38.** It is a **structural hazard**: two operations require one memory port at the same time. ALU forwarding routes a produced value to a consumer; it does not supply another memory-access opportunity. Separate instruction/data paths, more ports, or a stall can address this resource conflict.

## Lesson 10

**39.** 0x44 is decimal 68. Block number = floor(68 / 16) = **4**; offset = **4**; set index = 4 mod 4 = **0**; tag = floor(4 / 4) = **1**. The line covers 0x40–0x4F. Matching the index alone is insufficient: the entry must be valid and its tag must match.

**40.** Direct-mapped: **3 hits, 5 misses**. Two-way: **5 hits, 3 misses**. Both hold four 16-byte lines. In the direct-mapped cache, blocks 0 and 4 repeatedly evict each other from set 0. With two ways they can coexist in that set. The improvement comes from placement flexibility, not additional data capacity.

The two-way trace is M, H, M, H, H, M, H, H. Its three misses are the first accesses to blocks 0, 4, and 1.

**41.** AMAT = 2 + 0.05 × 40 = **4 ns**. The 40 ns is an additional miss penalty, so adding the hit lookup once is appropriate. This is average time per modeled memory access, not per instruction. A program has its own instruction mix, data-access frequency, dependency chains, and overlap.

**42.** Fetching unused bytes or unneeded prefetched lines consumes bandwidth and can displace useful data. If memory traffic is already the limiting resource, more traffic can lengthen execution despite fewer demand misses. A write-back cache needs to track whether a valid line is **dirty**, meaning its cached contents have been modified and must be preserved before the line is discarded when writeback is required.

## Lesson 11

**43.** VPN = **0x12**, offset = **0xE8**, physical frame = **0xA0**, so the physical address is **0xA0E8**. The low eight offset bits are unchanged. A mapping changes the page frame, not the byte's position within that page.

**44.** Yes. For 0x1244 the TLB initially lacks VPN 0x12. A page-table walk finds the valid readable mapping to frame 0xA0 and installs it in the TLB. The physical address is 0xA044. Its line, 0xA040, is already in the data cache, so the data access hits. Translation-cache residency and data-cache residency are different facts.

**45.** No. A TLB hit supplies both translation and permission information. A write through a read-only mapping is rejected; in this teaching model it raises a permission fault before the target write occurs. Fetching a cache line cannot grant the missing write permission.

**46.** No. The OS might allocate a fresh zero-filled page for a permitted demand allocation, or reject an invalid access. A file-backed or swapped page could require storage I/O, but that is another possibility, not the definition of a page fault.

The same virtual page number in different address spaces can map to different physical frames and permissions. A context switch must select the correct page-table context and avoid using stale or incorrectly attributed TLB entries. Threads sharing one process address space can share its mappings while preserving different register contexts.

## Lesson 12

**47.** Starting from 1:

| Encounter | Counter before | Prediction | Actual | Counter after |
|---|---:|---|---|---:|
| 1 | 1 | N | T | 2 |
| 2 | 2 | T | T | 3 |
| 3 | 3 | T | T | 3 |
| 4 | 3 | T | N | 2 |

There are **two wrong predictions**, and the final counter is **2**. A single not-taken exit weakens the taken prediction without immediately reversing it.

**48.** The fall-through instruction fetched in cycle 2 is now in D; the one fetched in cycle 3 is in F. Both are invalidated at the end of cycle 3. Target fetching restarts in **cycle 4**. This specific five-stage model loses two fetch opportunities. A different resolution stage or frontend can produce a different penalty.

**49.** Estimated CPI = 1 + 0.25 × 0.08 × 5 = **1.10**. This is a long-stream estimate with a fixed additional penalty and no overlap between penalties or other delays. Real branch types, variable resolution times, frontend behavior, and interactions with other stalls can change it.

**50.** A squashed load may already have affected microarchitectural state, including cache contents. Its speculative destination must not become an accepted architectural result from that wrong path. Preserving a legal architectural history does not imply erasing all timing-visible side effects.

## Lesson 13

**51.** Independent instructions: **2 cycles**, A/B then C/D. Two chains: **2 cycles**, also A/B then C/D, because results from cycle 1 are usable in cycle 2. One chain: **4 cycles**, one operation each cycle. These are issue/execution windows, not total program runtimes.

**52.** B needs the value A produces at the end of its cycle; B needs its input at the start of a cycle. The model has no same-cycle dependent execution. Additional ALUs do not create the missing value earlier. They help only when more compatible work is ready.

**53.** At least **4 cycles to start all four loads**: one start in each cycle. The last load may finish later, depending on latency. Integer ALUs do not replace the required load-start resource merely because they are idle.

**54.** IPC = 240 / 160 = **1.5**; CPI = 160 / 240 = **2/3**, approximately **0.667**. Both use the same retired-instruction count and measured cycles. The explorer begins with instructions already queued and excludes frontend and retirement time, so its execution-window rate does not measure that whole interval.

## Lesson 14

**55.** I2 reads **p32**, the value produced by I1. I4 reads **p34**, the value produced by I3. The newest speculative mapping is **x5 → p34**. I2's recorded source identity does not change when the map later changes.

**56.** RAW dependencies **I1 → I2** and **I3 → I4** remain. Renaming removes the WAW name conflict between I1 and I3, both of which write architectural x5, and the WAR name conflict between I2's read of x5 and I3's later write. Different physical destinations let both versions exist without confusing their consumers.

**57.** I1 issues in **cycle 1**, I3 in **2**, I4 in **3**, and I2 in **5**. I1 returns at the end of cycle 4; I2 consumes its value in the following cycle. All results are ready by the end of **cycle 5**. In-order issue instead uses cycles 1, 5, 6, and 7 for I1–I4, completing at the end of **cycle 7**. This is not a calculation of retirement time.

**58.** No. An older in-flight consumer may still need the old version, and recovery may need an earlier mapping. A speculative map update alone is not proof that the physical storage is safe to reuse. Explicit-renaming designs coordinate reclamation with retirement and recovery bookkeeping; in the common scheme discussed here, a retired writer can release its superseded physical destination when the scheme guarantees it is no longer needed.

## Lesson 15

**59.** I3 and I4 have completed, producing **p34 = 21** and **p35 = 23**. **Zero instructions have retired.** I1 is still the unfinished oldest entry. Completion order can differ from program order, while retirement must wait for the head.

**60.** At the start of cycle 5, the exception is handled at the ROB head. I1's result is not committed, and younger unretired work is squashed; the committed register view remains the state before I1. **x5 = 21 and x7 = 23 may not appear as committed effects** of I3 and I4. The handler has its own state changes, which the visual intentionally does not execute.

**61.** The load's stale result and the dependent addition must be invalidated and corrected before retirement. Replaying with the older store's value yields **9** for the load and **10** for the addition. Register renaming distinguishes versions of register names; it does not by itself establish whether two computed memory addresses overlap. Memory-order tracking and checks are required.

**62.** I1 retires at the start of **cycle 5**, I2 at **6**, I3 at **7**, and I4 at **8**. I3 and I4 wait even though they completed earlier. A store's retirement authorizes it within the core's architectural sequence; it can still remain buffered before other cores observe it. Cross-core visibility and ordering require the memory system's rules, covered next.

## Integrated case — A load, useful work, and a wrong path

Keep the final exercise's timing rules: retirement happens at cycle start, execution completion at cycle end, and all four instructions are already in the window.

| Cycle | Issue / execution | Retirement / recovery |
|---|---|---|
| 1 | I1 starts its four-cycle load | None |
| 2 | I2 executes, speculative x6 = 9 | None; I1 blocks the head |
| 3 | I3 is waiting; I4 executes, speculative x7 = 99 | None |
| 4 | No eligible new operation; I1 returns 7 at cycle end | None |
| 5 | I3 uses the ready x5 operands and resolves taken at cycle end | I1 retires at cycle start; I4 is squashed at cycle end |
| 6 | Target fetch restarts; target instructions are outside the exercise | I2 retires |
| 7 | Outside the modeled execution window | I3 retires |

After I3 retires, committed **x5 = 7, x6 = 9, x7 = 0**. The speculative 99 never becomes committed x7. No target instructions have been included, so do not invent their effects.

The cache miss does not occupy the integer ALU continuously: I2 and I4 can execute while the load is outstanding. I2 is useful independent work; I4 is ultimately wasted speculative work. The miss still delays the dependent branch, holds up retirement, and occupies finite queue/storage resources. Overlapping some of its cost does not eliminate its consequences.

## Transfer exercises

**A. You double cache capacity but runtime barely changes. What might explain it?** The working set may already fit, conflict behavior may remain, the workload may stream without reuse, or dependencies/compute/frontend supply may dominate. Establish which memory boundary is limiting before predicting a capacity benefit.

**B. Is an instruction marked “complete” automatically safe to expose?** No. It can be younger than an unresolved branch, exception, or memory-order check. Readiness for retirement includes older instructions and unresolved speculation, not only whether the ALU has produced bits.

**C. Could a one-wide out-of-order core beat a two-wide in-order core?** Yes, on a workload where the in-order core repeatedly stops behind blocked work and the out-of-order core can use independent younger operations. Width alone is not a complete performance description. A quantitative comparison requires the same workload and fully specified timings.

**D. Does a TLB miss guarantee a DRAM request?** No. A hardware page-table walk can obtain its page-table entries from cache. A successful translation also says nothing by itself about whether the target data line is in cache. Count page-table traffic and target-data traffic separately.

## Readiness check

Explain the pipeline's 8.8 ns result, the load-use bubble, the direct-mapped conflicts, the difference between translation and data misses, the counter's response to a loop exit, the single-chain width limit, the two physical versions of x5, and the ROB's handling of a fault. Then solve the integrated case without looking at its table.

Return to the [learning path](learning-path.md) for Unit D: multiple cores, coherence, synchronization, hardware multithreading, and SIMD/vector execution.

Continue with [Unit 4: Add parallelism](unit-04-parallelism.md).
