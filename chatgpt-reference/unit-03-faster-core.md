# Unit 3 — Make one CPU core faster

Lessons 8–15 · Version 1 · 25 September 2026

Continue from [Unit 2](unit-02-programs-and-contexts.md). This is Unit C in the [learning path](learning-path.md). Keep the [worked answers](unit-03-answers.md) separate while making predictions.

**Outcome:** trace overlapping instructions through a small CPU, explain what makes them wait, and distinguish a finished calculation from a result that may safely become architectural state.

This unit has eight lessons. Study them in three passes: overlap and hazards (8–9), memory and prediction (10–12), then width, scheduling, and precise completion (13–15). Each pass deserves its own practice session. The final case connects them.

### What carries over, and what changes

We retain Unit 2's byte addresses, 32-bit integer registers, four-byte base instructions, and x0 = 0. Our small values do not overflow. An instruction is still a contract; none of the new hardware changes what a correct program should compute.

Each visual specifies its own model. The five-stage core in Lessons 8–9 is not the out-of-order core in Lessons 14–15. Cache sizes, timings, and queue widths below are invented teaching parameters, not specifications for a commercial CPU. Some visuals advance a clock cycle; others advance an access or explanatory event. Their controls say which.

A recurring distinction matters: **architectural state** is the program-visible state required by the instruction contract. **Microarchitectural state** helps implement that contract: pipeline registers, cached copies, prediction tables, physical-register mappings, and queues. It can affect timing without being an extra software variable.

## Lesson 8 — Overlap instructions with a pipeline

### The limitation: idle hardware between uses

In a machine that finishes one instruction before starting another, the instruction-fetch hardware waits while the ALU works. Then the ALU waits while a load reads data. Even if each operation is individually fast, much of the hardware is idle.

Pipelining lets different instructions use different portions of the datapath during the same cycle. We partition a teaching core into five stages:

| Stage | Work in this model | Information that must move forward |
|---|---|---|
| F — Fetch | Read instruction bytes at the PC | Instruction, its PC, and continuation |
| D — Decode | Identify operation and read registers | Operand values, destination, control |
| E — Execute | Calculate arithmetic result or address | Result/address and control |
| M — Memory | Access data memory for a load/store | Loaded data or carried ALU result |
| W — Writeback | Write a register when required | Destination and value |

An add passes through M without reading data memory. A store does not write a register in W. A stage name describes a hardware position, not work every instruction must perform there.

**Pipeline registers** separate stages. At a clock edge they retain an instruction's intermediate values and control bits for the next stage. A valid bit can distinguish an occupied slot from a bubble. The machine now holds several partially executed instructions, each with its own identity. There is no single “current instruction” for the whole core.

### A fully specified timing comparison

Assume each of the five logic portions takes 1 ns. An unpipelined implementation takes 5 ns per instruction. The pipelined implementation adds 0.1 ns of boundary overhead per stage, so its clock period is 1.1 ns. Instruction and data access paths are separate, each stage can accept a new instruction every cycle, and the instructions in this example are independent. There are no misses, branches, or stalls.

For four instructions:

```text
Cycle       1  2  3  4  5  6  7  8
I1          F  D  E  M  W
I2             F  D  E  M  W
I3                F  D  E  M  W
I4                   F  D  E  M  W
```

The first result completes at the end of cycle 5. The next three complete one per cycle. Four instructions take 8 × 1.1 = **8.8 ns**, versus 4 × 5 = **20 ns** without overlap. Speedup is 20 / 8.8 ≈ **2.27**, not five.

<!-- VISUAL pipeline -->

### Latency, throughput, and the empty ends

**Latency** is time from an instruction's start to its completion: 5.5 ns here. **Throughput** is completed work per time: after filling, one instruction per 1.1 ns. The first instruction actually takes longer than on the 5 ns unpipelined machine. The benefit comes from overlap.

For N instructions in this ideal K-stage pipeline, total cycles are **N + K − 1**. That expression already includes filling and draining an initially empty pipeline; do not add another K − 1 cycles for draining. Average CPI over four instructions is 8 / 4 = 2, approaching 1 only for long streams. A short program never reaches the asymptotic speedup.

A slower stage sets the clock limit. If E takes 2 ns while other logic stays at 1 ns, the new clock must accommodate 2 + 0.1 = 2.1 ns. More stages also add storage, clock power, wiring, and recovery cost. Cutting a datapath into more pieces cannot make dependencies or physical delays disappear. Cornell's [CPU architecture notes](https://courses.cs.cornell.edu/cs3410/2026sp/notes/arch.html) offer a second introduction to overlap and its ideal cycle count.

