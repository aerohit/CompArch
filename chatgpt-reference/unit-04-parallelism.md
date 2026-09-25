# Unit 4 — Add parallelism

Lessons 16–19 · Version 1 · 25 September 2026

Continue from [Unit 3](unit-03-faster-core.md). This is Unit D in the [learning path](learning-path.md). Make your predictions before consulting the [worked answers](unit-04-answers.md).

**Outcome:** distinguish multiple cores, multiple hardware contexts, and multiple vector elements; explain how shared memory remains coherent and how software establishes the ordering it needs.

Unit 3 found independent instructions within one thread. This unit introduces additional instruction streams and data elements. More hardware can perform more useful work only if the algorithm exposes that work and communication does not consume the benefit.

The four explorations are explicit teaching models. A coherence step represents a completed transaction, a memory-order step represents an abstract event, an SMT step is a cycle, and a vector step completes one group of elements. None is a commercial processor simulator. The worked examples require no installation or extra hardware.

## Lesson 16 — Share memory across cores

### The limitation: one core has finite opportunities

A single core can extract only so much instruction-level parallelism from one stream. **Multicore** adds execution engines that can make progress independently. Each running hardware context needs its own architectural continuation and registers. Cores may share some cache levels, the interconnect, memory controllers, and DRAM bandwidth. “Shared memory” does not mean every access has the same latency or every cache is physically shared.

Software threads can split a task: one sums the first half of an array, another sums the second. They need an eventual combination step, and the work may be unbalanced. Merely creating threads does not establish independent work or distribute it well.

For a fixed workload with serial fraction s, ideal speedup on P equally fast cores is **1 / (s + (1 − s) / P)**. This is Amdahl's bound under perfect parallel scaling and zero additional overhead. With s = 0.1 and P = 4, speedup is 1 / 0.325 ≈ **3.08**; the limit as P grows is 10. Real synchronization, bandwidth limits, and imbalance can reduce it further. Changing the algorithm or workload can change s, so this is a model of the specified task, not a permanent law about an application.

### The new problem: private cached copies can disagree

Suppose cores A and B cache the same word x = 0. A writes 1. If B keeps reading its old copy forever, the caches cannot implement the intended shared-memory behavior.

**Cache coherence** coordinates copies and writes to each memory location. An invalidate-based protocol gives a writer exclusive write permission for a line by invalidating competing copies. It also ensures that a later read obtains the appropriate up-to-date data, which may be in another cache rather than DRAM.

Coherence state applies to a **cache line**, often larger than one variable. Coherence alone does not determine the allowed ordering of accesses to different locations; that is the next lesson's memory-consistency question.

### Trace a deliberately small MSI protocol

Use two cores, private write-back caches, and one 16-byte line containing aligned 32-bit words x and y. Both start at zero. Each transaction finishes before the next begins. There are no evictions, transient protocol states, store buffers, or concurrent requests in this particular visual.

| State | Meaning for this cache's line |
|---|---|
| I — Invalid | It has no usable copy. Stale bits, if physically present, may not be read as valid data. |
| S — Shared | A clean readable copy; another cache may also hold it. A store needs write permission first. |
| M — Modified | This cache has the sole valid copy and may write; the lower-level copy can be stale. |

The model uses MSI, not MESI: a read of a previously uncached line enters S even if it is the only copy. On a read of a line held M by the other core, that core supplies the current data and updates the lower-level copy, then both end S. On an ownership transfer to another writer, the current line is supplied directly; the lower-level copy is allowed to stay stale. This defines the teaching protocol's data movement explicitly.

```text
Transaction          A state   B state   Current x   Lower-level x
Initial                 I         I          0              0
A reads x               S         I          0              0
B reads x               S         S          0              0
A writes x = 1          M         I          1              0
B reads x               S         S          1              1
B writes x = 2          I         M          2              1
```

<!-- VISUAL coherence -->

The latest value need not already be in DRAM. The protocol locates the authoritative copy. A snooping design broadcasts or observes requests on a coherence fabric; a directory records ownership/sharers to direct requests. Real protocols add states, concurrency, acknowledgments, and failure/retry handling. The three-letter trace exposes the invariants without pretending to model that full machinery.

### False sharing: different words, the same ownership unit

Put x at 0x100 and y at 0x104 in the same 16-byte line. Let A repeatedly write only x and B write only y, alternating A, B, A, B. They do not share a variable, but each store needs ownership of the whole line. Starting empty, the trace has four write-permission requests and three invalidations of the other core's copy.

