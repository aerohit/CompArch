# Unit 6 — Worked answers

Lessons 25–28 · Version 1 · 25 September 2026

Use with [Unit 6: Connect the modern system](unit-06-modern-systems.md). Predict before revealing a solution. The numerical answers apply to the stated teaching models.

## Lesson 25

**108.** The k = 0 contribution is [[5,6],[15,18]]. Adding the initial C gives **[[15,6],[15,28]]**. The second contribution, [[14,16],[28,32]], gives **D = [[29,22],[43,60]]**. Each of four outputs receives two products and two additions to its starting accumulator: eight multiplications plus eight additions, **16 FLOPs**. The two conceptual steps do not establish two hardware cycles.

**109.** **FP16 has eight times finer spacing near one**: 2⁻¹⁰ versus 2⁻⁷. BF16 has the wider exponent range, using eight exponent bits instead of five. The byte count alone does not characterize either range or rounding. The spacing comparison is local to the same magnitude interval, not a universal absolute error bound.

**110.** Q = 7. At s = 0.5, 6.2/0.5 = 12.4 rounds to 12 and clips to code 7, reconstructing **3.5** with absolute error **2.7**. The value 0.3 rounds to code 1 and reconstructs **0.5**, error **0.2**. At s = 1, 6.2 becomes code 6 and reconstructs **6**, error **0.2**; 0.3 becomes code 0 and reconstructs **0**, error **0.3**. The larger scale removes this outlier's clipping but worsens the small value's resolution.

**111.** No. Once a nonzero input becomes zero, a wider accumulator has no information about the discarded value. It can reduce additional accumulation error. Separately, FP32 addition rounds: at 2²⁴ the next larger representable value is two units away, so adding one is a tie that rounds to 2²⁴ under ties-to-even. Different groupings can therefore produce different results. An input type and an output type do not fully specify every intermediate rounding rule.

**112.** Useful properties include the **operand and accumulator types**, **supported tile shapes/layouts**, **problem dimensions and tail utilization**, **sparsity requirements**, **data movement and arithmetic intensity**, and **conversion/launch costs**. A quoted peak also needs its operation-count convention. Twice the arithmetic ceiling helps only insofar as the workload can use that arithmetic capability and is limited by it.

## Lesson 26

**113.** None follows from the address alone. A shared naming scheme can identify allocations backed by different physical memories. Access permissions, cache-coherence support, migration behavior, and physical route need separate evidence. The same numeric pointer is not proof that a remote access has become local or free.

**114.** The missing dependency is **device completion before conflicting buffer reuse**. Submission can return while work remains queued. Coherence cannot make a device read the original bytes after the CPU has legitimately overwritten them too early. The program needs a lifetime/ownership rule tied to the relevant completion event, plus the platform's required visibility mechanism.

**115.** Serial time is 4×(2+3+1) = **24 ms**. Pipelined time is 6 + (4−1)×3 = **15 ms**. First result latency is **6 ms**; the steady interval is **3 ms**. In the ideal schedule, outputs complete at 6, 9, 12, and 15 ms. No chunk computes before its own input transfer finishes.

**116.** The fixed stage times and independent-capacity assumptions fail when simultaneous stages contend for one saturated interface. An asynchronous call establishes that submission can return before completion; it does not prove hardware concurrency or speedup. Check stream/event dependencies, buffer properties, engine capabilities, and a measured timeline with completion included.

**117.** The NPU route takes **2+4 = 6 ms**, while the stated GPU route takes **5 ms**. The GPU finishes one millisecond sooner in this serialized comparison. An energy comparison must include joules for the entire route: compute, transfer, conversion, and relevant system activity over the full completion interval. Kernel duration alone does not establish energy.

## Lesson 27

**118.** Per stack: 1,024×4×10⁹/8 = **512 GB/s**. Four stacks give **2,048 GB/s = 2.048 TB/s** raw aggregate and **64 GB** capacity. The pin rate was already specified in transferred bits per second; multiplying by two again double-counts transfers. The result is a ceiling, not a promised application byte rate.

**119.** Mean latency = 0.75×80 + 0.25×140 = **95 ns**. One million serialized misses take 95×10⁶ ns = **95 ms**. This excludes other work, translation effects, and queueing, as specified. Independent requests would require a different model.

**120.** The dependent chain allows only one useful request at a time, making latency dominant. Independent reads can create many requests in flight and approach a bandwidth or queue-capacity limit. Controllers, DRAM channels, a remote fabric link, cache interfaces, or request-tracking resources may limit the stream. Weighted per-read latency alone cannot determine that limit.

**121.** Moving the worker does **not automatically relocate all its existing physical pages**. A local first-fault allocation policy can make initialization placement matter, but explicit policies, fallback, zero-page behavior, and later migration affect the result. Coordinate worker placement and initialization, then inspect the actual page locations and traffic. Pinning the worker is only one part of the experiment.

**122.** Inspect the memory-controller locations, inter-die fabric, cache organization, coherence domains, address mapping, and OS topology exposure. Four physical dies can present different software organizations. A speedup additionally needs workload parallelism, usable execution capacity, bandwidth, and communication costs. Neither software topology nor performance follows from die count alone.

## Lesson 28