### Predict before continuing

31. In cycle 4 of the four-instruction trace, which stages hold I1, I2, I3, and I4? How many instructions have completed?
32. Under the stated timing assumptions, how long do 100 independent instructions take with and without pipelining? What is the speedup?
33. If E's logic delay grows to 2 ns and boundary overhead remains 0.1 ns, what is the minimum pipeline clock period? Does adding pipeline registers automatically restore 1.1 ns?
34. Are the four overlapping instructions necessarily four software threads? Explain what additional state the pipeline actually holds.

**Checkpoint:** draw a new five-instruction timeline, including the empty beginning and end. Explain why improved throughput need not improve the latency of one instruction.

## Lesson 9 — Preserve dependencies with stalls and forwarding

### The limitation: overlap can read the wrong value

A **dependency** is a relationship in the program. A **hazard** arises when a hardware schedule would violate that relationship or demand an unavailable resource. Three useful categories are data hazards, structural hazards, and control hazards. They concern needed values, shared hardware, and the next instruction address respectively.

Our example has two true, read-after-write dependencies:

```text
I1: lw  x5, 0(x8)      ; memory at x8 contains 7
I2: add x6, x5, x9     ; x9 = 5, so x6 must become 12
I3: add x7, x6, x10    ; x10 = 3, so x7 must become 15
```

I2 needs I1's loaded value. I3 needs I2's sum. Reading old x5 or x6 is incorrect even if the machine is wonderfully fast.

### State the availability times

Use the five-stage core from Lesson 8 with these additional rules. An ALU result is ready **at the end of E**; load data is ready **at the end of M**. E consumes its inputs at the beginning of its cycle. W writes early enough for D in that same cycle to read the new value. Fetch and data memory have separate paths. All memory accesses hit and take their allotted stage.

Without forwarding, a consumer remains in D until its producer reaches W. Hardware holds the PC and fetch/decode state, inserts an invalid slot into E, and lets older instructions advance. Holding an instruction is not executing it repeatedly.

With **forwarding**, multiplexers can choose a recent result from pipeline storage instead of the stale value previously read from the register file. We provide paths from E/M and M/W pipeline registers to E's operands. The newest matching older producer wins; x0 is never a produced destination.

### Why a load still causes a bubble

For adjacent adds, a result produced at the end of cycle 3 can feed the next instruction's E at the beginning of cycle 4. No stall is needed. An adjacent load is different: its data arrives at the end of M in cycle 4, too late for a consumer's E at the beginning of cycle 4.

Delay I2's E to cycle 5. Then forward the loaded 7. I2 produces 12 at the end of cycle 5, which feeds I3's E in cycle 6. The complete sequence finishes W in cycle 8: the ideal seven cycles plus one load-use stall. Without forwarding it finishes in cycle 11, after two D stalls for each dependency.

<!-- VISUAL hazards -->

Forwarding changes **where an available value is obtained**. It cannot supply a value before computation or memory access produces it. The exact stall count depends on the stage boundaries and paths; Berkeley's [data-hazard notes](https://notes.cs61c.org/content/pipeline-hazards/data-hazards/) explain this dependence on register-file timing and bypass paths.

### Other hazards, and the price of resolving them

If F and M shared one single-access memory port, a load in M could prevent a fetch in the same cycle. That is a structural hazard. An extra port or separate cache paths can reduce it, at a hardware cost. Forwarding cannot make one port serve two simultaneous requests.

A branch creates uncertainty about the next PC; Lesson 12 addresses it. Compilers can sometimes place independent work between a producer and consumer, but moving instructions must preserve memory behavior, exceptions, and control flow. A register renaming trick alone cannot remove the need for loaded data.

Forwarding requires comparisons, multiplexers, wires, and timing margin. Stalls preserve correctness but waste opportunities. This is the first recurring performance question: **is the machine waiting for a value, a resource, or a decision?**

### Predict before continuing

35. Why is the loaded value unavailable for I2's E in cycle 4, even with forwarding? Which cycle can I2 enter E?
36. How many total cycles does the three-instruction trace need with forwarding and without it? Count from the first F through the final W.
37. Replace I1 with an add that produces x5 at the end of E. With the stated forwarding paths, how many data-hazard stalls remain in the three-instruction chain?
38. A load occupies the only memory port while a younger instruction wants to fetch. Which hazard is this, and why does an ALU forwarding path not solve it?

**Checkpoint:** mark when a producer creates a value and when its consumer needs it before deciding whether to insert a stall.

