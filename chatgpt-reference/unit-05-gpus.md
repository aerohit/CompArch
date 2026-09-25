# Unit 5 — Understand GPUs

Lessons 20–24 · Version 1 · 25 September 2026

Continue from [Unit 4](unit-04-parallelism.md). Keep the [worked answers](unit-05-answers.md) closed until you have made a prediction. This unit needs no GPU, installation, or account: every exploration runs in this HTML file.

We now have several ways to overlap work. A GPU combines many resident execution contexts with grouped instruction execution and a memory system designed for throughput. The interesting question is how a particular program supplies enough independent, correctly coordinated work to use that machinery.

Read this unit in five sessions. Lesson 21 has three short explorations; pause between resource capacity, scheduling, and branch masks. Lesson 23 deserves a paper trace before you step through the tile. The final lesson turns the earlier diagrams into quantitative hypotheses.

## Lesson 20 — From an array loop to SIMT

### The limitation we are solving

A CPU vector instruction can apply one operation to several elements, but a large array still needs many such instructions. Suppose millions of outputs are independent. We want a programming model that describes those independent tasks and an implementation that can keep many of them in progress while sharing instruction-control hardware.

**SIMT** means single instruction, multiple threads. A programmer describes logical threads, each with its own indices and private values. Hardware groups related threads for instruction issue. The arithmetic often uses SIMD-style execution resources underneath. SIMT and SIMD therefore describe different aspects of the system; they are not mutually exclusive circuit technologies.

A GPU thread is not a dedicated physical core, and launching a million threads does not mean a million threads execute simultaneously. Logical work can wait for resources. A processing unit can hold several groups' state and select ready instructions from them over time.

### Name the levels before drawing the chip

| Level | NVIDIA CUDA term | AMD / HIP vocabulary | What it means here |
|---|---|---|---|
| One logical invocation | Thread | Thread / work-item | Private working values and an index into the problem |
| A cooperation group | Thread block | Block / workgroup | Threads that can cooperate using a local scratchpad and group synchronization |
| A launch's collection of groups | Grid | Grid / dispatch | All the blocks for this kernel invocation |
| A hardware execution group | Warp | Wavefront / wave | Related threads grouped for instruction execution |
| A hardware processing unit | Streaming multiprocessor, SM | Compute unit, CU; some designs group CUs in a WGP | Registers, schedulers, execution resources, and local storage |