**123.** No. After reduce-scatter, each rank has only **one designated complete chunk**: R0 has chunk 1 = **2222**, R1 has chunk 2 = **3333**, R2 has chunk 3 = **4444**, and R3 has chunk 0 = **1111**. Other cells are partial or stale in this trace. Three all-gather rounds distribute the complete chunks so every rank obtains the whole vector.

**124.** Each rank sends 2×3/4×100 MB = **150 MB**. At 25 GB/s, transfer time is **6 ms**. Six rounds cost 6×5 μs = **30 μs = 0.03 ms**, giving **6.03 ms**. Each rank also receives 150 MB. The modeled simultaneous full-duplex transfers already account for receiving, so adding another identical transfer term would violate the model's assumptions.

**125.** At P = 4: compute **10 ms**, communication **6.03 ms**, total **16.03 ms**. Speedup = 40/16.03 ≈ **2.495×**; efficiency = speedup/4 ≈ **62.4%**. At P = 8: compute **5 ms**, transfer **7 ms**, round overhead **0.07 ms**, total **12.07 ms**. Speedup ≈ **3.314×** and efficiency ≈ **41.4%**. Compute divides ideally here, but communication does not disappear.

**126.** The model gave each logical edge its own 25 GB/s of concurrent capacity. Two edges sharing one physical bottleneck must share that capacity, so their transfers may queue or slow down. The exact cost depends on scheduling and other traffic. A direct DMA path can avoid an intermediate CPU buffer but still takes time; consumers and buffer reuse must await the required completion.

**127.** No. A transfer cannot consume the correct bucket before its producer has made the required bytes ready. An asynchronous launch can queue work behind that dependency, but cannot erase it. If earlier buckets are complete, their communication can overlap computation of later independent buckets, subject to resource contention. The final bucket's communication can remain on the critical path.

## Integrated case — Trace the full iteration

Start with the CPU's input format and physical node. An explicit transfer reads host memory, traverses a host-device path, and writes device memory. A managed-memory version may move or remotely access data instead; inspect its actual behavior. The GPU then requests operands through its memory hierarchy, stages tiles, and issues matrix work with specified numerical semantics. Low-precision input storage does not establish the accumulator type or the communication type.

Once local gradients are produced, a four-rank ring can reduce and distribute them. For a 100 MB contribution per rank under the lesson's links, the communication model gives 6.03 ms. If local compute takes 10 ms and communication follows it, this segment takes 16.03 ms. Host transfers, conversion, and output consumption are additional stages; do not silently call 16.03 ms the entire application time.

A final device-to-host transfer must complete before CPU consumption. Each intermediate allocation remains valid until all its consumers finish. Coherent access may change cache-maintenance needs but does not remove these lifetimes and dependencies. To improve the iteration, measure the largest exposed stage and test a specific hypothesis: fewer bytes, better locality, cheaper conversion, faster useful compute, or legal overlap. Check numerical quality after every precision or reduction-order change.

## Transfer exercises

1. **An awkward tile.** A 3×3 output is padded to one 4×4 matrix tile with the same K. Assuming all 16 outputs execute equally, what fraction of output arithmetic contributes to the original problem? Does that fraction alone predict elapsed time?
2. **A tie in quantization.** With the integer quantizer at s = 0.5 and sufficient code range, reconstruct 0.25 and 0.75 using nearest-even rounding.
3. **A different pipeline.** Eight chunks require 4 ms in, 2 ms compute, and 1 ms out on independent engines. Find serial time, first-result latency, ideal total time, and the steady interval.
4. **A larger collective.** Use four ranks, M = 400 MB, β = 25 GB/s, α = 5 μs, and 40 ms of fixed total compute. Find communication time and serialized iteration speedup. Explain why a higher arithmetic peak might have little impact.

### Transfer answers

1. **9/16 = 56.25%** of the output arithmetic is useful under this padding model. The runtime also includes memory, preparation, instruction throughput, and other costs. A tuned implementation might choose a different kernel or decomposition.
2. 0.25/0.5 = 0.5 ties between codes 0 and 1, so it rounds to even code **0**, reconstructing **0**. 0.75/0.5 = 1.5 ties between 1 and 2, so it rounds to even code **2**, reconstructing **1**. Ties-to-even is not always rounding away from zero.
3. Serial: 8×7 = **56 ms**. First result: **7 ms**. Steady interval: **4 ms**. Ideal total: 7+7×4 = **35 ms**. Transfer-in is now the slowest stage.
4. Each rank sends **600 MB**, taking **24 ms**, plus **0.03 ms** round overhead. Iteration time = 10 + 24.03 = **34.03 ms**; speedup = 40/34.03 ≈ **1.175×**. Even eliminating local arithmetic would leave the exposed 24.03 ms communication term in this model.

## Ready for architecture case studies?

You are ready when you can explain why a wider accumulator cannot restore rounded-away inputs; why one virtual address does not promise local memory; why pipelining preserves each chunk's dependencies; why NUMA latency depends on the access pattern; and why a collective can dominate otherwise ideal compute scaling.

For Unit 7, bring a blank architecture worksheet and a habit of labeling every number: measured or advertised, peak or sustained, precision and shape, single device or system, direction and boundary, software version and date. Unknown details should remain unknown until evidence supplies them.