## Lesson 10 — Keep reused data in caches

### The limitation: a fast core waits for distant bytes

The one-stage memory access assumption was convenient. Real systems have a memory hierarchy. Registers hold operands very close to execution. Small caches can serve nearby copies of memory data. Larger caches and DRAM provide more capacity with different latency, bandwidth, energy, and sharing costs. L1, L2, and L3 name levels, not universal sizes or inclusion policies.

A **cache line** is the aligned block transferred and tracked together. **Temporal locality** means reusing the same data soon. **Spatial locality** means using nearby addresses. A loop over neighboring array elements often has both; a large one-pass stream may have useful spatial locality without reusing a line after leaving it.

### Build a tiny cache we can trace exactly

Use eight-bit physical byte addresses, 16-byte lines, and **64 bytes of data capacity**. Metadata is extra. The direct-mapped version has four sets and one line per set. Start empty. Every access reads one byte; a miss fetches the whole line, evicting the old line in that set. There are no writes, prefetches, other cores, or timing overlap in this visual.

```text
block number = floor(address / 16)
byte offset  = address mod 16
set index    = block number mod number_of_sets
tag          = floor(block number / number_of_sets)
```

A valid bit says whether the entry holds a meaningful line. A tag distinguishes memory blocks that compete for the same set. In the direct-mapped cache, the address breaks into two tag bits, two index bits, and four offset bits.

Read **0x00, 0x04, 0x40, 0x00, 0x44, 0x10, 0x14, 0x40**. The first two access the same line. But blocks at 0x00 and 0x40 both map to set 0, repeatedly replacing one another. The hit/miss sequence is **M, H, M, M, M, M, H, H**: three hits, five misses.

<!-- VISUAL cache -->

### Associativity gives a block more possible homes

Keep the same 64-byte capacity but use **two sets with two ways each**. A way is one candidate line location within a set. Both tags are checked for a match. If a miss finds a full set, evict its least recently used line; our model uses exact LRU. Now 0x00 and 0x40 can coexist. The same trace has five hits and three misses.

The field split changes to three tag bits, one index bit, and four offset bits. Capacity did not grow. Placement flexibility changed. A fully associative cache has one set containing all its lines, at greater lookup/replacement cost. Real caches may approximate LRU.

A first access to a previously unseen block is a compulsory miss. A conflict miss depends on restrictive placement; a capacity miss persists when the actively reused working set exceeds what a same-capacity fully associative cache can retain. Our conflicting blocks fit in capacity, but collide in the direct-mapped layout.

### Writes, prefetches, and performance

A write-through policy sends writes toward the next level as well as updating the cache. A write-back policy marks a modified line dirty and writes it back when required, such as on eviction. On a store miss, write-allocate fetches/allocates the line; no-write-allocate sends the write onward without allocating it. These are separate policy choices. Buffers often decouple a store from the next level's response.

Prefetching brings a predicted line in before demand. A useful prefetch can hide waiting; an inaccurate or poorly timed one can waste bandwidth and evict useful data. Larger lines can exploit spatial locality while also transferring unwanted bytes. More capacity and associativity can increase access time, energy, and area.

For a **serial, blocking, one-level** model, average memory access time is hit time + miss rate × **additional** miss penalty. With a 2 ns lookup, 10% misses, and an additional 40 ns per miss, AMAT = 2 + 0.1 × 40 = **6 ns**. It is not the runtime per CPU instruction. Real cores can overlap misses and computation, and some instructions make no data accesses. Cornell's [cache notes](https://www.cs.cornell.edu/courses/cs3410/2026sp/notes/caches.html) provide a reference for tags, placement, and policies.

### Predict before continuing

39. In the four-set direct-mapped cache, what are the block number, set index, tag, and offset for address 0x44?
40. For the supplied eight-access trace, how many hits occur with one way versus two ways at the same 64-byte capacity? Why does the two-way layout help?
41. A 2 ns cache has a 5% miss rate and a 40 ns additional miss penalty. What is its AMAT under the serial model? Is that automatically the CPU's average instruction time?
42. Why might a large line or aggressive prefetcher slow a bandwidth-limited workload? Which new state must a write-back cache track?

**Checkpoint:** determine the set and compare valid tags before calling an access a hit. Explain the distinction between data capacity and placement flexibility.

## Lesson 11 — Translate and protect addresses

### The limitation: an address needs an owner and permissions

So far an address directly named our teaching machine's memory. With multiple processes, each needs a controlled view: the same numeric pointer in two processes need not identify the same physical bytes. A bad pointer should not grant access to another process's private data.

