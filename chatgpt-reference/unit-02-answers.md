# Unit 2 — Worked answers

Lessons 5–7 · Version 1 · 25 September 2026

Use with [Unit 2: Registers, programs, and execution contexts](unit-02-programs-and-contexts.md). Questions continue from Unit 1, so this key begins at 15.

## Lesson 5

**15.** x5 = **7**, x28 = **12**, x29 = **10**, and the output word is still **0**. The instruction at 0x54 must first combine the intermediate results into x30 = 22. The `sw` at 0x58 then writes that value to the output word. Calculating a value in a register does not automatically update memory.

**16.** x0 remains **0**: an attempted register write does not change the hardwired-zero value. The second instruction puts **9** in x5, because it adds immediate 9 to x0's zero. This concerns the destination register; it is not a general rule that any instruction targeting x0 has no other effects.

**17.** The load starts at 0x100 + 4 = **0x104**, reading byte addresses **0x104, 0x105, 0x106, and 0x107**. Under the chosen little-endian arrangement, 05 00 00 00 represents **5**. The offset is in bytes, not in 32-bit words.

**18.** The Tiny-8 fragment has five data reads and two writes, totaling **7** accesses. The register listing has three reads and one write, totaling **4**. Neither count includes instruction fetches. Runtime also depends on instruction costs, access latency, clock period, caching, overlap, and other resources. These examples use different ISAs and widths. Access counts describe traffic at a named interface; they do not directly establish elapsed time.

**19.** Registers are finite. If values cannot be discarded or recomputed, some must be stored to memory and later loaded again. This is commonly called spilling and reloading. More registers can reduce this pressure, but the compiler's allocation choices and the program's live values determine the actual traffic.

## Lesson 6

**20.** The ALU-result latch contains the **address 0x104**. The value 5 is read during M and captured in the memory-data latch; x5 receives it during W. At the end of E, writeback has not happened.

**21.** The single-cycle machine takes 3 cycles for 3 instructions, so its average CPI is **1**, and time is **3 × 5 ns = 15 ns**. The multicycle machine takes 13 cycles for 3 instructions, so average CPI is **13/3 ≈ 4.33**, and time is **13 × 1 ns = 13 ns**. The multicycle machine is about 15/13 ≈ **1.15 times as fast** for this synthetic sequence, despite its larger CPI.

**22.** No. Three single-cycle loads take **3 × 5 ns = 15 ns**. Three multicycle loads take **15 × 1 ns = 15 ns**. The increased clock frequency is exactly offset by the increased cycles per instruction in this workload.

**23.** The mixed sequence takes **13 × 1.3 ns = 16.9 ns**. The single-cycle machine remains at **15 ns**, so it is faster under these changed assumptions. Compare times for the same workload rather than clock frequency alone.

**24.** No. A machine can visit all five phases for one instruction before starting the next. Pipelining requires overlap: for example, instruction B is being fetched while instruction A is being decoded. The names of stages do not establish that overlap.

## Lesson 7

**25.** ra is **0x8C**, sp is **0x1F0**, and the word at **0x1FC contains 0x48**. Twice must return to double_plus_one at 0x8C; double_plus_one must later return to main at 0x48. One register cannot simultaneously retain both addresses, so the older one is saved in memory.

**26.** a0 = **15**, PC = **0x48**, and sp = **0x200**. Releasing the frame has not erased memory; in this model, the saved word at 0x1FC still contains 0x48. Its bytes remain, but that frame is no longer allocated to the completed invocation.

**27.** It jumps to **0x8C**, the address left by the nested call. That re-enters double_plus_one's trailing instructions instead of returning to main. Restoring only sp does not restore ra. This is a control-flow error, not an arithmetic error in twice.

**28.** No. The handler can preserve the interrupted state, handle the event, and return to that thread's continuation. A scheduler decision to run another thread is an additional step. Handler entry and thread switching are separate concepts even when one leads to the other.

**29.** On returning to A, the live state is **PC = 0x44 and x5 = 8**. A executes its jump to 0x40 next, not another increment immediately. B's saved state is PC = 0x84 and x5 = 110. Keeping x5 without its corresponding PC would not preserve the computation correctly.

**30.** None of those conclusions follows. The threads have distinct execution continuations and stack allocations, and they may run at different times on the same core. Threads in one process normally share an address space. The separate stack pointers identify different working regions; they do not create a hardware access barrier between those regions.

## Transfer exercises

**A. Does using a0 for the result mean a0 is a special adder?** No. It is the agreed name of an ordinary architectural register. The ALU computes a value and a register write stores it. “Argument” and “result” describe the software convention.

**B. Could a processor implement `add` in two internal cycles and still implement the same ISA?** Yes, provided it respects the architectural contract. The instruction's latency is a microarchitectural choice. Other software-visible requirements still matter; a matching arithmetic answer alone is not a complete compatibility test.

**C. Must a context switch save a separate field literally named PC?** Not universally. A switch at a call boundary may use a saved return address to recover the continuation. An interrupted user instruction stream has different preservation needs. Ask how the continuation is represented at the actual boundary.

**D. What new problem appears when instructions overlap?** An instruction might try to read a register before an earlier instruction has written the value it needs. Hardware resources may also be demanded at the same time. These are two of the issues that the next unit's pipeline lessons will make explicit.

## Readiness check

Explain the 22-result register trace, the 15 ns versus 13 ns timing comparison, the two return addresses in the nested call, and the saved PC/x5 pairs in the thread example. If you can explain all four without treating a register, memory location, function, thread, and core as interchangeable, you have the foundation for pipelining.

Continue using the [learning path](learning-path.md) to see how the next unit builds on these ideas.

Continue with [Unit 3: Make one CPU core faster](unit-03-faster-core.md).