These are correspondences for reading diagrams, not interchangeable specifications. CUDA warps have 32 threads. AMD wave width and CU/WGP organization depend on the architecture and execution mode; do not translate every NVIDIA number by changing the labels. The official [CUDA programming model](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html) and [AMD architecture index](https://rocmdocs.amd.com/en/develop/reference/gpu-arch/index.html) are the starting references.

In ordinary CUDA execution, a block is placed on one SM, and its warps belong to that block. Several blocks can share an SM if resources permit. A grid can greatly exceed the GPU's resident capacity. Block number does not specify an SM, launch order does not establish inter-block execution order, and a block must not depend on an ordinary unscheduled block making progress. Specialized cluster and cooperative-launch facilities add other contracts; our baseline does not use them.

### Write one element's work

The CPU loop is `for (i = 0; i < N; ++i) c[i] = a[i] + b[i]`. With disjoint input/output arrays, output i does not depend on output i−1. A CUDA kernel can assign one thread to each element:

```cpp
__global__ void add_arrays(const float* a, const float* b,
                           float* c, size_t n) {
    size_t i = size_t(blockIdx.x) * blockDim.x + threadIdx.x;
    if (i < n) c[i] = a[i] + b[i];
}
// For n > 0, with valid device pointers and a supported grid size:
// threads = 64; blocks = 1 + (n - 1) / threads;
// add_arrays<<<blocks, threads>>>(a, b, c, n);
```

The indices are zero-based. `blockIdx.x` identifies a block; `threadIdx.x` identifies a thread within it; `blockDim.x` is its thread count. The cast makes the product a size_t calculation. This is the device computation and launch sketch, not a complete allocation/error-handling program.

For N = 70 and 64 threads per block, launch two blocks and 128 logical threads. Block 0 handles indices 0–63. Block 1 contains indices 64–127, but only six satisfy the guard. Within block 1, warp 0 has six useful lanes at the guarded array instruction; warp 1 has none. The tail threads still exist in the launch. The guard prevents invalid memory accesses and does not compress the grid.

<!-- VISUAL gpumap -->

Try 48 threads per block. Warps form within each block: block 0 has one full warp and one 16-thread partial warp. Block 1 starts its own warp numbering. Hardware does not fill block 0's partial warp with threads from block 1. Distinguish positions with no launched thread from launched threads excluded by `i < N`.

### Follow one value through the hardware

Thread i computes an address, loads a[i] and b[i], adds them in its private working state, and stores c[i]. Its neighbors perform the same instruction on their own values. A warp instruction describes the group operation; the number of physical arithmetic lanes and the number of cycles needed depend on the instruction and implementation. “32 threads in a warp” does not imply every instruction uses 32 physical units for one clock.

An SM needs storage for resident threads' registers, instruction/control state, dependency tracking, block resources, and scheduler state. The register name in one thread identifies a different logical value from that name in its neighbor. Block-local shared memory belongs to a cooperating block; global arrays can be accessed across blocks. The host CPU enqueues work and can continue asynchronously, so reading an output on the host requires the appropriate completion and data-access arrangement.

The gain is the ability to amortize instruction control and use extensive parallel work. The costs include context storage, data movement, inactive lanes, and coordination. A long serial pointer chain does not become independent simply because it runs on a GPU.

### Predict before continuing

83. For N = 70 and 64 threads per block, how many blocks, launched threads, and warps are there? How many lanes of block 1's first warp satisfy the array guard?
84. Thread 17 in block 2 of a 48-thread launch computes which global index, warp-within-block, and lane? Why cannot a partial warp borrow threads from the next block?
85. Does launching 1,000 blocks imply that 1,000 blocks are resident simultaneously or that block 0 must execute first?
86. Distinguish a thread's private register value, a block's shared-memory value, and an array element in global memory.
87. Why does a 32-thread warp not establish either 32 physical arithmetic lanes for every instruction or a one-cycle latency?

**Checkpoint:** map an element to a block, thread, warp, and lane without confusing any of them with an SM or a physical arithmetic unit.

## Lesson 21 — Capacity, readiness, and useful issue

### Resident does not mean ready

A **resident** warp has been admitted and has the state/resources needed to remain on an SM. An **eligible** warp can issue its next instruction now: its operands and required execution resource are available, and synchronization has not blocked it. An **issued** warp has actually been selected for an instruction opportunity. A warp can be resident for many cycles without being eligible.

**Occupancy** expresses resident warps relative to the hardware's supported maximum, usually per SM. A resource calculation gives a potential occupancy limit for a kernel configuration. Measured occupancy may be lower because the grid is small, blocks finish at different times, or not all capacity stays filled. Neither is a measure of useful arithmetic throughput.

### Count the resources in a small teaching SM

Our hypothetical SM has space for eight warps, 256 threads, four blocks, 8,192 registers of 32 bits each, and 16 KiB of shared memory. A block uses T threads, R registers per thread, and S KiB shared memory. We deliberately ignore allocation rounding, register-file partitions, and other real limits.

```text
warps_per_block = ceil(T / 32)
resident_blocks = min(4,
                      floor(256 / T),
                      floor(8 / warps_per_block),
                      floor(8192 / (T * R)),
                      floor(16 / S))
occupancy = resident_blocks * warps_per_block / 8
```

For S = 0, omit the shared-memory bound. A zero result means the block cannot fit this teaching SM. Real devices and compilers allocate resources in architecture-specific units; use their occupancy tools and kernel resource reports for actual launches.

At T = 64, R = 32, S = 4, four blocks fit: eight warps and 100% potential occupancy. Doubling R to 64 leaves room for two blocks and four warps: 50%. Keeping R = 32 but using S = 8 also permits only two blocks. Register and shared-memory pressure are separate limits.

<!-- VISUAL occupancy -->

Reducing registers can introduce **spills**: values move into thread-private addressable memory and require memory instructions. Smaller tiles may increase repeated loads. A change that raises occupancy can therefore increase work or traffic. The objective is elapsed time for the correct result, not the largest occupancy percentage.

### Hide latency by selecting another ready group

Consider a separate scheduler model with one instruction-issue opportunity per cycle. Each warp performs `LD → ADD → STORE`. All begin eligible at cycle 1. A load issued at cycle c supplies its operand at the start of c+4. ADD supplies its result at the next cycle. STORE completes at the end of its issue cycle. Choose the lowest-numbered eligible warp. There is no memory-bandwidth contention, instruction-fetch delay, or separate store-completion delay in this toy model.

| Resident warps | Issue sequence by cycle | Total cycles | Filled issue slots |
|---|---|---|---|
| 1 | W0:LD, idle, idle, idle, W0:ADD, W0:STORE | 6 | 3/6 |
| 2 | W0:LD, W1:LD, idle, idle, W0:ADD, W0:STORE, W1:ADD, W1:STORE | 8 | 6/8 |
| 4 | Four loads, then the four ADD/STORE pairs | 12 | 12/12 |

<!-- VISUAL warpschedule -->

Four warps finish four units of work in 12 cycles; one warp finishes one in six. More work was done, so compare throughput: 1/3 versus 1/6 units per cycle. The load latency remains four cycles. Scheduling another resident warp does not require an OS-style save and restore of all registers to memory.

This does not predict the speed of a real kernel. Real schedulers have partitions, multiple instruction pipelines, issue restrictions, variable latencies, and finite memory queues/bandwidth. More independent instructions within a warp can also help. Enough ready work can cover latency, but cannot make a saturated memory channel transfer unlimited bytes.

### Divergence: the group does less useful work per instruction

When threads within a group take different control-flow paths, the machine must preserve each thread's semantics. An active mask identifies participating lanes for a particular issued operation. Some control flow executes paths with different masks; a compiler may instead use predicated instructions for short branches. Either way, count useful participating operations and actual instructions, not just source-code lines.

Our eight-position illustration starts with value lane+1. The true path adds 10, then multiplies by 2. The false path subtracts 1, multiplies by 3, then adds 5. The model issues the true path first for its lanes, then the false path for its lanes; it skips a path with no participants. Branch and reconvergence overhead are excluded. Eight is chosen for legibility, not as a CUDA warp width.

With four true and four false lanes, five arithmetic group instructions provide 40 lane-instruction positions. Only 4×2 + 4×3 = 20 are useful, or 50%. With all eight lanes true, only two group instructions are needed and all 16 positions are useful. With one true lane, the whole true path still has to execute in this model.

<!-- VISUAL divergence -->

A branch that is uniform within each warp need not have this mixed-path penalty even if different warps choose different paths. Reordering data can sometimes make groups more uniform, but partitioning work costs time and can worsen memory access. Measure the complete change.

Do not use a drawing of a shared program counter as a synchronization proof. NVIDIA's [advanced kernel programming guide](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html) describes independent thread scheduling on Volta and later architectures. Threads in a warp are not guaranteed to remain implicitly synchronized for communication; use the appropriate documented synchronization primitives and participation masks.

### Predict before continuing

88. On the teaching SM, calculate potential occupancy for T = 64, R = 64, S = 4. Name the limiting resource. What changes if R = 32 and S = 8?
89. Why might reducing a kernel's register count raise occupancy and still increase elapsed time?
90. In the scheduler model, when can a load issued in cycle 2 first feed ADD? How many cycles and filled issue slots are needed for two warps?
91. For the eight-position branch model, calculate useful lane-instruction utilization when exactly one lane takes the two-instruction true path and seven take the three-instruction false path.
92. A profiler reports high occupancy but few eligible warps and low issue activity. Is adding more nominal arithmetic units a demonstrated fix? What evidence would you inspect next?

**Checkpoint:** explain separately whether work fits, whether it is ready, whether it issues, and how many participating lanes do useful work.

## Lesson 22 — Make the memory traffic explicit

### Name the storage and the boundary

Arithmetic needs operands. Thirty-two threads can generate 32 addresses with one load instruction, so layout across threads matters as much as one thread's instruction count. **Coalescing** combines a group's memory requests into transfers covering the requested addresses. It does not make arbitrary scattered words adjacent.

| Storage | Ownership / visibility in our baseline | Main consequence |
|---|---|---|
| Registers | Private values for each thread | Fast working state consumes resident capacity |
| Shared memory / AMD LDS | Cooperating block/workgroup | Explicitly managed on-chip scratchpad; requires coordination |
| CUDA local memory | Thread-private addressable storage | May hold spills or addressable local arrays; backed by device memory and potentially cached |
| Global memory | Accessible across the grid | Large address space; accesses travel through a hierarchy |
| Hardware caches | Managed by hardware | Reuse can reduce traffic at later boundaries; cache contents are not explicit scratchpad ownership |

CUDA **local** names a thread-private address space. It does not mean the block-shared on-chip scratchpad. Similarly, accessing a global address does not prove a DRAM access on every load. A hit can be served earlier in the hierarchy. The [CUDA memory-space reference](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#gpu-device-memory-spaces) describes these distinctions.

### Count sectors for one load instruction

Specify one warp with 32 participating threads, each loading one aligned 4-byte word. Lane l requests byte address `base + 4 × stride × l`. Our coalescer counts distinct aligned 32-byte sectors touched by that instruction. All requested data is initially absent at the boundary being modeled; ignore later cache reuse, compression, ECC, and write policies. Base offsets are relative to a 32-byte-aligned region.

| Word stride | Base offset | Useful bytes | Distinct sectors | Sector bytes | Useful fraction |
|---|---:|---:|---:|---:|---:|
| 1 | 0 B | 128 | 4 | 128 | 100% |
| 1 | 4 B | 128 | 5 | 160 | 80% |
| 2 | 0 B | 128 | 8 | 256 | 50% |
| 8 | 0 B | 128 | 32 | 1,024 | 12.5% |

<!-- VISUAL coalescing -->

NVIDIA's [coalescing documentation](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/#coalesced-access-to-global-memory) describes the 32-byte transaction model for devices of compute capability 6.0 and later. Here we make it an explicit per-instruction counting exercise. The count does not claim that each sector becomes a separate DRAM command. Neighboring warps can reuse fetched data, requests can be combined downstream, and cache boundaries change the byte count.

The lane-to-address order can be permuted without changing the set of sectors. Coalescing depends on the addresses needed together, not on lane 0 always requesting the smallest address. A structure-of-arrays layout often makes the same field across objects contiguous; an array-of-structures layout may space those fields apart. The right layout depends on which fields the workload uses together.

### Shared memory has banks, too

On-chip storage still has finite ports. A **bank** is one independently accessible part of a memory. For a transparent example, use eight banks with 4-byte words and eight requesting lanes. Bank = word_address modulo 8. Each bank serves one distinct word per service round. Reads of the same word broadcast within this model; simultaneous writes to the same word are not defined by this read example.

If lane l reads word l, all eight requests use different banks and need one round. Reading word 2l uses banks 0,2,4,6 twice each and needs two rounds. Reading word 8l uses eight distinct words in bank 0 and needs eight rounds. If every lane reads word 0, one word is broadcast and one round suffices.

<!-- VISUAL banks -->

A column read from an 8×8 row-major shared tile has word stride eight. Padding the row pitch to nine changes the column's bank mapping to l modulo 8. It still contains eight logical columns; the ninth word per row is padding. In this model that removes the conflict at the cost of more storage. Real bank counts, widths, broadcast behavior, and instruction decomposition need the architecture's rules; the visual does not assume all devices have eight banks.

### Traffic is a consequence of both code and allocation

A spill adds loads/stores for private values. An uncoalesced access may amplify bytes at one boundary. A cache hit may remove traffic from another boundary. Shared-memory staging can add on-chip instructions while reducing repeated global loads. These effects can coexist, so record the memory space, request width, active mask, and boundary for every traffic claim.

For vector addition, useful array bytes remain 12N: read two float values and write one. A wider machine has not reduced those bytes. Once bandwidth limits throughput, adding arithmetic units will have little effect unless the algorithm also changes reuse or data representation. Lesson 24 turns that observation into a bound.

### Predict before continuing

93. In the sector model, how many sectors and sector bytes are needed by 32 lanes at word stride two and aligned base? What is the useful fraction?
94. At stride one, what changes when the base is shifted by four bytes? Why might the observed DRAM traffic for a whole array differ from adding these per-warp sector counts?
95. In the eight-bank model, compare service rounds for word addresses l, 8l, 9l, and the constant 0. Which case uses broadcast?
96. Why can a CUDA local-memory load be much more costly than a register read? Does thread-private visibility make its physical storage on-chip?
97. Two address patterns touch exactly the same sectors in a different lane order. Must their sector counts differ? What other factors could still make whole kernels run differently?

**Checkpoint:** compute useful bytes, sector bytes, and bank conflicts under stated rules, then identify which conclusions stop at that model's boundary.

## Lesson 23 — Reuse a tile, then coordinate its lifetime

### The limitation we are solving

In matrix multiplication C = A×B, output C[r,c] is the sum over k of A[r,k]×B[k,c]. Neighboring outputs reuse inputs: outputs in the same row use the same A values, and outputs in the same column use the same B values. Independently loading every operand for every multiply ignores that structure.

A **tile** is a subregion we process together. Assign one block a T×T output tile. Load a T×T piece of A and a T×T piece of B into shared memory, use them for the next T values of k, then replace them with the next pieces. Each thread keeps its running output sum in private registers. We will use ordinary multiply-add arithmetic; matrix instructions are introduced in the next unit.

### A complete small calculation

Use A with two rows and four columns, B with four rows and two columns, and a 2×2 output tile. Four threads own the four outputs, with thread coordinates (row, column). Each reduction tile has width two.

```text
A = [ 1  2  3  4 ]       B = [ 1  2 ]
    [ 5  6  7  8 ]           [ 3  4 ]
                             [ 5  6 ]
                             [ 7  8 ]
```

At the first load phase, thread (r,c) loads A[r,c] into shared As[r,c] and B[r,c] into shared Bs[r,c]. Four threads load eight words total. Thread (0,0) owns C[0,0] but needs both the A and B values loaded by its neighbors. Its sum becomes 1×1 + 2×3 = 7. The whole partial output is [[7,10],[23,34]].

At the second phase, the same storage holds A[:,2:4] and B[2:4,:]. Thread (0,0) adds 3×5 + 4×7 = 43, reaching 50. The final output is **[[50,60],[114,140]]**. Do not confuse the output's two dimensions with the length-four reduction dimension.

<!-- VISUAL gputile -->

The visual shows conceptual phases, not hardware cycles or a guarantee that all threads execute each phase simultaneously. The first barrier establishes that all tile loads are ready before consumption. The second establishes that all consumers are finished before any thread overwrites the scratchpad for the next tile. Registers retain each partial sum across phases; the output array is written only at the end.

### Why two synchronization points?

Without the first barrier, a fast thread can read an As or Bs entry that a neighbor has not initialized yet. Without the second, a fast thread can start loading the next tile into a slot while a slower thread still reads that slot for the current tile. These are different hazards: publication before use and reuse after consumption.

For a conventional block-wide implementation, every participating thread must reach the corresponding barriers consistently. At an edge tile, mask invalid loads and write zero into the scratchpad, then let the whole block reach the barriers. Guard only the final out-of-range output store. An early return by some threads before a required block barrier is not a safe general tail strategy.

This original CUDA kernel sketch handles square row-major matrices of dimension n, assuming n > 0, valid disjoint device arrays, and a supported T×T block size. Launch ceil(n/T) blocks along each grid dimension and exactly (T,T) threads per block.

```cpp
template<int T>
__global__ void tiled_square(const float* A, const float* B,
                             float* C, size_t n) {
    __shared__ float As[T][T], Bs[T][T];
    const int x = threadIdx.x, y = threadIdx.y;
    const size_t row = size_t(blockIdx.y) * T + y;
    const size_t col = size_t(blockIdx.x) * T + x;
    float sum = 0.0f;
    for (size_t base = 0; base < n; base += T) {
        As[y][x] = (row < n && base + x < n)
                     ? A[row * n + base + x] : 0.0f;
        Bs[y][x] = (base + y < n && col < n)
                     ? B[(base + y) * n + col] : 0.0f;
        __syncthreads();
        for (int k = 0; k < T; ++k)
            sum += As[y][k] * Bs[k][x];
        __syncthreads();
    }
    if (row < n && col < n) C[row * n + col] = sum;
}
```

T = 2 is useful for hand tracing, while T = 16 is a conventional educational experiment. Bigger T in this one-thread-per-output implementation also means T² threads; do not choose a tile beyond the target's thread-block or resource limits. Production kernels often assign several outputs to one thread and use different tile shapes, layouts, and asynchronous pipelines. This sketch teaches dependencies rather than competitive library performance. See the [CUDA block synchronization reference](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html#thread-block-synchronization) for the primitive's contract.

### Count the reuse at a named boundary

For one T×T output tile with reduction length K divisible by T, this staged algorithm requests 2TK input words from global memory and writes T² output words. It performs T²K multiply-adds. Counting a floating-point multiply and add as two operations gives 2T²K FLOPs. With four-byte words:

```text
requested global bytes = 4 × (2TK + T²)
FLOPs                  = 2T²K
requested-byte intensity = TK / (4K + 2T)
```

This is logical traffic requested by the algorithm. It is a DRAM-byte estimate only under an extra assumption that these requests cross that boundary without inter-block cache reuse or transfer amplification. It excludes any input C read because this example overwrites C rather than computing αAB + βC.

In our small T = 2, K = 4 example, the four threads request 16 input words and store four output words: **80 bytes**. Independently requesting both operands for each of 16 multiply-adds would request 32 input words plus four outputs: **144 bytes**. The work stays 32 FLOPs. A cache or broadcast mechanism could reduce physical traffic even for the unstaged implementation, so 144/80 is not a guaranteed speedup.

A double-buffered implementation reserves two tile buffers and overlaps loading one with computing another. It must track when each buffer is ready and when it is safe to reuse. Async copies need their documented completion and synchronization operations; issuing a copy is not evidence that its destination can already be consumed. We introduce the lifetime problem here and leave vendor-specific pipelines to the case studies.

### Predict before continuing

98. In the 2×2 output example, what is the partial C after reduction indices 0 and 1? What is the final C after indices 2 and 3?
99. Identify one failure allowed by removing the barrier after loading, and a different failure allowed by removing the barrier before overwriting the tile.
100. Count input words, output words, and FLOPs for the small staged example. Compare requested bytes with independent operand requests and explain why the ratio is not a measured speedup.
101. For an edge tile, why should invalid input positions be filled with zero while the block still reaches both barriers? What should happen to invalid output stores?
102. A larger tile reduces repeated global requests but doubles shared-memory use and lowers residency. Is it necessarily faster? State the competing effects you would measure.

**Checkpoint:** track the owner and lifetime of every shared tile entry and private accumulator. Explain both barriers using a concrete producer/consumer hazard.

## Lesson 24 — Predict a limit, then measure the right interval

### From diagrams to a performance hypothesis

Let W be the number of floating-point operations and Q the bytes moved across a specified memory boundary. **Arithmetic intensity** I = W/Q, measured in FLOPs per byte. Let P be the device's compute ceiling for that exact arithmetic type and execution path, and β its bandwidth ceiling at that same memory boundary.

A simple **Roofline** bound is:

```text
performance ≤ min(P, β × I)
execution time ≥ max(W / P, Q / β)
ridge intensity = P / β
```

Compute and memory work can overlap, which is why the lower bound uses a maximum rather than summing those two times. This does not claim perfect overlap is always achievable. Instruction dependencies, issue limits, cache behavior, synchronization, and insufficient parallel work can all make execution slower.

[Nsight Compute's Roofline guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/#roofline-charts) describes the compute and bandwidth ceilings and their connection to arithmetic intensity. Match the FLOP-count convention, precision, instruction path, and byte boundary before comparing measurements. A matrix-unit peak is not the appropriate ceiling for a scalar elementwise add kernel. A point below the sloped roof is not by itself proof that DRAM bandwidth is saturated.

### A numerical bound you can check by hand

Use a hypothetical device with P = 10 TFLOP/s for our selected arithmetic path and β = 200 GB/s. These are synthetic teaching parameters, not a claim about any product. Use decimal units: 1 GB = 10⁹ bytes and 1 TFLOP = 10¹² operations.

For one million float additions, W = 10⁶ FLOPs and useful array traffic Q = 12×10⁶ bytes. Assume those bytes cross DRAM exactly once, with no extra transfer traffic. Then I = 1/12 FLOP/B. The memory time is 60 μs and the compute time is 0.1 μs. The Roofline ceiling is about **16.7 GFLOP/s**, far below 10 TFLOP/s. Doubling compute capacity alone leaves this bound unchanged; doubling bandwidth halves the memory component.

The ridge is 10×10¹² / (200×10⁹) = **50 FLOPs/B**. Raising intensity can move a workload toward that ridge. It must come from doing useful reusable work or reducing traffic, not adding redundant arithmetic solely to inflate the numerator.

<!-- VISUAL roofline -->

The visual's matrix presets assume square 1024×1024 multiplication, 2n³ FLOPs, and tiled requested bytes `8n³/T + 4n²`. For the DRAM model we explicitly assume no reuse across output blocks, no transfer amplification, and enough work to approach device-wide limits. T = 64 represents a traffic tile, not a legal 64×64-thread launch of the earlier simple kernel. An implementation would need another thread-to-output mapping. The graph plots a **ceiling**, not a benchmark result.

An optional fixed overhead H illustrates a simple unoverlapped interval model: H + max(W/P,Q/β). It is not a universal formula for host launch costs, and it does not include transfers. At H = 10 μs the array model gives 70 μs; halving Q to 6 MB in some hypothetical valid algorithm would give 40 μs, not 35 μs. Fixed costs matter more as useful execution becomes short.

### Decide what “time” means

A host call may return after enqueuing work, before the GPU finishes. Timing only that call measures submission behavior. Choose an interval deliberately:

| Question | Include in the interval |
|---|---|
| How long does this kernel run with device-resident inputs? | Device work in a specified stream, excluding allocation and transfers |
| How long does a request take from input to usable output? | Required transfers, launches, computation, dependencies, and completion |
| How much work can a pipeline sustain? | A steady-state batch including intended overlap, divided by completed work |

A CUDA **stream** is an ordered sequence of operations. To measure a device interval, record a timing-enabled start event, the work, and a stop event in the same stream; wait for the stop before asking for elapsed time. The events timestamp stream progress. Other work can still compete for resources. NVIDIA's [asynchronous execution guide](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html) explains streams, events, and dependencies.

This sketch assumes arrays and events already exist, warm-up has completed, and there is no intentionally competing work. `check` is a placeholder for checking every CUDA return code; R repeats the same operation on unchanged inputs and overwrites c.

```cpp
check(cudaEventRecord(start, stream));
for (int repeat = 0; repeat < R; ++repeat) {
    add_arrays<<<blocks, threads, 0, stream>>>(a, b, c, n);
    check(cudaGetLastError());
}
check(cudaEventRecord(stop, stream));
check(cudaEventSynchronize(stop));
float milliseconds;
check(cudaEventElapsedTime(&milliseconds, start, stop));
// Report milliseconds / R, with R and the measurement scope.
```

A batch reduces timer-resolution problems but can also include GPU idle gaps if the host cannot enqueue fast enough. Repeating on the same data changes cache residency. Report that choice; do not call a warm-cache repeated result a cold-memory measurement. For end-to-end latency, use a host timer around the whole required sequence and wait for its completion before stopping it.

### A disciplined experiment without guessing the answer

First compare outputs against a reference, including non-multiple sizes and numerically justified tolerances. Then record GPU model, compiler, kernel configuration, precision, input shape, and whether inputs begin on the device. Warm up the runtime and kernel, collect repeated samples, and report a representative statistic plus variation. Keep cold and warm-cache experiments separate when that distinction matters.

Use profiling to test a specific hypothesis. If the claim is excessive sectors, inspect requests and transferred bytes at the relevant cache level. If the claim is waiting for operands, inspect eligible warps, issue activity, and dependency stalls. If the claim is reduced residency, inspect register/shared-memory allocation and achieved occupancy. If the claim is launch overhead, inspect a CPU/GPU timeline and the effect of batching. Profiler collection can replay work or perturb timing, so collect baseline timing separately.

Finally change one thing: layout, tile shape, block size, or data reuse. Predict the direction of the relevant metric before measuring. A faster result with a different metric than expected is still useful evidence, but it calls for a revised explanation.

### Predict before continuing

103. For one million float additions on the synthetic 10 TFLOP/s, 200 GB/s device, calculate intensity, the compute and memory times, and the Roofline throughput ceiling.
104. What is the ridge intensity? Which bound changes when only compute capacity doubles for the array-add workload?
105. Under H + max(W/P,Q/β), compare the original 12 MB case with a valid hypothetical 6 MB case at H = 10 μs. Why is the total speedup less than two?
106. Why is timing just the CPU kernel-launch call insufficient for kernel completion time? Describe an event-based measurement and one limitation of timing repeated work.
107. A kernel has 100% potential occupancy but is slow. Give two distinct bottleneck hypotheses and the measurements that would distinguish them, without assuming occupancy already identifies the answer.

**Checkpoint:** state the work, byte boundary, applicable ceiling, measurement interval, and uncertainty before explaining a speedup.

## Put the five lessons together

You launch N = 70 independent float additions in two blocks of 64 threads. Start by predicting thread indices and active lanes. Then assume each array begins on a 32-byte boundary and count sectors separately for each load and store instruction: two full warps contribute four sectors each; the six useful lanes of the tail contribute one. The remaining warp performs no guarded array access. That gives **nine sectors per array**, 27 across the two inputs and output, or 864 sector bytes for 840 useful bytes. This is a coalescer accounting exercise, not a guarantee of DRAM write traffic.

Next scale to one million elements. The same kernel may now offer enough work to hide some latency, yet its low arithmetic intensity makes bandwidth a plausible limiting resource. Occupancy alone does not establish that limit; measurement must show what is actually busy or waiting. Staging the two input arrays through shared memory adds work without inherent reuse if each element is used once, unlike the matrix tile.

Complete this one-page notebook entry before moving on:

| Prompt | Your explanation should include |
|---|---|
| Where does one output come from? | Logical index, guarded access, private result, global store |
| What can run concurrently? | Independent blocks/warps plus the actual residency limits |
| What could wait? | Dependencies, pipeline availability, memory, barriers |
| Which bytes travel? | Active addresses, sectors, reuse, and a named boundary |
| What does a tile change? | Reuse, shared storage, registers, synchronization |
| What would convince you it helped? | Correctness, a predicted metric change, and a scoped timing result |

The next unit adds matrix hardware and numerical formats, then follows data through heterogeneous systems, packages, and multiple accelerators. These lessons give you the vocabulary to ask what those new mechanisms actually improve.

All small models and worked traces here are original teaching constructions. Vendor-specific references were checked on 25 September 2026. Eight-lane groups, eight-bank memory, synthetic resource capacities, and timing ceilings are labeled assumptions; none is presented as a complete implementation of a shipping GPU.