**Virtual memory** maps virtual addresses used by a program to physical addresses. Fixed-size virtual pages map to physical page frames. A page table, managed by privileged software, records mappings and permissions. Translation hardware checks that an access is allowed. Virtual memory is useful even when nothing is swapped to storage.

### Separate a page number from an offset

Our teaching system uses 16-bit virtual addresses and **256-byte pages**. These tiny pages are chosen for easy arithmetic, not as a typical CPU configuration. The top eight bits are the virtual page number (VPN); the bottom eight are an unchanged byte offset. A page table maps VPN 0x12 to physical frame 0xA0, with read/write permission.

```text
virtual address 0x1234 = VPN 0x12 + offset 0x34
physical address      = frame 0xA0 × 256 + 0x34 = 0xA034
```

A **translation lookaside buffer (TLB)** caches translations and relevant permission information. It holds mappings, not the application bytes themselves. A TLB miss means the cached mapping was not found. In our model, hardware consults the page table and fills the TLB if the mapping is valid. Other designs can involve software in TLB refill.

<!-- VISUAL translation -->

### Three different events, three different questions

The visual resets for each selected scenario. It uses a serial translation-then-data path to show logical decisions; the table walk is summarized as one event. Page-table accesses are themselves memory accesses, but their cache traffic is omitted here. The data cache has 16-byte lines.

| Scenario | Translation state | Data-line state | Result |
|---|---|---|---|
| Read 0x1234 | TLB hit: VPN 0x12 → frame 0xA0, readable | Line 0xA030 present | Translation and data hit |
| Read 0x1244 | TLB lacks VPN 0x12; page table maps it | Line 0xA040 present | TLB miss; successful walk; data hit |
| Read 0x1254 | TLB hit, readable | Line 0xA050 absent | Data-cache miss; fetch line |
| Read 0x3434 | VPN 0x34 has no valid mapping | Not consulted for target data | Page fault |
| Write 0x5634 | TLB hit: VPN 0x56 → frame 0xB0, read-only | Not consulted for target write | Permission fault |

A missing or disallowed mapping raises a synchronous exception. The OS may install a mapping, allocate a zero-filled page, read data from storage when appropriate, or reject the access. A page fault does **not** always imply disk I/O; an invalid pointer may simply terminate the process. A TLB hit does **not** grant permission for every access type.

### State, context switches, and real implementations

Page tables belong to an address space. TLB entries must be associated with the correct address space or invalidated when necessary; address-space identifiers can help avoid clearing everything on every switch. Two threads of the same process can use the same mappings while having different registers and stacks. Changing a mapping requires an appropriate invalidation protocol so stale translations are not used.

Our serial visual is not a universal physical schedule. Some caches can begin indexing with page-offset bits while translation proceeds, then use translated information to validate the access. A cache miss and a TLB miss are logically different even when their hardware work overlaps. Berkeley's [memory-hierarchy overview](https://notes.cs61c.org/content/vm/memory-hierarchy-full/) explains this separation; the paging and TLB chapters in [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/) expand the OS side.

Pages add page tables, translation caches, permissions, and exception handling. Large pages can cover more bytes per TLB entry but create allocation and protection-granularity tradeoffs. Adding virtual memory does not add arithmetic parallelism; it changes address interpretation and isolation.

### Predict before continuing

43. Translate virtual address 0x12E8 under the stated 256-byte pages and VPN 0x12 → frame 0xA0 mapping. Which part is unchanged?
44. Can an access miss in the TLB and hit in the data cache? Describe the sequence for 0x1244.
45. A write hits in a TLB entry marked read-only. May it proceed because the translation was cached? Is a missing cache line the problem?
46. Does every page fault require reading a page from disk? Give two different possible OS responses, and explain why a context switch must preserve address-space identity.

**Checkpoint:** separately answer “which physical bytes?”, “is access allowed?”, and “where is a cached copy?”

## Lesson 12 — Predict the next instruction address

### The limitation: waiting for a branch starves fetch

A conditional branch depends on a value produced by previous work. Fetch wants its next address before the branch necessarily knows whether it is taken. Stopping fetch at every branch leaves later pipeline stages short of work.

A predictor guesses the next path. A direction predictor guesses taken or not taken; target structures provide a destination when needed. Returns and indirect jumps pose additional target-prediction problems. Prediction supplies a hypothesis. The branch's actual execution still decides the correct outcome.

### One counter, completely exposed

