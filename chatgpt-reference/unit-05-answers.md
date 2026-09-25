# Unit 5 — Worked answers

Lessons 20–24 · Version 1 · 25 September 2026

Use with [Unit 5: Understand GPUs](unit-05-gpus.md). Predict first, then reveal the reasoning. Question numbering continues from Unit 4.

## Lesson 20

**83.** **Two blocks, 128 launched threads, and four warps**: each 64-thread block contains two 32-thread warps. Block 1 starts at global index 64. Only its first six threads, indices 64–69, satisfy `i < 70`; its second warp has no useful lanes at the guarded array instruction. These 58 excess launched threads differ from nonexistent positions in a partial warp.

**84.** The global index is 2×48 + 17 = **113**. Within that block, warp = floor(17/32) = **0**, lane = 17 mod 32 = **17**. Warps are formed within a block, whose resources and synchronization scope are distinct. The next block starts its own thread and warp numbering; it does not fill unused positions in its neighbor's partial warp. Whether index 113 passes the array guard depends on N.

**85.** Neither implication is valid. Only the blocks admitted under available hardware resources are resident; others wait. Ordinary CUDA block scheduling provides no required increasing-block-ID execution order. The kernel must be correct across permitted schedules. A design in which resident blocks wait for unscheduled blocks can fail to make progress.

**86.** A private register value belongs logically to one thread, even when registers for many threads occupy the same physical register file. Shared-memory storage belongs to a block in this baseline and supports cooperation among its threads. A global array element has an address accessible across blocks; shared accessibility does not eliminate the need to avoid races and establish ordering when communicating.

**87.** Warp width describes the logical grouping of threads. Physical lane count, instruction throughput, execution latency, and pipeline organization are implementation properties and can differ by operation. The hardware may process a group over multiple cycles or use specialized units. Group size alone supplies none of those timing facts.

## Lesson 21

**88.** Each block has two warps and needs 64×64 = 4,096 registers. The register file permits floor(8,192/4,096) = **two blocks**, hence **four resident warps / eight = 50%**. The other stated limits allow four blocks. With R = 32 and S = 8 KiB, the shared-memory pool instead limits the configuration to two blocks, again 50%. Equal occupancy can come from different resource constraints.

**89.** Fewer allocated registers can admit more warps but force live values to spill. Extra loads/stores may add latency and traffic, and reducing per-thread working state can also change instruction scheduling. Inspect the generated resource usage and spill traffic, then time the kernel. Occupancy is an input to the explanation, not the performance objective.

**90.** The value first becomes available at the start of **cycle 6**. In the two-warp trace, the lowest-ID rule chooses W0's STORE in cycle 6, so W1's ADD actually issues in cycle 7. Two warps finish in **eight cycles**, filling six of eight slots, **75%**. Operand readiness and being selected to issue are different events.

**91.** Both paths have participants, so five group arithmetic instructions issue: 8×5 = **40 lane-instruction positions**. Useful work is 1×2 + 7×3 = **23**, giving **57.5%**. The result differs from 50% because the paths have different lengths. It excludes branch/reconvergence overhead and is not a cycle-level measurement.

**92.** More arithmetic units are not yet justified. Determine why resident warps are ineligible: waiting on dependent loads, arithmetic results, synchronization, or unavailable pipelines. Inspect memory latency/traffic and bandwidth, dependency stalls, barrier behavior, and issue activity together. If inputs are unavailable, extra arithmetic hardware alone does not supply them.

## Lesson 22

**93.** The addresses are 0,8,16,…,248. Each aligned 32-byte sector supplies four requested words. There are **eight sectors**, **256 sector bytes**, and **128 useful bytes**. Useful fraction = **50%**. This counts one instruction's sector coverage, not DRAM commands or a guaranteed runtime ratio.