Move y to 0x110, the start of a separate line in this model. With enough cache capacity and no conflicts, each core acquires its own line once; later writes hit in M. There are two write-permission requests and no invalidations. These counts are completed abstract requests, not counts of every packet or bus cycle.

Padding or changing work partitioning can reduce **false sharing**, but may enlarge the footprint and harm locality. Use the actual machine's line size when reasoning about layout; 16 bytes is only our teaching choice. Cornell's [shared-memory lecture](https://www.cs.cornell.edu/courses/cs5220/2020fa/lec/2020-10-13-intro.html) discusses why even non-overlapping data updates can create coherence traffic.

### Predict before continuing

63. After A writes x = 1 in the main MSI trace, what are A's state, B's state, and the lower-level x value? Where is the current value?
64. When B subsequently reads x, what value does it receive and how do both states change under this model?
65. For four alternating writes to distinct words, how do write-permission requests and invalidations differ when the words share a line versus occupy separate lines?
66. With a 20% serial fraction and four ideal cores, what speedup does Amdahl's formula predict? What is the limit with arbitrarily many cores?
67. Why does coherence of x alone fail to establish the ordering a program needs between writes to x and a separate flag?

**Checkpoint:** trace who has read or write permission, where the current data resides, and why distinct variables can still contend.

## Lesson 17 — Define ordering and synchronize software

### The limitation: a coherent copy is not a complete ordering rule

A core can retire a store while it remains in a store buffer awaiting visibility to other cores. A later load of a different address may complete first when the memory model allows it. Other optimizations and compiler transformations also affect which observations are possible.

A **memory consistency model** constrains what values loads may observe across operations and threads. **Sequential consistency (SC)** is a useful baseline: there is one global interleaving of operations that preserves each thread's program order. We discuss SC here as an abstract property, not a claim that every default load and store on every CPU or programming language has it.

### Both cores can read zero without incoherent caches

Initially x = 0 and y = 0. Core A performs store x = 1, then load y into rA. Core B performs store y = 1, then load x into rB. Use an abstract machine with one FIFO store buffer per core. Stores enter the local buffer; a load can bypass its own buffered store to a different address. A store drains to shared coherent memory later. No speculative or compiler reordering is required for this example.

```text
1. A buffers x = 1
2. B buffers y = 1
3. A loads y → 0
4. B loads x → 0
5. A's store drains: x becomes 1
6. B's store drains: y becomes 1
```

Both reads return zero while each location's writes remain coherent. Under SC, that result is impossible: A's store must precede A's load, a zero read of y must precede B's store, B's store must precede B's load, and a zero read of x must precede A's store. This forms an impossible ordering cycle.

<!-- VISUAL ordering -->

The visual shows one witness per model, not every legal execution. SC can produce (rA, rB) = (0, 1), (1, 0), or (1, 1); the store-buffer model also permits (0, 0). The [RISC-V RVWMO specification](https://docs.riscv.org/reference/isa/v20260120/unpriv/rvwmo.html) is an example of an ISA that explicitly defines allowed memory ordering and synchronization. Do not infer another ISA's exact rules from this toy machine.

To express the example in C++, make x and y atomic and use relaxed stores/loads; then the surprising outcome is a defined possibility of that language model. Ordinary unsynchronized C++ integers would introduce a data race and undefined behavior, which is not a legitimate way to demonstrate hardware ordering.

### Publish data with a release/acquire relationship

Now a producer prepares a payload and announces readiness. A consumer must read the payload only after observing that announcement. This is a **one-shot** publication: ready starts false, exactly one producer writes data, and data is not modified again. Objects are initialized before threads start.

```cpp
#include <atomic>
int data = 0;
std::atomic<bool> ready{false};

// Producer thread:
data = 42;
ready.store(true, std::memory_order_release);

// Consumer thread:
while (!ready.load(std::memory_order_acquire)) {
    // Wait. A production program may use a blocking primitive.
}
int answer = data;  // 42, if the loop exits by reading that publication
```

The release store **synchronizes with** an acquire load that reads the value it published. The producer's earlier data write then happens before the consumer's later data read. This ordering makes the non-atomic payload access safe under the stated one-shot assumptions. An acquire load that still reads false does not establish that publication relationship. Acquire/release does not promise that the producer gets scheduled or that the consumer finishes waiting within a particular time.

Replacing both orders with relaxed would remove the required relationship for the ordinary data variable. This is a language correctness problem, not just a possibility of reading an old cached value. The [C++ draft's atomic-ordering section](https://eel.is/c++draft/atomics.order) specifies the release/acquire connection. A compiler maps it to the instructions and constraints appropriate for its target.

### Atomicity, exclusion, and barriers solve different problems

Two threads can lose an increment even when the individual loads and stores are atomic: both load counter = 0, both calculate 1, and both store 1. An atomic **read-modify-write**, such as `counter.fetch_add(1, std::memory_order_relaxed)`, keeps each increment indivisible. Two such increments produce 2, provided no other stores overwrite the counter and the result is read after both complete. Relaxed suffices for this isolated counting property; it does not publish unrelated data.

A **mutex** protects a critical section containing multiple operations. Lock/unlock also supply synchronization according to the language/library contract. Making every field individually atomic does not automatically preserve a multi-field invariant.

A **memory fence** constrains specified memory ordering; it is not a command to make other threads reach the same line of code. A **thread barrier** coordinates participants at a phase boundary and, under its defined contract, makes prior work available to the next phase. All required participants must arrive; a barrier inside a path only some participants execute can deadlock. Neither a longer sleep nor C++ `volatile` substitutes for synchronization.

These mechanisms introduce shared state and costs: atomic modification order, lock ownership, wait queues, barrier arrivals, coherence traffic, and waiting for the slowest participant. Choose them based on the relationship the algorithm needs, then measure contention.

### Predict before continuing

68. In the buffered-store trace, why can rA and rB both be zero? Have the caches necessarily violated coherence?
69. Give the ordering-cycle argument that rules out (0, 0) under sequential consistency.
70. In the one-shot publication example, which event makes reading ordinary data safe? Does an acquire load that reads false establish the same relationship?
71. Why can a load followed by a store lose an increment even if both are atomic? What changes when each thread uses atomic fetch_add?
72. Distinguish an atomic read-modify-write, a mutex, a memory fence, and a thread barrier. Does C++ volatile replace any of them for this publication example?

**Checkpoint:** identify the language-level synchronization relationship before discussing how caches and buffers implement it.

## Lesson 18 — Share one core across hardware threads

### The limitation: one stream leaves useful slots empty

A wide core may have idle execution opportunities because one thread's next operation depends on an unfinished value. Another thread might have ready work. **Hardware multithreading** keeps more than one architectural execution context resident so the core can choose among them without asking the OS to save and restore every register on each choice.

Coarse-grained multithreading changes the selected thread at relatively large events, such as a long stall. Fine-grained multithreading selects among threads frequently, often each cycle. **Simultaneous multithreading (SMT)** can issue instructions from multiple resident threads in the same cycle. These are implementation strategies, not additional programming-language thread types.

### Separate the contexts from the shared machinery

Each resident hardware thread needs a logically distinct PC, architectural registers, and relevant control/exception state. A modern implementation may represent register state with shared physical storage plus separate mappings and ownership, rather than literally duplicating every physical array. Queues, caches, predictors, execution ports, and bandwidth can be shared, partitioned, or replicated depending on the design.

The OS sees schedulable logical processors corresponding to supported hardware contexts. A software thread runs on one such context at a time. Two logical processors on one core are not two complete physical cores. Conversely, the OS can time-share many more software threads than there are resident hardware contexts, saving inactive contexts to memory as in Unit 2.

Intel's [Hyper-Threading documentation for a specific Core generation](https://edc.intel.com/content/www/us/en/design/products/platforms/details/raptor-lake-s/13th-generation-core-processors-datasheet-volume-1-of-2/006/intel-hyper-threading-technology/) illustrates separate architectural state with shared execution resources. It is an example of SMT, not a promise that every Intel core or every processor supports it.

### Two chains, one core

Use a core with two interchangeable ALU ports and two resident hardware contexts A and B. All arithmetic is queued, there are no cache misses, frontend or retirement limits, and context selection has no modeled overhead. An add takes one cycle; the next dependent add can start the following cycle. Each thread has four additions in a chain:

```text
Thread A: x5 starts at 0;   repeat four times: x5 = x5 + 1
Thread B: x5 starts at 100; repeat four times: x5 = x5 + 10
```

With **one selected thread per cycle**, alternate A and B. Each selected thread has only one ready add, so the other port stays idle. Eight operations take eight cycles. A finishes in cycle 7 and B in cycle 8.

With **SMT**, issue one add from A and one from B in each cycle. The two independent streams fill both ports. Both finish in four cycles, with A's x5 = 4 and B's x5 = 140. The same register name refers to distinct contexts throughout.

<!-- VISUAL smt -->

Now reduce available ALU issue capacity to **one** operation per cycle. Both policies need eight cycles for the same eight additions. SMT alternates fairly between the ready contexts in this model, but cannot create another ALU slot. The visualization counts execution-window operations, not a complete program's retired IPC.

### Throughput, fairness, and contention

SMT can improve aggregate throughput by using opportunities one thread would leave empty. It does not guarantee lower latency for either thread. A thread running alone might complete faster than when sharing bandwidth, queues, or caches. Two memory-bandwidth-limited threads may mostly compete rather than complement one another.

Hardware scheduling must avoid starving a context, and the OS scheduler must understand topology when placement matters. Resource sharing also affects timing isolation. Disabling or enabling SMT is not universally a performance win: the answer depends on workload, latency goals, memory pressure, and the specific implementation.

Our useful example deliberately has independent streams and unused capacity. A long-latency load could create another opportunity for thread switching, but a dependency shared by both threads or a saturated memory controller remains a bottleneck. The core's duplicated context is extra state; it is not duplicated compute capacity.

### Predict before continuing

73. With two ALU ports, how many cycles do the two four-add chains take under one-thread-per-cycle selection versus SMT? What are their final x5 values?
74. With one ALU issue opportunity per cycle, why do both modes need eight cycles? Which resource is limiting?
75. A system has four physical cores and two hardware contexts per core. How many logical processors does that expose under these assumptions, and why is this not eight complete cores?
76. Which state must remain logically distinct between resident hardware threads, and which resources may be shared? How does this differ from an OS context switch?
77. Can adding an SMT sibling increase total throughput while making the original thread slower? Give a resource-based explanation.

**Checkpoint:** draw two register contexts connected to one shared set of execution resources, then distinguish that drawing from two physical cores.

## Lesson 19 — Apply one operation to several data elements

### The limitation: repeated scalar instructions duplicate work

Consider `c[i] = a[i] + b[i]` for many independent elements. Scalar code describes two loads, an addition, and a store for each element, plus loop control. **SIMD**, single instruction multiple data, applies one operation to several elements under one instruction stream.

A vector register holds multiple elements. An element is a logical position in the operation; a physical execution lane is hardware that processes elements. The number of elements named by an instruction is not necessarily the number processed simultaneously. A wide instruction may execute over several beats on narrower hardware.

Fixed-width SIMD specifies a register width, such as an illustrative 128 bits holding four 32-bit integers. Scalable vector designs let code operate on a runtime-supported length. In either case, the register bits, element width, active length/mask, and physical throughput are distinct quantities.

### Handle a partial final group correctly

Use ten signed 32-bit integers, small enough to avoid overflow. Let a = [1, 2, …, 10] and b = [100, 101, …, 109]. The expected c is [101, 103, …, 119]. Our teaching machine has four logical elements per vector instruction and a masked load/store contract: inactive positions perform **no memory access** and do not write output. We display inactive register positions as a dash without promising any stored bit value.

```text
Group 1: indices 0 1 2 3     mask 1 1 1 1
Group 2: indices 4 5 6 7     mask 1 1 1 1
Group 3: indices 8 9 10 11   mask 1 1 0 0
```

Each group uses two vector loads, one vector add, and one vector store. Masking the last group prevents accesses beyond index 9. Executing a full unmasked load out of bounds and discarding its unwanted values later is not equivalent.

<!-- VISUAL vectors -->

Ten results require **three vector add instructions** at width four. They use 10 of 12 available element positions, or 83.3%. Width eight uses two groups, but only 10 of 16 positions, or 62.5%. Lower slot utilization does not prove worse runtime: fewer groups may still be faster depending on throughput, latency, masks, and memory behavior.

At the logical array boundary, the useful data traffic is two 4-byte inputs plus one 4-byte output per element: **12N bytes**, or 120 bytes for ten elements. SIMD does not by itself reduce these useful bytes. Cache-line traffic can differ because of allocation, writeback, residency, and unused bytes. Nor does the group visual model how many cycles each vector instruction takes.

### Vector length, masks, and loop structure

A length-agnostic loop repeatedly requests an active length for the remaining elements, processes that many, advances pointers, and subtracts the **returned** length. It does not assume the largest possible vector length or a fixed number of physical lanes. Conceptually:

```text
remaining = N
while remaining > 0:
    vl = choose_supported_length(remaining)
    process vl elements
    advance all array pointers by vl elements
    remaining -= vl
```

RISC-V's [V extension specification](https://docs.riscv.org/reference/isa/v20260120/unpriv/v-st-ext.html) defines vector registers, element widths, vector length, masks, and tail policies. Its permitted length-selection rules are more detailed than “always take the minimum.” The loop must use the returned vl. With LMUL = 1, VLEN = 128 bits, and 32-bit elements, VLMAX is four; grouping registers changes the maximum element count. These are ISA concepts, not a guarantee of four physical lanes or a one-cycle instruction.

### Independence and reductions

Elementwise addition has independent outputs if the arrays' overlap does not create cross-iteration dependencies. A loop such as `a[i] = a[i-1] + 1` depends on a previous iteration and cannot be naively converted into independent lane operations. A compiler may need alias information, runtime checks, or a different algorithm before vectorizing.

A reduction combines multiple elements into one result, such as a sum. It needs horizontal communication or partial sums, not just independent lane additions. For [1, 2, 3, 4], a tree can form (1 + 2) and (3 + 4), then combine 3 + 7. Real vector ISAs provide various reduction operations; their latency and exact semantics vary. Floating-point regrouping can change rounding, so mathematical associativity does not automatically authorize a bit-identical transformation.

Vectorization adds vector/mask state, wider data paths, register bandwidth, and power demand. It can shift the bottleneck from instruction supply to memory bandwidth. Structure-of-arrays layouts can help contiguous field access; gathers support irregular addresses but do not make scattered traffic free.

### Predict before continuing

78. For ten elements and width four, how many vector groups are needed, what is the final mask, and which outputs does the final group write?
79. Compare active-position utilization at widths four and eight for ten elements. Does the lower percentage necessarily mean longer runtime?
80. How many useful bytes cross the logical array boundary for ten 32-bit elementwise additions with two input arrays and one output? Why can physical memory traffic differ?
81. What is VLMAX for VLEN = 128 bits, SEW = 32 bits, and LMUL = 1? Does this determine the number of physical lanes or instruction latency?
82. Why is a reduction different from independent elementwise addition? Give one reason a compiler cannot safely vectorize every loop by simply packing adjacent iterations.

**Checkpoint:** distinguish a software thread, a hardware context, a vector element, and a physical execution lane. Use a mask or returned vector length to handle the tail safely.

## Put the four lessons together

Suppose two software threads add two length-10 array partitions on two different physical cores. Each core uses the four-element vector model. The outputs occupy disjoint memory regions. Each thread writes its own completion counter; the two counters initially sit in the same coherence line.

Predict the number of vector groups across both threads and the useful array traffic. Explain why updating distinct counters can still generate coherence traffic. Choose how a coordinator learns that the outputs are ready: for example, joining both threads or using a correctly specified publication protocol. Explain why coherent caches alone are insufficient as the programming-language proof.

Then imagine the two threads are placed on SMT siblings of one core. Their contexts remain distinct, but they now compete for that core's vector units, frontend, and cache bandwidth. The previous two-core performance estimate cannot simply carry over.

| Form of parallelism | What is independent? | What might remain shared or limiting? |
|---|---|---|
| Instruction-level parallelism | Operations within a thread | Dependencies, ports, frontend, queues |
| Multicore thread-level parallelism | Instruction streams on different cores | Memory bandwidth, shared caches, coherence, synchronization |
| Hardware multithreading / SMT | Resident instruction contexts | Execution ports, queues, caches, frontend capacity |
| SIMD/vector data-level parallelism | Element operations within an instruction | Vector throughput, masks, reductions, data supply |

A program can combine all four. None guarantees speedup merely by existing. Continue with [Unit 5: Understand GPUs](unit-05-gpus.md), which follows these distinctions into GPUs: logical threads, scheduling groups, execution resources, and the memory traffic that connects them.

The examples are original teaching constructions. References link to primary documentation and university course material checked on 25 September 2026. Timings, line sizes, and widths are labeled assumptions so that later hardware case studies can replace them with measured or documented parameters.