Our direction-only model has one two-bit saturating counter for one static branch. Values 0 and 1 predict not taken (N); 2 and 3 predict taken (T). After each branch resolves, increment toward 3 for T or decrement toward 0 for N. Start at **1, weakly not taken**. We process outcomes in order, updating before the next prediction; there is no aliasing or delayed speculative update.

For **T, T, T, N, T, T, T, N**, the predictions are **N, T, T, T, T, T, T, T**. The first encounter and the two exits are wrong: three misses in eight predictions. One isolated N changes a strong taken counter from 3 to 2 without reversing its next prediction.

<!-- VISUAL prediction -->

This tiny model teaches hysteresis: recent evidence must move the counter across a threshold. It is not a description of a contemporary complete predictor. Larger designs can use local or global branch history, multiple tables, tags, and target predictors. BOOM's [prediction documentation](https://docs.boom-core.org/en/latest/sections/branch-prediction/index.html) shows one concrete organization and warns that terminology varies.

### Trace a wrong path through the five-stage core

Return to our five-stage, in-order model. The branch is in F at cycle 1, D at 2, and resolves **at the end of E in cycle 3**. Predict not taken, but the branch is actually taken. One wrong-path instruction is in D and another in F during cycle 3. Invalidate both; fetch the target in cycle 4. Relative to correct prediction, two fetch opportunities were lost.

No wrong-path instruction has reached a side-effecting M or W stage in this specific trace. A deeper or out-of-order processor can have much more speculative work in flight, so it needs explicit machinery to prevent wrong-path architectural effects. Lesson 15 supplies that machinery.

Squashing work does not promise to erase every microarchitectural effect. For example, fetching or reading speculative data may change cache state. This is one reason architectural correctness and side-channel security are separate questions.

### How much accuracy is enough?

Use a simple long-stream estimate: base CPI + branches per instruction × misprediction fraction × additional cycles per miss. If 20% of instructions are branches, 10% of those are mispredicted, each miss costs two cycles, and base CPI is 1, the estimate is **1.04**. This ignores fill/drain and assumes penalties do not overlap. Real penalties depend on where a branch resolves and how quickly useful fetching resumes.

Prediction adds tables, history, checkpoints, wiring, and energy spent on mistaken work. A high accuracy measured on one program is not a guarantee for another. Small instruction-count reductions can lose if they create less predictable branches, and branchless transformations can lose if they add too much work.

### Predict before continuing

47. Starting at counter 1, trace T, T, T, N. What predictions occur, how many are wrong, and what is the final counter?
48. In the end-of-E branch-resolution model, which two younger instructions are squashed on a misprediction at cycle 3? When does target fetching restart?
49. With base CPI 1, branch frequency 25%, miss fraction 8%, and a five-cycle additional penalty, what is the estimated CPI? What assumptions limit this estimate?
50. Does squashing a wrong-path load imply it had no effect on cache state? May its loaded value become an architectural register result?

**Checkpoint:** keep predicted direction, actual direction, speculative execution, and architectural acceptance distinct.

## Lesson 13 — Use more than one execution opportunity per cycle

### The limitation: independent operations still queue up

Our pipeline starts at most one instruction each cycle. If a program contains independent work, wider hardware may start multiple operations. **Superscalar** describes a core capable of processing multiple instructions per cycle. It does not mean multiple cores or multiple software threads.

A real core has several widths: fetch, decode, rename, dispatch, issue, and retirement. Decode interprets instruction encodings; dispatch places decoded work into internal queues; issue selects work to begin execution; retirement accepts completed work in program order. Some ISAs decode instructions into internal micro-operations. Count instructions and micro-operations separately when comparing rates.

An execution port offers access to a particular set of functional units. Four units do not imply four operations of every kind can start together. Register-file ports, load/store bandwidth, frontend supply, and dependencies all matter.

### Compare three tiny schedules

The explorer isolates **issue and execution only**. All four integer instructions are already decoded and waiting. Issue is in program order, up to two instructions per cycle, with two interchangeable ALU ports. An add takes one cycle; its output can be consumed starting the next cycle. Instructions issued together cannot consume one another's results. There are no other resource limits. Fetch, decode, and retirement costs are excluded.

```text
Independent:          Two chains:              One chain:
A = a + 1             A = a + 1               A = a + 1
B = b + 1             B = b + 1               B = A + 1
C = c + 1             C = A + 1               C = B + 1
D = d + 1             D = B + 1               D = C + 1
```

With two ports, the first two workloads finish execution in two cycles: A/B, then C/D. The single chain needs four: A, then B, then C, then D. Its second port stays idle because no second instruction has ready inputs. With only one port, all three examples need four cycles.