**94.** At aligned base, 128 contiguous bytes fit four sectors. Starting at byte four makes the last word end at byte 131, touching a fifth sector: **160 sector bytes and 80% useful fraction**. Adjacent warps can use each other's overfetched sectors; cache hits and downstream combining change DRAM traffic. Stores also have their own physical traffic behavior. Choose the accounting boundary explicitly.

**95.** Word l: **one round**, one word per bank. Word 8l: **eight rounds**, eight different words in bank 0. Word 9l: **one round**, banks 0–7. Constant word 0: **one round by broadcast**. Same bank and same word is different from same bank and different words in this read model.

**96.** CUDA local memory is an address space with thread-private visibility, commonly used for spills and some addressable local arrays. Its accesses travel through memory machinery and may be backed by off-chip device memory, though caches can help. Private ownership does not promise physical on-chip placement. A register value avoids those explicit addressable-memory accesses.

**97.** No. The set of required sectors is unchanged by a permutation of lanes. Whole kernels may still differ in cache reuse across instructions, dependencies, divergence, instruction count, shared-memory bank conflicts, or other work. One equal traffic count is only one equal property.

## Lesson 23

**98.** After indices 0 and 1, the partial matrix is **[[7,10],[23,34]]**. After indices 2 and 3 it is **[[50,60],[114,140]]**. For example, C[1,1] = 5×2 + 6×4 + 7×6 + 8×8 = 10 + 24 + 42 + 64 = **140**. The shared tiles are replaced; the private accumulators retain the partial sums.

**99.** Without the load-completion barrier, a consumer can read a neighbor's not-yet-written tile entry. Without the reuse barrier, a fast producer can overwrite an entry for the next tile before a slow consumer has finished reading it for the current tile. The first orders production before consumption; the second orders consumption before reuse. Either hazard can produce incorrect sums without an out-of-bounds address.

**100.** Staged: **16 input words + 4 output words = 80 bytes**. Four outputs each perform four multiply-adds, giving **16 multiply-adds = 32 FLOPs** under the two-operation convention. Independent operand requests: 4×4×2 = 32 input words plus four outputs, or **144 bytes**. The requested-byte ratio is **1.8**. Caches or broadcasts can reduce unstaged physical traffic, while staging adds on-chip instructions and barriers; the ratio does not establish a measured time ratio.

**101.** A zero substitutes the neutral contribution of an out-of-range reduction input without making an invalid memory access. Every thread still performs the required synchronization, so the other threads can safely consume and reuse shared storage. Threads whose output coordinates are outside C suppress the final global store. A guard around a load is separate from participation in the block-wide protocol.

**102.** A larger tile can increase reuse and reduce global requests per FLOP, but increase registers and shared storage, lower resident blocks, change bank behavior, and increase tail work. Measure requested/physical traffic, resource allocation, eligible work, synchronization, and elapsed time. A lower byte count can help while the overall kernel becomes slower for another reason.

## Lesson 24

**103.** W = **1,000,000 FLOPs**, Q = **12,000,000 bytes**, and I = **1/12 FLOP/B**. W/P = **0.1 μs**; Q/β = **60 μs**. The lower time bound is their maximum, **60 μs**, and the corresponding throughput ceiling is βI = **16.67 GFLOP/s**, or 0.01667 TFLOP/s. It assumes that Q is the actual byte count at the 200 GB/s boundary and excludes fixed overhead.

**104.** The ridge is **50 FLOPs/B**. Doubling P lowers the compute component from 0.1 to 0.05 μs and moves the ridge to 100 FLOPs/B, but the 60 μs memory component still determines the array-add bound. Doubling bandwidth instead lowers that component to 30 μs under unchanged traffic assumptions.

**105.** Original: 10 + max(0.1,60) = **70 μs**. Hypothetical reduced traffic: 10 + max(0.1,30) = **40 μs**. The modeled speedup is **70/40 = 1.75**, because the fixed 10 μs remains. The premise requires a valid way to reduce traffic; vector addition cannot simply discard required input/output bytes.

