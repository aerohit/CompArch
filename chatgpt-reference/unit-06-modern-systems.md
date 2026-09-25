# Unit 6 — Connect the modern system

Lessons 25–28 · Version 1 · 25 September 2026

A fast kernel is one stage of a larger computation. Its inputs have a numerical representation, occupy physical memory, and arrive through a finite path. Its results may need to join results from other devices. This unit follows that chain.

Continue from [Unit 5](unit-05-gpus.md). Keep its distinctions between latency, throughput, requested bytes, physical traffic, and synchronization. You will add four more questions: **Which numerical contract? Which physical home? Which communication path? Which dependency permits overlap?**

All numerical machines and timings below are deliberately specified teaching models, not measurements of a commercial product. GB means 10⁹ bytes and GB/s means 10⁹ bytes per second. The [worked answers](unit-06-answers.md) continue the course's question numbering.

## Lesson 25 — Matrix hardware and numerical formats

### Recognize a structured operation

In Unit 5, a thread kept an accumulator while a block reused input tiles. A matrix instruction exposes more of that regular computation at once. The essential mathematical operation is:

```text
D = C + A × B
D[i,j] = C[i,j] + sum over k of A[i,k] × B[k,j]
A is M×K; B is K×N; C and D are M×N.
```

Every A value can contribute to several output columns; every B value can contribute to several output rows. A specialized datapath can exploit this reuse and repeated multiply-accumulate structure. The instruction's shape and operand types define what work is offered to it. They do not reveal its exact physical circuit, cycle count, or energy.

Take A = [[1,2],[3,4]], B = [[5,6],[7,8]], and C = [[10,0],[0,10]]. Expand the operation by reduction index k. At k = 0, the first column of A times the first row of B contributes [[5,6],[15,18]]. At k = 1, the contribution is [[14,16],[28,32]]. Adding both to C gives **[[29,22],[43,60]]**.

<!-- VISUAL matrix6 -->

This is eight multiplications and eight additions, conventionally 16 FLOPs. A single matrix instruction can represent many scalar arithmetic operations, so instruction count is a poor proxy for work. Conversely, a narrow or irregular problem may spend too much time preparing operands or padding an unused tile to benefit from a high matrix peak.

### The operand has a layout, not just values

The compiler or library must arrange the tile in the storage and layout an instruction accepts. A **fragment** is a thread's portion of a matrix operand/result in an interface that distributes that operand across threads. A logical row-major matrix need not appear as a simple contiguous row in each thread's registers. Read the instruction's shape, layout, type, alignment, participation, and completion rules together.