<!-- VISUAL width -->

Our two-chain example has two independent operations available at each step. This is **instruction-level parallelism (ILP)** within one thread. More width helps only when the program and surrounding machinery supply enough ready work. A dependent accumulation may need algorithmic restructuring, such as separate partial sums, to expose more independence; changing floating-point evaluation order also changes rounding behavior.

### Resource bounds versus promises

Suppose four ready loads encounter a machine with one load-start opportunity per cycle. They need at least four issue cycles even if four integer ALUs are idle. Long latency alone does not specify throughput: a pipelined unit might accept a new operation each cycle while each operation takes several cycles to finish; an unpipelined unit might remain occupied throughout.

For a measurement, **IPC = retired instructions / measured cycles**. Its reciprocal is CPI when using exactly the same instruction population and cycle interval. The explorer's displayed rate is execution-window completions per cycle, deliberately excluding frontend and retirement. It is not a whole-program IPC benchmark.

Wider cores require more comparisons, bypass paths, register ports, and queue bandwidth. Energy and timing costs can grow rapidly. BOOM's [issue-unit documentation](https://docs.boom-core.org/en/latest/sections/issue-units.html) illustrates selecting ready work only onto compatible ports. Our next lesson removes a further restriction: a ready younger operation need not always wait behind a blocked older one.

### Predict before continuing

51. Under the explorer's two-port, one-cycle assumptions, how many execution cycles do the independent, two-chain, and single-chain workloads need?
52. Why can B not issue alongside A in the single-chain workload? Does adding two more identical ALUs fix this dependency?
53. Four ready loads face one load-start opportunity per cycle and four available integer ALUs. What is the minimum number of cycles in which to start the loads?
54. A program retires 240 instructions in 160 measured cycles. What are IPC and CPI? Why should the explorer's two-cycle execution window not be substituted for a complete program measurement?

**Checkpoint:** name the width being discussed, the compatible resources, and the ready operands before predicting instructions per cycle.

## Lesson 14 — Rename values and schedule ready work

### The limitation: a blocked instruction hides useful work

Consider a load that takes several cycles. An in-order scheduler stops at a dependent add even when a later add has everything it needs. An **out-of-order scheduler** can select ready younger work while preserving the program's required results.

Before doing that, separate a register's name from the different values stored under that name over time. A read-after-write (RAW) relationship is a true value dependency. Write-after-read (WAR) and write-after-write (WAW) relationships can arise because several values reuse the same architectural name.

### Rename destinations, retain source identities

Use these instructions in program order:

```text
I1: lw   x5, 0(x8)       ; eventually returns 7
I2: add  x6, x5, x9      ; x9 = 5; result must be 12
I3: addi x5, x10, 1      ; x10 = 20; new x5 must be 21
I4: add  x7, x5, x11     ; x11 = 2; result must be 23
```

At entry, architectural x5 maps to physical register p5 and x6 to p6. Allocate fresh destinations p32, p33, p34, and p35. Read each instruction's source mappings **before** replacing its destination mapping.

| Instruction | Renamed operation | Map update |
|---|---|---|
| I1 | p32 ← load at p8 | x5 → p32 |
| I2 | p33 ← p32 + p9 | x6 → p33 |
| I3 | p34 ← p10 + 1 | x5 → p34 |
| I4 | p35 ← p34 + p11 | x7 → p35 |

I2 retains a reference to p32, even after the current map for x5 becomes p34. I3 can calculate the new x5 without overwriting the loaded value that I2 needs. The WAW name conflict between I1 and I3 and the WAR name conflict between I2 and I3 no longer force their execution order. The RAW dependencies I1 → I2 and I3 → I4 remain.

### Execute the renamed program

All instructions are renamed and queued before cycle 1. Compare one-wide in-order versus one-wide oldest-ready out-of-order issue. There is one load unit and one ALU; only one new operation issues per cycle, but already executing operations can overlap. The load issues in cycle 1 and produces its value at the **end of cycle 4**. Adds take one cycle. A completed result is usable in the next cycle. Ignore frontend, misses within the already specified load latency, and retirement for this comparison.

Out of order: I1 starts in cycle 1, I3 in 2, I4 in 3, and I2 in 5. All results are ready at the end of cycle 5. In order: I1 starts in 1, waits block cycles 2–4, then I2 in 5, I3 in 6, I4 in 7. Both produce x5 = 21, x6 = 12, x7 = 23 when accepted in program order.

<!-- VISUAL rename -->