**106.** A kernel launch can return while its work is still queued or executing. Record start and stop events around the work in the same stream, synchronize with the stop event, and query elapsed time. Warm up beforehand and check errors. Repeated work can have a different cache state than a single cold run, and a batch can include host-enqueue gaps or contention from other streams. Define and report the interval rather than treating every timer as the same measurement.

**107.** One hypothesis is saturated memory bandwidth: inspect bytes at the relevant boundary and the achieved byte rate. Another is dependency latency leaving too few eligible warps: inspect scheduler eligibility/issue activity and dependency stalls, possibly with bandwidth well below its ceiling. Divergence, barriers, instruction throughput, grid size, and launch overhead are other possibilities. Potential occupancy is only a capacity calculation; it does not choose among them.

## Integrated case — Seventy results, several different counts

Two 64-thread blocks contain four warps. The guarded instructions have 32,32,6,0 participating lanes. For each aligned array, the first two groups use four sectors each and the tail uses one: **nine sectors**. Across two loads and one store, that is **27 sectors = 864 sector bytes**, while useful traffic is **70×12 = 840 bytes**. Useful fraction is 840/864 ≈ **97.2%** for this specified sector accounting.

Counting the whole launch as 128 useful additions would overstate work. Counting all launched lanes' addresses as memory requests would include operations excluded by the guard. Counting 864 bytes as proven DRAM traffic would cross a model boundary without evidence. The point is to keep the launch, active instructions, sector coverage, and physical transfers distinct.

At N = one million, the traffic-based Roofline model is more informative than at N = 70, where launch and insufficient parallel work may dominate. Shared-memory staging offers no repeated-use saving for a simple one-use array add. Matrix multiplication has a different reuse structure, which is why tiling can reduce its global requests.

## Transfer exercises

1. **A partial block.** For N = 100 and 48 threads per block, find block and warp counts and each warp's useful-lane count. Then compute useful positions / total warp positions.
2. **A capacity change.** On the teaching SM, use T = 128, R = 32, and S = 4 KiB. Which limits tie, and what is potential occupancy?
3. **A padded column.** In the eight-bank model, change the row pitch from eight words to ten. How many service rounds does an eight-lane column read need?
4. **A different Roofline point.** Use W = 10⁹ FLOPs, Q = 4×10⁶ bytes, P = 10 TFLOP/s, and β = 200 GB/s. Find intensity, both time components, and the result with H = 10 μs.

### Transfer answers

1. **Three blocks, six warps.** Useful-lane counts by block are **[32,16], [32,16], [4,0]**. Each partial second warp has 16 nonexistent positions. The last block has only four useful threads; its other launched threads fail the guard. Useful fraction across all warp positions is **100/(6×32) ≈ 52.1%**. Across launched threads it is 100/144 ≈ 69.4%; those denominators answer different questions.
2. Each block uses four warps and 4,096 registers. Thread, warp, and register limits each allow **two blocks**; block and shared-memory limits allow four. Occupancy = 2×4/8 = **100%**. The resource calculation does not prove either block is always eligible.
3. Bank = 10l mod 8 = 2l mod 8. Four banks each receive two distinct words, so **two rounds**. Padding by one eliminated conflicts in the earlier example; arbitrary padding does not always eliminate them.
4. I = **250 FLOPs/B**. Compute time = **100 μs**, memory time = **20 μs**. The compute roof is the tighter ceiling; the unoverlapped overhead model gives **110 μs**. This is an idealized bound plus a stipulated cost, not an observed result.

## Ready for the next unit?

You are ready when you can trace one logical thread without assigning it a dedicated core, compute residency from explicit resources, identify why an eligible warp might still wait to issue, count sectors and banks, protect a shared tile through both barriers, and define a performance experiment with a named byte boundary.

Return to the relevant exploration if one of those steps depends on memorizing a slogan. The next unit introduces matrix execution hardware, numerical formats, heterogeneous systems, and communication beyond one accelerator.