NVIDIA PTX illustrates why rules must be tied to an instruction family: warp-level `wmma`, warp-group `wgmma`, and `tcgen05` do not share one universal participation protocol. In particular, `tcgen05.mma` has single-thread initiation semantics; do not infer that every matrix operation must be issued by every lane. Asynchronous forms also have explicit completion requirements. See the [PTX matrix instruction documentation](https://docs.nvidia.com/cuda/parallel-thread-execution/).

For an application, a tuned matrix library is a useful first baseline. Inspect the supported dimensions, strides, data types, accumulation, and numerical modes before comparing timings. A claimed matrix throughput must name its precision, sparsity assumptions, operation-count convention, and actual workload.

### Range and precision solve different problems

For a normal binary floating-point number, think of a sign, a significand near one, and a power-of-two exponent. More exponent bits mainly widen **range**. More fraction bits mainly improve the spacing of representable values within a given magnitude interval. Neither makes real-number arithmetic exact.

| Format | Sign / exponent / fraction bits | Largest positive finite value | Gap immediately above 1 |
|---|---|---|---|
| FP32 | 1 / 8 / 23 | About 3.40×10³⁸ | 2⁻²³ |
| FP16 | 1 / 5 / 10 | 65,504 | 2⁻¹⁰ |
| BF16 | 1 / 8 / 7 | About 3.39×10³⁸ | 2⁻⁷ |
| FP8 E4M3FN | 1 / 4 / 3 | 448 | 2⁻³ |
| FP8 E5M2 | 1 / 5 / 2 | 57,344 | 2⁻² |

The gap column describes these formats near one; it is not a constant absolute error bound across their entire ranges. Subnormals and special values need additional rules. The FP8 entries name particular encodings: “FP8” alone does not specify exponent allocation or treatment of infinities and NaNs. References: [CUDA floating-point appendix](https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/mathematical-functions.html), [BF16 on Cloud TPUs](https://cloud.google.com/blog/products/ai-machine-learning/bfloat16-the-secret-to-high-performance-on-cloud-tpus), and [Transformer Engine's FP8 formats](https://docs.nvidia.com/deeplearning/transformer-engine/features/low_precision_training/fp8_current_scaling/fp8_current_scaling.html).

BF16 and FP16 both use two bytes, but their error behavior differs. Around one, FP16 has eight times finer spacing than BF16. BF16 offers a much larger exponent range. Choosing a format therefore requires looking at values and tolerated error, not only storage size.

### Accumulation is another numerical choice

A matrix operation can use low-precision inputs and a wider accumulator. This preserves more of the sum than repeatedly rounding into a narrow accumulator, but **cannot recover information already lost when inputs were converted**. The exact product and accumulation semantics belong to the instruction; an FP32 output label alone is not a complete description.

Order matters even in FP32. Under round-to-nearest, ties-to-even, 2²⁴ + 1 rounds to 2²⁴. Consequently, evaluating `(2²⁴ + 1) − 2²⁴` with an FP32 rounding after the first addition gives zero, whereas `2²⁴ + (1 − 2²⁴)` gives one. A parallel reduction can change grouping and therefore the last bits. Reproducibility, accuracy, and speed are related requirements, but not interchangeable ones.

### Quantization trades resolution against clipping

Start with a simpler, explicitly integer model. For b bits, use symmetric codes from −Q to Q where Q = 2^(b−1)−1, leaving the extra negative code unused. With positive scale s:

```text
q = clip(round_to_nearest_even(x / s), −Q, Q)
x_reconstructed = s × q
```

Small s gives a fine step between reconstructed values, but a narrow interval [−Qs, Qs]. Large s expands that interval while increasing rounding error for small values. A few outliers can force an unhelpful scale for the rest of a tensor. Per-channel or per-block scaling can respond to local ranges, at the cost of scale metadata and handling.

<!-- VISUAL quant6 -->

For the six displayed values at 4 bits and s = 0.5, the reconstructed sequence is [−2.5,−1,0,0.5,1.5,3.5]. The last value clips from 6.2 to 3.5. At s = 1, clipping disappears, but small values round more coarsely. This visual is an **integer quantizer**, not an FP8 or FP4 emulator. Floating-point formats have nonuniform spacing and additional encoding rules. Modern low-precision matrix systems can combine floating-point elements with block scales; those scales and their supported types are part of the format contract.

An accuracy evaluation should include representative data, absolute and relative error, and the downstream result that matters. Relative error near zero needs care. A numerically tolerable shortcut for inference may not be tolerable for another workload or for an iterative computation that accumulates error.

### Predict before continuing

108. For the displayed matrix example, what is C plus only the k = 0 contribution? What is the final D, and how many FLOPs are counted under the multiply-plus-add convention?
109. FP16 and BF16 occupy the same bytes. Which has finer spacing near one, by what factor, and which has the wider exponent range?
110. In the 4-bit integer quantizer, reconstruct x = 6.2 and x = 0.3 at scales 0.5 and 1. Which choice removes clipping, and what does it do to the small value's error?
111. Can an FP32 accumulator restore a small input that rounded to zero during input conversion? Why can changing the order of an FP32 reduction change its result?
112. A matrix unit advertises twice the FLOPs/s of another device. Name four workload or instruction properties you need before predicting a speedup.

**Checkpoint:** separate input representation, accumulation semantics, tile layout, useful arithmetic, and data movement when evaluating a matrix operation.

## Lesson 26 — Heterogeneous systems and shared memory

### Give each engine a job it can execute efficiently

A heterogeneous system joins different kinds of compute and movement engines. A CPU handles control-heavy work and general software; a GPU exposes broad parallel throughput; an NPU or other accelerator specializes in a supported set of operations and dataflows. A DMA engine transfers data without making the CPU execute a load/store loop for every element. These are roles, not universal performance rankings.

A **system-on-chip (SoC)** integrates major system functions such as processing engines, memory interfaces, and I/O. Contemporary system designs can also span multiple dies. The internal **fabric** routes requests and responses among engines and controllers. Shared controllers and links can become bottlenecks when otherwise independent engines are active together.

<!-- VISUAL soc6 -->

Follow a hypothetical camera workload: an input engine writes a buffer; an NPU transforms it; a GPU renders an overlay; a CPU consumes a compact result. Each handoff has a data dependency, a physical path, and a completion/visibility requirement. Running every stage on its locally fastest engine may lose overall if transfers, conversion, and synchronization dominate.

### Three meanings that “shared” can hide

| Property | What it provides | What it does not establish by itself |
|---|---|---|
| Shared physical memory | Engines can use the same backing memory pool | Equal latency, equal bandwidth, cache coherence, or safe concurrent access |
| Shared/unified virtual addressing | A common address-space scheme for describing allocations | Permission for every engine to dereference every pointer, or local physical placement |
| Coherent access | The participating caches/memory agents follow a protocol for consistent views of shared locations | Program-level ordering across different locations, absence of data races, or completion of queued work |
| Managed migration | Runtime/OS mechanisms can arrange placement and movement for supported allocations | That no movement occurs, or that first access has no cost |

These properties can appear in different combinations. In CUDA specifically, unified virtual addressing and Unified Memory are separate features, and managed-memory behavior depends on platform capabilities. Query the relevant attributes rather than assuming all systems act the same. See [CUDA unified and system memory](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/understanding-memory.html).

An IOMMU provides device-side address translation and access control within configured mappings. Translation answers **where the device may access**; it does not by itself publish the CPU's latest writes or say that a producer has finished. A driver/runtime must use the platform's supported cache maintenance, coherence, and synchronization mechanisms.

### A handoff is an ownership protocol

Consider a buffer that a CPU fills and a device consumes. First finish producing the required bytes. Then use the supported submission and synchronization mechanism to make those writes available before device consumption. While the device is using the buffer, avoid conflicting reuse. Before reading its output or recycling its storage, observe the required completion event. On a noncoherent path, cache maintenance may be part of these transitions; use the platform API rather than inventing a flag protocol.

Even coherent memory does not make a simultaneous unsynchronized read and write safe. Recall Unit 4: coherence, ordering, and atomicity answer different questions. A completion event also has a scope—completion of one operation is not a promise that every device in the system is idle.

### Pipeline independent chunks

Suppose each of four independent chunks requires a 2 ms host-to-device transfer, 3 ms computation, and 1 ms device-to-host transfer. Doing all three stages serially for each chunk costs **24 ms**. If the three stages have independent engines, buffers, and sufficient bandwidth, they can form a pipeline.

The first result arrives after 2 + 3 + 1 = 6 ms. The compute stage sets the steady interval at max(2,3,1) = 3 ms. Four chunks therefore finish in **6 + 3×3 = 15 ms**. Work on a particular chunk still follows transfer-in → compute → transfer-out. Overlap comes from different chunks being at different stages.

<!-- VISUAL pipeline6 -->

The schedule assumes fixed per-chunk times, independent transfer directions, sufficient buffering, no resource contention, and no setup overhead. On CUDA systems, asynchronous API calls alone do not guarantee useful overlap: stream dependencies, host-memory properties, and hardware capabilities matter. See [asynchronous execution](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html). Two engines drawing from one saturated memory interface may interfere even if their timeline bars overlap.

### Power is a shared resource too

CPU, GPU, and specialized engines may share a package power and thermal budget. Increasing one engine's activity can reduce the frequency sustainable elsewhere. Dynamic switching power is often approximated as proportional to activity × capacitance × voltage² × frequency; leakage and other costs remain. This is an explanatory relationship, not a calculator for a real chip without its parameters.

An energy comparison needs **joules for the completed task**, as well as time. A specialized engine may reduce arithmetic energy but require a costly conversion or transfer. Record the entire interval and the operating conditions; a short peak-throughput test need not describe sustained operation.

### Predict before continuing

113. CPU and GPU can name an allocation with one virtual address. Does this establish shared physical DRAM, coherent access, or zero transfer cost?
114. A CPU writes data and immediately reuses its input buffer after submitting a device operation. What dependency is missing, even if the memory is coherent?
115. With the specified 2/3/1 ms stages, how long do four chunks take serially and with the ideal pipeline? What are the first-result latency and steady completion interval?
116. If the transfer engines share a saturated memory interface with computation, which pipeline assumption fails? Why is an asynchronous call insufficient evidence of overlap?
117. An NPU kernel takes 2 ms versus 5 ms on the GPU, but adds 4 ms of nonoverlapping conversion and transfer. Which route finishes sooner under these assumptions, and what must an energy comparison measure?

**Checkpoint:** draw a data path, then annotate each handoff with who may use the storage and which event permits the next stage.

## Lesson 27 — Packaging, HBM, and memory locality

### A package is a physical arrangement

A **die** is an individual piece of semiconductor. A **chiplet** is a die intended to function as a building block in a larger design. A **package** connects and protects one or more dies and connects them to the board. An **interposer** or bridge can provide dense connections between nearby dies; three-dimensional integration can stack components vertically. These choices change the distance, density, cost, power, and bandwidth of communication.

Splitting a large design can help manufacturing yield, reuse, and the choice of process for each function. It also introduces interfaces, assembly complexity, and potential locality boundaries. “Chiplet” tells you the construction strategy; it does not specify whether software sees one processor, several NUMA domains, one cache, or many.

UCIe is one example of a standardized package-level die-to-die interface. An interface specification supplies interoperability rules; it does not make all chiplet designs interchangeable or all access paths equally fast. See the [UCIe specifications overview](https://www.uciexpress.org/specifications).

### HBM gets bandwidth from a wide nearby interface

High Bandwidth Memory uses stacked DRAM with a wide interface near a processor package. Physical integration can provide many parallel connections without routing all of them across a conventional board-level memory interface. A memory controller still schedules accesses, and workloads still need locality and enough concurrent requests. HBM is capacity-constrained memory, not a giant register file. [Micron's HBM overview](https://www.micron.com/products/memory/hbm) describes this stacked, wide-interface approach.

Build a bandwidth estimate from units. A hypothetical stack has 1,024 data pins at 4 billion transferred bits per second per pin:

```text
1024 × 4×10⁹ / 8 = 512×10⁹ bytes/s = 512 GB/s per stack
4 stacks: 2,048 GB/s = 2.048 TB/s raw aggregate
4 stacks of 16 GB each: 64 GB capacity
```

The rate is already bits transferred per second per pin: **do not multiply by two again**. These are invented specification inputs for practice, not the specification of a named HBM generation. The aggregate is a raw ceiling; refresh, access patterns, controller utilization, and competing traffic affect delivered bandwidth. Capacity and bandwidth are separate dimensions. Doubling capacity alone does not prove doubled bandwidth, and high bandwidth does not imply a proportional reduction in the latency of one dependent read.

### Locality depends on the requester

In a non-uniform memory access (**NUMA**) system, the cost of reaching memory depends on where the requester and memory reside. A core can reach a local controller directly or travel across a fabric to a remote controller. The virtual address can stay unchanged while the physical placement determines the route. The [Linux NUMA introduction](https://docs.kernel.org/mm/numa.html) presents this distinction.

Our teaching machine has two nodes. A thread runs on A; a cache-missing dependent load takes 80 ns from A's DRAM or 140 ns from B's DRAM. Assume each next address depends on the previous result, so no loads overlap. If fraction f is remote:

```text
mean latency = (1−f) × 80 + f × 140 ns
time for 10⁶ such loads = mean latency in milliseconds
```

<!-- VISUAL locality6 -->

At f = 0.5, the mean is 110 ns and the million-load trace takes 110 ms. This is a serial latency model, **not a streaming bandwidth model**. Independent loads can overlap; multiple workers can saturate controllers or links. You cannot convert this weighted latency into a reliable GB/s prediction for a parallel streaming workload.

### Allocation and execution must agree

On systems using local allocation policies, the thread that first faults in a page can influence its initial home. A successful allocation call alone does not prove all physical pages were allocated near the eventual worker. Read faults, shared zero pages, explicit policies, fallback, and migration complicate the simple “first touch” story. The [Linux NUMA memory-policy documentation](https://cdn.kernel.org/doc/html/latest/admin-guide/mm/numa_memory_policy.html) describes policy scope and allocation behavior.

A practical investigation connects worker placement, allocation policy, initialization, measured page placement, and later accesses. Parallel initialization by the eventual workers can help under a suitable policy; pinning a worker without placing its data may leave the remote route intact. Migrating pages also moves bytes and takes time.

The same reasoning extends to accelerator memory: a value may be local to one GPU but remote to another, and a cache may hide some accesses. For each hot allocation, draw **requester → caches → fabric/link → controller → physical memory**. Mark where you count bytes and what else shares each path. A package drawing is useful only when connected to those access routes.

### Predict before continuing

118. For the hypothetical four-stack memory system, calculate raw bandwidth and capacity. Why should you not add an extra factor of two to the given pin rate?
119. A thread on A sends 25% of its dependent cache-missing reads to B. Find the mean latency and time for one million reads.
120. Why does that dependent-load calculation not predict the bandwidth of a loop with many independent reads? Name two resources that could limit the latter.
121. Does moving a worker from B to A automatically move its already allocated pages? How could initialization and allocation policy change the outcome?
122. A processor changes from one die to four chiplets. What evidence would you need before asserting four NUMA domains or a fourfold speedup?

**Checkpoint:** use the physical route and access pattern to explain a cost. Treat package boundaries and software-visible locality domains as related but distinct facts.

## Lesson 28 — Multiple GPUs and nodes

### Partition the work, then account for its edges

Several accelerators can hold more data and execute more work. They also need to exchange values when partitions interact. **Strong scaling** holds total work fixed and adds processors. **Weak scaling** grows work with processor count, often holding local work roughly fixed. A speedup number is incomplete until the workload rule is stated.

In data-parallel training, workers process different data and combine gradient contributions. Tensor partitioning splits an operation and can require communication inside a layer. Pipeline partitioning assigns stages to devices and moves activations between them. These strategies create different dependencies and communication frequencies; they can also be combined. More devices do not remove the serial or communication parts of the computation.

A **rank** identifies a participant in a communication operation. In our example there is one rank per GPU, but a rank is a software identity, not a hardware unit. The participants must agree on the collective's ordering, data size, type, and operation.

### Know what the collective promises

| Collective | Input | Result |
|---|---|---|
| Broadcast | A buffer at a designated root | Each rank receives that buffer |
| Reduce | A contribution at every rank | The root receives the combined result |
| All-reduce | A contribution at every rank | Every rank receives the combined result |
| Reduce-scatter | A contribution at every rank | Each rank receives its assigned piece of the combined result |
| All-gather | A distinct piece at every rank | Every rank receives the concatenated pieces |

The operation's semantics are independent of the algorithm used to carry it out. An all-reduce can be constructed from a reduce-scatter followed by an all-gather, but libraries choose among algorithms and protocols using message size, topology, and device capabilities. See [NCCL collective operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html).

### Follow a ring all-reduce

Arrange four ranks in a directed ring, R0 → R1 → R2 → R3 → R0. Each starts with a four-element vector, split into four single-element chunks:

```text
R0: [   1,    2,    3,    4]
R1: [  10,   20,   30,   40]
R2: [ 100,  200,  300,  400]
R3: [1000, 2000, 3000, 4000]
Wanted at every rank: [1111, 2222, 3333, 4444]
```

During three reduce-scatter rounds, each rank sends one selected partial chunk clockwise and adds a received partial chunk to its own contribution. Eventually each rank owns one chunk containing all four contributions. In this schedule R0 owns chunk 1, R1 owns chunk 2, R2 owns chunk 3, and R3 owns chunk 0; this rotation is a schedule choice. Three all-gather rounds circulate these complete chunks until everyone has all four.

<!-- VISUAL ring6 -->

A round uses the state from before that round for every send. Otherwise the diagram would accidentally propagate a result several hops in one step. Contribution labels let you check that each final value includes each rank exactly once. Intermediate unreduced cells can remain stale; only a cell marked complete is a final sum.

### Derive the communication cost

For P ranks and an M-byte contribution at each rank, split into P equal chunks. Each rank sends M/P bytes in each of P−1 reduce-scatter rounds and P−1 all-gather rounds:

```text
bytes sent per rank = 2 × (P−1)/P × M
T_ring ≈ 2 × (P−1) × α + 2 × (P−1)/P × M/β
```

Here α is the fixed time per round and β is the sustained bandwidth of each concurrently usable directed ring link. We assume identical links, full-duplex send/receive, equal chunks, no competing traffic, and negligible reduction/packing cost. This model is for the chosen ring schedule, not every all-reduce implementation. Bytes received equal bytes sent; do not double the time again if the links already support the simultaneous transfers assumed here.

With P = 4, M = 100 MB, β = 25 GB/s, and α = 5 μs, each rank sends 150 MB. The transfer term is 6 ms and the six rounds add 0.03 ms: **6.03 ms**. For the tiny four-element visual, each element is assumed four bytes, so M = 16 B and each rank sends 24 B over six rounds. The tiny example teaches values and scheduling, not efficient message sizing.

<!-- VISUAL scaling6 -->

The scaling visual keeps total compute fixed at 40 ms on one rank and assumes ideal compute division. A blocking all-reduce follows computation. At four ranks, total time is 40/4 + 6.03 = **16.03 ms**, speedup about **2.50×**, efficiency about **62.4%**. At eight ranks, communication takes 7.07 ms, giving **12.07 ms**, only **3.31×** speedup. Try a larger message and watch communication consume the savings.

### A logical ring still uses physical links

A direct GPU link, a PCIe path through a switch, a CPU interconnect, and a network hop have different bandwidth, latency, and contention. Several logical ring edges can share one physical bottleneck. If every node must push data through one NIC or one oversubscribed switch link, adding logical connections does not increase that cut's capacity.

When reading advertised bandwidth, distinguish per-link from aggregate, one direction from the sum of both directions, raw line rate from payload rate, and local scale-up links from inter-node network links. A direct device-to-device DMA path can avoid staging through a CPU buffer while still requiring mappings, permissions, synchronization, and physical transfer time. “Direct” is not a promise of cache coherence or free communication.

### Overlap has a dependency graph

The scaling model intentionally places the collective after compute. Real programs may produce independent buckets gradually and begin communicating an earlier bucket while computing a later one. Only data that is ready can be sent, and the consumer of a collective result must await its completion. The last communication tail can remain exposed, and communication can contend with compute for memory bandwidth.

For perfectly overlapping independent stages, max(compute time, communication time) is an optimistic bound. Adding their times describes serialization. Neither formula alone proves what the program achieves. Inspect a timeline, include the final synchronization, and measure the complete iteration. Numerical changes from a different reduction order also need an accuracy check.

### Predict before continuing

123. After the ring's three reduce-scatter rounds, does every rank already possess a complete result vector? Which complete chunk does each rank own in this schedule?
124. For four ranks and a 100 MB contribution, how many bytes does each rank send across both phases? Find the modeled time with β = 25 GB/s and α = 5 μs.
125. With 40 ms of fixed total compute, what are runtime, speedup, and efficiency at four ranks in the specified blocking model? What changes at eight ranks?
126. Two logical ring edges share one physical link whose capacity is 25 GB/s. Why is the independent-link calculation optimistic? Can a “direct” path eliminate the dependency on completion?
127. A collective requires a gradient bucket that has not yet been computed. Can launching it asynchronously overlap that bucket's production with its transfer? How could earlier completed buckets still provide overlap?

**Checkpoint:** draw the collective's data dependencies and physical routes before applying a bandwidth number or claiming a scaling result.

## Put the four lessons together

Trace this hypothetical iteration. A CPU prepares input in host memory. Four GPUs receive separate chunks, execute low-precision matrix operations with a specified accumulator, combine four-byte gradient values with an all-reduce, then return a compact result for CPU consumption.

1. **Name the representation.** Distinguish input elements, scale metadata, accumulators, collective buffers, and output conversion. Quantizing inputs does not automatically shrink a still-FP32 communication buffer.
2. **Name the physical homes.** Mark which CPU node supplies host data and which GPU owns each device allocation. Common pointer naming is not a placement guarantee.
3. **Draw every movement.** Host → GPU, HBM → on-chip tile storage, GPU → neighboring GPU, and GPU → host. A byte can cross several boundaries; each boundary has its own useful count and physical traffic.
4. **Establish the handoffs.** Input production precedes its transfer; transfer precedes consumption; local gradient production precedes reduction; reduction completion precedes use of the combined result; output transfer completion precedes CPU reading.
5. **Find the critical path.** Overlap independent chunks only where engine capacity and dependencies permit. Include initialization, conversion, launch, transfer, collective, and synchronization in the interval you intend to optimize.
6. **Validate the answer.** Compare to a suitable numerical reference, then measure representative steady-state and first-use behavior separately. A faster incorrect result does not complete the task.

**Milestone:** produce one annotated diagram of this iteration and a time budget whose assumptions are explicit. Explain which change you would try first and what measurement could show that your hypothesis was wrong.

## Finish the unit

You should now be able to expand a matrix operation, reason about range and rounding, separate meanings of shared memory, schedule a three-stage pipeline, identify a NUMA route, derive ring traffic, and explain limited multi-GPU scaling.

Use the [worked answers and transfer exercises](unit-06-answers.md) before moving on. Unit 7 will apply the course to documented CPU/GPU architecture case studies and a measured capstone, distinguishing established facts, vendor claims, and unknown implementation details.