### What new state makes this possible?

A speculative rename map identifies each architectural register's current physical producer. A free list tracks unused physical registers. Readiness bits identify which values exist. Issue-queue entries retain source identities and wait for dependencies and resources. A physical register file stores different versions concurrently. Recovery needs a way to restore the appropriate mappings and reclaim abandoned allocations.

BOOM is a concrete example of an [explicit physical-register design](https://docs.boom-core.org/en/latest/sections/rename-stage.html). Other cores organize speculative values differently. Extra physical registers do not give software extra ISA register names. Their availability supports more in-flight versions.

Renaming does not break true dependencies, add memory bandwidth, or discover unlimited future work. Finite queues eventually fill. A stalled oldest instruction can block retirement and exhaust resources even while younger work finishes. More scheduling flexibility therefore creates a new requirement: decide when a computed result may become irrevocable.

### Predict before continuing

55. After all four instructions are renamed, which physical register does I2 read for x5, and which does I4 read? What is the newest speculative mapping of x5?
56. Which RAW dependencies remain, and which WAR/WAW name conflicts have been removed in this example?
57. Under the stated one-wide schedule, in which cycles do I1, I3, I4, and I2 issue out of order? When are all results ready versus in-order issue?
58. Can the old x5 physical register always be freed as soon as a younger instruction changes the rename map? Explain the need to preserve older consumers and recovery state.

**Checkpoint:** rename a sequence with repeated destinations and prove that each consumer still refers to the right version of its input.

## Lesson 15 — Complete precisely and respect memory dependencies

### The limitation: finished work may still be wrong to accept

An out-of-order core can finish I3 before I1. What if I1 faults? If I3 has already irreversibly changed architectural state, the handler may see a machine that matches no valid instruction boundary.

**Execution completion** means an operation has produced a value or detected a condition. **Retirement**, also called commit in this context, accepts instructions in program order once older uncertainty is resolved. A **reorder buffer (ROB)** tracks in-flight instructions in age order, including completion and exception status. Its head is the oldest unretired instruction.

We use an explicit physical-register model: values live in physical registers; the ROB tracks status and associated bookkeeping. Retirement updates the committed view of register mappings. It need not copy each value from the ROB into another register file. A precise synchronous exception exposes the effects of older instructions while excluding the faulting instruction's result and all younger instructions' architectural effects.

### Watch completion separate from retirement

Reuse Lesson 14's four instructions. The committed x5, x6, and x7 initially equal 0. All are allocated before cycle 1. Issue remains one-wide oldest-ready; retirement is one-wide, at the **start** of a cycle, and can use results completed by the end of the previous cycle. The load either returns 7 or reports a fault at the end of cycle 4.

| Cycle | Execution event | Retirement in the successful case |
|---|---|---|
| 1 | I1 starts its load | None |
| 2 | I3 produces p34 = 21 | None: I1 is unfinished |
| 3 | I4 produces p35 = 23 | None: I1 is unfinished |
| 4 | I1 produces p32 = 7, or records a fault | None |
| 5 | I2 produces p33 = 12 if load succeeded | I1 |
| 6 | No new execution | I2 |
| 7 | No new execution | I3 |
| 8 | No new execution | I4 |

In the fault case, cycle 5 handles the fault at the ROB head and squashes the four unretired instructions. I3 and I4's computed values are discarded from the committed view. The handler sees the pre-I1 register state. The widget omits the handler's own instructions and privileged state updates.

<!-- VISUAL retirement -->

The committed x5 temporarily denotes the loaded 7 after I1 retires, then denotes 21 after I3 retires. Meanwhile the speculative map for future decoded work already names I3's destination. Distinguish those two views. BOOM's [ROB documentation](https://docs.boom-core.org/en/latest/sections/reorder-buffer.html) describes ordered acceptance and deferring exceptions until the faulting operation is oldest.

### Memory dependencies are not register-name dependencies

A store's address and data may become ready at different times. A store queue tracks them while preventing unapproved speculative stores from modifying architectural memory. After retirement, a store can still wait in a buffer before it becomes visible to another core; retirement and global visibility are different events.

Now consider single-thread ordinary memory, initially M[A] = 3:

```text
S1: store 9 to [p]     ; older; p is not known yet
L2: load  [q]         ; younger; q = A
```

If p later equals A, L2 must observe the older store's 9. Register renaming cannot prove whether p and q name overlapping bytes. If an older store's matching address and data are known, hardware may forward the data to the load. If the matching data is not ready, the load must wait. If the address is unknown, hardware can conservatively wait or predict independence and check later.

Suppose L2 speculates, reads 3 from the cache, and even lets a dependent add produce 4. When S1's address resolves to A, the processor detects a violation, invalidates the inappropriate load result and affected younger work, and replays. A corrected load receives 9 and the dependent add receives 10. The wrong 3 and 4 must not retire. If p instead resolves to a disjoint location B, this particular dependence does not exist.

Load/store queues track addresses, order, completion, and forwarding relationships to enforce such checks. BOOM's [load/store-unit documentation](https://docs.boom-core.org/en/latest/sections/load-store-unit.html) provides one implementation example. Our example ignores atomics, device memory, partial overlaps, and other threads. Multicore memory consistency is a separate topic in the next unit, not a property that a ROB alone solves.

### The price of doing work early

Reorder buffers, store queues, speculative mappings, replay logic, and exception records consume area and energy. Wrong guesses discard work. A long-latency oldest instruction can stop retirement until queues fill and frontend progress stops. These are bounded resources, not permission to execute arbitrarily far ahead.

The design goal is to find useful parallel work while still presenting a legal architectural history. Correct recovery restores that history; it does not promise to reverse every cache or predictor change.

### Predict before continuing

59. In the successful ROB trace, which instructions have completed by the end of cycle 3, and how many have retired? Why?
60. If I1 reports a fault at the end of cycle 4, what happens in cycle 5? May x5 = 21 and x7 = 23 appear in the committed register view?
61. If an older store eventually writes 9 to A after a younger speculative load of A read 3, what must happen to that load and an unretired dependent addition of 1? Why does register renaming not solve the problem?
62. In the successful trace, when does each instruction retire? Does retirement of a store always mean another core can already observe it?

**Checkpoint:** identify where speculative values live, what keeps them reversible, and which event authorizes architectural acceptance.

## Put the eight lessons together

### A small core, explicitly specified

This final paper exercise uses a simplified out-of-order core. All four instructions are renamed and queued before cycle 1. Issue is one-wide and oldest-ready, with overlapping execution allowed. Retirement is one-wide at cycle start using earlier completions. Integer addition and branch execution each take one cycle. The load is translated successfully, but its data-cache miss makes it complete at the end of cycle 4. This four-cycle latency includes every modeled memory delay; do not add another cache or TLB penalty. There is no other contention.

The branch predicts not taken. Initial x8 is a valid pointer to a word containing 7; x5, x6, and x7 start at 0. These are the only speculative instructions in the window:

```text
I1: lw   x5, 0(x8)
I2: addi x6, x0, 9
I3: beq  x5, x5, target   ; always taken, but waits for x5 in this model
I4: addi x7, x0, 99       ; predicted fall-through path
```

The model deliberately requires both branch operands to be ready even though a more clever implementation could recognize this self-comparison. At the end of a mispredicted branch's execution, younger work is squashed. Target fetch restarts the next cycle; target instructions and their retirement are outside this exercise.

Before opening the answers, draw cycles 1–7. Mark load waiting, useful independent work, speculative work, branch execution, squash, and retirement. State the committed x5/x6/x7 values after I3 retires. Explain why a cache miss did not stop every execution unit, and why that does not make a cache miss free.

### A compact map of the new state

| Mechanism | State it adds or organizes | Limitation that remains |
|---|---|---|
| Pipeline | Intermediate values, control, valid bits | Dependencies and bubbles |
| Forwarding | Selection/control around in-flight results | Values not yet produced |
| Cache | Lines, tags, valid/dirty and replacement state | Capacity, misses, bandwidth |
| Virtual memory | Page tables, TLBs, permissions | Translation and fault costs |
| Prediction | Counters/history, targets, recovery information | Wrong guesses |
| Superscalar width | More ports and parallel opportunities | Supply, dependencies, resource compatibility |
| Renaming and scheduling | Versions, maps, free lists, readiness, queues | True dependencies and finite windows |
| Precise retirement and memory checks | ROB, load/store tracking, committed view | Oldest blocked work and recovery overhead |

You are ready for the next unit when you can explain this map using examples, without treating instruction overlap as extra threads or treating a cached translation as cached data. Unit 4 will add multiple cores, coherence, synchronization, hardware multithreading, and vectors.

The examples and traces in this workbook are original teaching constructions. Linked primary sources support the underlying mechanisms and offer further reading. Source pages were checked on 25 September 2026; no peak performance claims for contemporary commercial processors are needed for this unit.

Continue with [Unit 4: Add parallelism](unit-04-parallelism.md).
