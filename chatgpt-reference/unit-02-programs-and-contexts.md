# Unit 2 — Registers, programs, and execution contexts

Lessons 5–7 · Version 1 · 25 September 2026

Continue from [Unit 1](unit-01-foundations.md). This is Unit B in the [learning path](learning-path.md). Keep the [worked answers](unit-02-answers.md) closed until you have made your predictions.

**Outcome:** explain how a register machine holds several working values, why one instruction set admits different implementations, and how functions and threads preserve enough state to resume.

The first unit gave us one accumulator, a program counter, and a sequence of state changes. Here we keep that model visible while separating three things: the instruction contract, the hardware that implements it, and software conventions for using it.

The interactive examples run in this document. No assembler or additional software is required. They are deliberately small teaching models, not full RISC-V emulators. The instruction traces advance by completed instructions; the timing comparison is the only visual in this unit that models elapsed time.

## Lesson 5 — Keep more working values in registers

### The limitation of one accumulator

Suppose we want to calculate:

```text
y = (a + b) + (a + c)
a = 7, b = 5, c = 3
```

The intermediate results are 12 and 10; their sum is 22. Tiny-8 has only one accumulator, so calculating the second intermediate result overwrites the first unless we save it somewhere.

Give Tiny-8 these data locations: M[8] = a, M[9] = b, M[10] = c, M[11] = output, and M[12] = temporary storage. This straightforward program works:

```text
LOAD  8       ; ACC = a
ADD   9       ; ACC = a + b
STORE 12      ; save the first intermediate result
LOAD  8       ; ACC = a again
ADD  10      ; ACC = a + c
ADD  12      ; combine both intermediate results
STORE 11      ; write y
```

These seven instructions make **five data-memory reads and two data-memory writes**. Instruction fetches are a separate category. We omit HALT from this arithmetic fragment, and stop observing after the final STORE.

### Add a register file

A **register file** is a collection of registers addressed by register numbers. A common simple arrangement has two read ports and one write port: two operand values can feed an ALU, and one result can be written back. Those port counts describe a possible implementation, not a requirement for every processor.

The schematic instruction `ADD R3, R1, R2` can mean “read R1 and R2, add them, and write R3.” Unlike Tiny-8's ADD, both operands come from registers, and the destination is explicit. The instruction must now encode which registers it means.

More registers let intermediate values remain near the execution hardware. They also require storage, selection logic, wiring, and instruction bits. An unlimited, instantly accessible register file would not be free. Later we will encounter register pressure: when too many values need to remain live, some must be saved to memory.

### A concrete bridge: a small RV32I subset

We now move to a real instruction contract, RV32I. This changes more than the number of registers: its integer registers are 32 bits wide, its addresses name bytes, and its base instructions occupy four bytes. x0 always reads as zero; x1 through x31 hold writable values. Arithmetic results retain 32 bits. The facts in this short bridge follow the [RV32I base specification](https://docs.riscv.org/reference/isa/v20240411/unpriv/rv32.html).

We use these operations:

| Instruction | Meaning in these examples |
|---|---|
| `add rd, rs1, rs2` | Add the two source registers; write the destination register. |
| `addi rd, rs1, imm` | Add a constant encoded in the instruction to a register. |
| `lw rd, offset(base)` | Read a 32-bit word at the byte address base + offset. |
| `sw rs2, offset(base)` | Store a 32-bit register value at base + offset. |
| `beq rs1, rs2, label` | Branch to the label if the register values are equal. |

An **immediate** is a constant carried in an instruction, not an address whose contents should automatically be read. An **effective address** is the address calculated for a memory operation. For the small offsets here, address calculation is simply base + offset.

For example, with x8 = 0x100, `lw x5, 4(x8)` reads four bytes starting at 0x104 and assembles them into a word. It does not load the number 4, and it does not read address 0x100. Our examples use aligned words and little-endian memory: the lowest-addressed byte holds the least-significant eight bits. No compressed instructions, faults, or concurrent writers are modeled.

### Trace the expression with several working registers

Place a, b, c, and the output in consecutive words starting at 0x100. Initialize x8 = 0x100 and the other displayed writable registers to zero. The listing starts at byte address 0x40.

```text
0x40: lw  x5,   0(x8)    ; a
0x44: lw  x6,   4(x8)    ; b
0x48: lw  x7,   8(x8)    ; c
0x4C: add x28, x5, x6    ; a + b
0x50: add x29, x5, x7    ; a + c; x5 is still available
0x54: add x30, x28, x29  ; both intermediate results are available
0x58: sw  x30, 12(x8)    ; y
```

<!-- VISUAL regfile -->

The final values are x28 = 12, x29 = 10, x30 = 22, and the output word at 0x10C = 22. At this instruction boundary the next instruction address is 0x5C. Stopping the demonstration here is a viewer convention, not an invented RISC-V HALT instruction.

This version also has seven instructions, but only **three data reads and one data write**. The first input remains in x5, and both intermediate results remain in registers. Counting data accesses isolates one benefit of this example; it does not prove a particular speedup on a real CPU. The machines have different instruction encodings and widths, and later we will distinguish a load instruction from an actual DRAM transaction.

The compiler could also transform the arithmetic expression. We intentionally keep its structure fixed so that the storage difference is visible.

### Registers are not source-language variables

A variable might live in a register, in memory, or nowhere after optimization. One register can hold different variables at different times. The ISA describes the effects of instructions on architectural registers; the compiler chooses how to represent a program's values with those resources.

Notice also that a load/store design separates arithmetic from memory access. `add` combines register values; `lw` and `sw` transfer values between registers and addressed memory. This makes data movement explicit in the listing.

### Predict before continuing

15. In the seven-instruction register example, what are x5, x28, x29, and the output word immediately after the instruction at 0x50? Which operation is still needed to write the output?
16. What happens to x0 after `addi x0, x0, 9`? What does `addi x5, x0, 9` put in x5?
17. With x8 = 0x100, which four byte addresses does `lw x6, 4(x8)` read? If those bytes are 05, 00, 00, 00, what value reaches x6?
18. Compare data-memory accesses in the two expression listings. Why does a reduction from seven to four accesses not establish a 7/4 speedup?
19. Suppose an operation needs ten intermediate values alive at once, but only four registers are available for them. Why can having registers still leave memory traffic?

**Checkpoint:** trace where each input and intermediate result lives. Distinguish a register number, an immediate constant, a byte address, and the contents at that address.

## Lesson 6 — One contract, different hardware schedules

### What the ISA promises

An **instruction set architecture**, or ISA, specifies the software-visible rules: instructions, registers, and defined effects on execution state. A **microarchitecture** is an implementation of those rules using datapaths, control logic, and storage.

Two implementations can agree that a particular add changes x28 from 0 to 12, yet need different numbers of clock cycles to do it. Their internal temporary values can differ. At the architectural observation points they must obey the same contract, including applicable rules for exceptions and memory behavior—not just happen to compute the same final sum.

For our non-overlapping teaching machines, the clean comparison point is after an instruction finishes. We are not yet modeling exceptions or interactions with other cores. In later lessons, the definition of when results become architectural will become more important.

### A single-cycle implementation

Imagine completing each instruction in one clock cycle. A load requires a chain of work: fetch the instruction, decode it, read the base register, calculate the address, obtain memory data, and write the destination register.

The clock period must accommodate the longest supported path, not merely the shortest arithmetic operation. An add may finish its internal computation sooner, but in this fixed-clock design the next instruction still waits for the next boundary.

Assume separate instruction and data memory access paths and enough datapath hardware to support these operations in one cycle. A single memory port cannot simply perform two independent simultaneous accesses. “Single-cycle” is not permission to ignore resource conflicts.

### A multicycle implementation

Now reuse resources over several shorter cycles. Our second machine uses these phases:

| Phase | Work performed | State that can retain an intermediate value |
|---|---|---|
| F: fetch | Read the instruction. | Instruction register. |
| D: decode/read | Decode it and read source registers. | Operand latches A and B. |
| E: execute/address | Calculate an arithmetic result or effective address. | ALU-result latch. |
| M: memory | Read or write data memory, when required. | Memory-data latch for a load. |
| W: writeback | Write the destination register, when required. | Architectural register file. |

A **latch** here means internal storage holding a phase's output; the model does not depend on a particular latch or flip-flop circuit. These temporary values allow the next phase to continue after the original combinational output is gone.

We define `lw` to take F–D–E–M–W, `add` to take F–D–E–W, and `sw` to take F–D–E–M. Fetch and data access occur in different cycles, so a memory port can be reused. The address/arithmetic unit can also be reused across phases if its inputs and saved results are controlled appropriately.

For `lw x5, 4(x8)` with x8 = 0x100 and a word value 5 at 0x104, the useful internal milestones are: instruction fetched; base value 0x100 captured; address 0x104 captured; data value 5 captured; x5 receives 5. The address and the data are different intermediate values.

### Compare elapsed time, not cycle count alone

Use these **synthetic teaching timings**, including all modeled storage and control overhead:

- Single-cycle machine: 5 ns per cycle, one cycle per instruction.
- Multicycle machine: 1 ns per cycle; a load takes five cycles, an add four, and a store four.
- Both execute one instruction at a time. Memory completes in its allotted phase; there are no caches or extra wait cycles.

For one load, one add, and one store, the first machine takes 3 × 5 ns = **15 ns**. The second takes (5 + 4 + 4) × 1 ns = **13 ns**. More cycles, less elapsed time.

<!-- VISUAL timing -->

For three loads, both machines take 15 ns. For three adds, the multicycle model takes 12 ns while the single-cycle model still takes 15 ns. The advantage depends on the workload and implementation assumptions.

If the multicycle clock instead requires 1.3 ns, the mixed sequence takes 13 × 1.3 = 16.9 ns, making it slower than the 15 ns single-cycle model. Adding state and muxes has costs. There is no general rule that more phases make a processor faster.

### This is still not pipelining

In both models, the next instruction waits until the current one finishes. Multicycle execution divides one instruction's work across time. Pipelining, which comes next, overlaps work from different instructions.

Similarly, these phases are explanatory micro-operations, not a claim that each phase corresponds to one particular x86 micro-op or that every CPU has these five stages. Internal terminology and implementation vary.

### Predict before continuing

20. After the E phase of the load example, is the saved ALU result 0x104 or 5? Has x5 received the loaded value yet?
21. For one load, one add, and one store, calculate the average cycles per instruction and elapsed time for both teaching machines.
22. For three loads, does the five-times-higher multicycle clock frequency produce a fivefold speedup? Calculate both times.
23. If the multicycle period becomes 1.3 ns, how long does the mixed sequence take? Which teaching machine is faster now?
24. If a machine uses F–D–E–M–W internally, does that prove it is pipelined? What additional behavior would demonstrate pipelining?

**Checkpoint:** explain the same instruction as an architectural state change, an internal sequence of operations, and an elapsed-time cost. Keep those descriptions separate.

## Lesson 7 — Preserve enough state to resume

### A function call needs a way back

Suppose a program jumps from main to a helper function. An ordinary jump tells it where to go, but not where to return. A call must also retain a return location.

For the base RISC-V instructions used here, `jal ra, target` records the address following the call in ra and jumps to target. `jalr x0, 0(ra)` jumps through ra without retaining a new return address; the target's low bit is cleared. All targets here are aligned. `ret` is an assembler shorthand for that return operation. These are rules for control transfer, not hardware knowledge of a high-level function. See the [RV32I control-transfer instructions](https://docs.riscv.org/reference/isa/v20240411/unpriv/rv32.html).

Register aliases help humans read code. In the standard integer calling convention, ra names x1, sp names x2, and a0 names x10. Argument registers can carry inputs and results. Temporaries may be overwritten by a called function; callee-saved registers must be restored if the callee modifies them. The standard stack grows toward lower addresses and remains 16-byte aligned. These are software conventions layered on the ISA, documented in the [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/).

An **application binary interface**, or ABI, includes agreements that let separately compiled code cooperate. The ISA defines the register and instruction mechanisms; the calling convention defines how functions use them. ra is an ordinary integer register with an agreed role, not an unlimited hardware return-address stack.

### A nested call overwrites ra

Our example computes `double_plus_one(7)`. That function calls `twice`, then adds one. If double_plus_one leaves its own return address only in ra, the call to twice overwrites it.

We therefore save the outer return address in ordinary memory before making the nested call. A **stack frame** is an area reserved for one invocation's saved values and other needed storage. The stack pointer tracks the current allocation boundary by convention.

Initial conditions: PC = 0x40, sp = 0x200, ra = 0, a0 = 0. All addresses below are byte addresses. Each listed instruction occupies four bytes.

```text
main:
0x40: addi a0, x0, 7
0x44: jal  ra, double_plus_one
0x48: [end of this example; not an instruction]

double_plus_one:
0x80: addi sp, sp, -16       ; reserve a 16-byte frame
0x84: sw   ra, 12(sp)        ; save main's return location
0x88: jal  ra, twice         ; ra now becomes 0x8C
0x8C: addi a0, a0, 1
0x90: lw   ra, 12(sp)        ; restore the outer return location
0x94: addi sp, sp, 16        ; release this frame
0x98: jalr x0, 0(ra)

twice:
0xC0: add  a0, a0, a0
0xC4: jalr x0, 0(ra)
```

### Trace the nested return

The call at 0x44 puts **0x48** in ra. The frame allocation changes sp to **0x1F0**. The store writes ra to the word starting at 0x1FC, because 0x1F0 + 12 = 0x1FC.

The call at 0x88 then puts **0x8C** in ra. Twice doubles a0 to 14 and returns to 0x8C. Double_plus_one changes a0 to 15, reloads 0x48 into ra, restores sp to 0x200, and returns to main's next instruction location.

<!-- VISUAL callstack -->

Eleven instructions have executed. The result is 15, the final PC is 0x48, and the stack pointer is back at 0x200. The word at 0x1FC may still contain 0x48 after the frame is released. Releasing stack space changes the allocation boundary; it does not inherently erase the bytes.

We reserved 16 bytes although the saved return address uses four. The remainder is unused in this example, preserving the calling convention's stack alignment. A leaf function such as twice does not need its own frame here because it neither calls another function nor needs extra saved storage. Function calls do not universally imply a new stack allocation.

If we omitted both saving and restoring ra, the outer return at 0x98 would jump to 0x8C, not 0x48. That would re-enter the outer function's trailing instructions. Following the specified addresses makes the bug visible.

### Saving a function's values is not saving an interrupted thread

A caller knows the calling convention and can arrange to preserve live values before a call. An interrupt can arrive when an arbitrary instruction stream is running; that code did not just agree to let the handler overwrite its working registers.

A **synchronous exception** arises from the executing instruction, such as an invalid operation or a disallowed memory access. An **interrupt** reports an event asynchronous to that instruction stream, such as a timer or device event. A **trap** is a transfer to a handler for such an event. The exact vocabulary and entry sequence depend on the architecture.

Trap entry records architecture-defined control information and directs execution to a handler. Handler software must preserve the register state required for correct resumption. Privilege mechanisms control what that handler and ordinary application code may access. Do not assume hardware automatically copies every register to a stack.

A system call is an intentional request to privileged operating-system code; on RISC-V, ECALL is the relevant exception-generating instruction. Entering a handler does not by itself mean another software thread will run. The operating system may handle the event and return to the same thread, or its scheduler may choose different work.

### Program, process, thread, hardware context

| Term | What it contributes to our model |
|---|---|
| Program | Code and associated data definitions: a description of work. |
| Process | An operating-system container for resources and an address-space context. It can contain multiple threads. |
| Software thread | One sequence of execution, with its own continuation, register state, and normally a stack. |
| Hardware execution context | The architectural execution state currently provided by the processor for running an instruction stream. |
| Physical core | The hardware that executes instructions. It may provide one or, with hardware multithreading, multiple hardware contexts. |

Two threads in the same process normally share its address space. Having separate stacks does not make those stacks mutually inaccessible by hardware: a thread with a suitable valid pointer can access another thread's stack memory. Separate stack ownership is a software discipline.

The chapters on processes, CPU execution, and concurrency in [Operating Systems: Three Easy Pieces](https://pages.cs.wisc.edu/~remzi/OSTEP/) develop these distinctions. We will add address translation and memory protection in Lesson 11 and hardware multithreading in Lesson 18.

### Multiplex two software threads onto one hardware context

Imagine one physical core with one hardware context. Thread A counts upward by one, and thread B counts upward by ten. They share one process but have different stacks and code locations. Both use architectural register x5 as their counter.

```text
Thread A:                       Thread B:
0x40: addi x5, x5, 1            0x80: addi x5, x5, 10
0x44: jal  x0, 0x40             0x84: jal  x0, 0x80
```

Here the jump targets are shown as resolved addresses. In normal source assembly we would use labels. Initial saved states are A: PC = 0x40, x5 = 7, sp = 0x200; B: PC = 0x80, x5 = 100, sp = 0x300. The rest of the relevant state is assumed equal or unchanged and is omitted from the display.

To change which thread runs, the operating system preserves the current thread's continuation and needed registers, chooses a runnable thread, and restores its state. For this example, saving and restoring PC, x5, and sp is sufficient because those are the only differing or changing components.

<!-- VISUAL contexts -->

Execute one instruction of A: its live x5 becomes 8 and PC becomes 0x44. Switch to B: the same hardware register x5 now contains 100, and PC is 0x80. After one B instruction, x5 is 110 and PC is 0x84. Switch back to A: x5 returns to 8 and PC to 0x44, so A executes its jump next. Its pending instruction must not be skipped or replaced by B's continuation.

The switch control in the visual summarizes save/select/restore as one teaching action. A real switch executes operating-system instructions and has overhead. It may involve privilege transitions, an address-space change when moving between processes, and additional integer, floating-point, vector, or control state. It does not copy the entire process memory on each switch, and cache contents are not normally saved and restored as part of each thread's register record.

The exact save set depends on where the switch occurs. For example, xv6's [kernel switch routine](https://github.com/mit-pdos/xv6-riscv/blob/riscv/kernel/swtch.S) saves ra, sp, and callee-saved registers at a kernel call boundary; a separate trap path preserves interrupted user state. That routine alone is not a complete inventory of a user thread's state.

### Distinguish three transfers

| Event | Why execution moves | Does it necessarily change software thread? |
|---|---|---|
| Function call | Execute another routine and later return. | No. |
| System call or interrupt handler entry | Request a service or handle an event, possibly at a different privilege level. | No. |
| Thread context switch | Let a different software thread use a hardware execution context. | Yes. |

These events can occur together, but they are different mechanisms. In particular, “entered the kernel” is not synonymous with “switched threads.”

### Predict before continuing

25. After the call at 0x88 enters twice, what are ra, sp, and the saved word at 0x1FC? Why do we need two different return locations?
26. At the end of the nested-call example, what are a0, PC, and sp? Has releasing the frame necessarily erased its saved bytes?
27. If both the save and restore of ra are removed, where does the return at 0x98 jump? Why is that wrong?
28. Does every interrupt cause a thread context switch? Explain how the same thread can resume after a handler runs.
29. In the two-thread example, run one instruction of A, switch to B, run one instruction of B, and switch back. What are the live PC and x5, and what is A's next instruction?
30. Two threads share one process and have different stack pointers. Does that imply two cores, two protected address spaces, or two automatically isolated stacks? Explain what is actually distinct.

**Checkpoint:** draw a function return and a thread resumption as two different uses of saved state. Identify what lives in registers, what lives in memory, and what software convention gives the stored bits meaning.

## Put the three lessons together

A register file expands the set of working values available to instructions. An ISA defines the effects those instructions must have. A microarchitecture decides how to produce those effects. Calling conventions let pieces of software cooperate, and context preservation lets a machine resume interrupted or suspended work.

In the next unit, the processor will start work on another instruction before the first is finished. Before adding that overlap, you should be able to trace one instruction, one function call, and one software-thread switch without confusing their state.

Try this closing exercise: explain why a processor can execute the same program more quickly without changing its ISA, and why running several software threads does not by itself mean several instructions execute simultaneously.

Check the [worked answers](unit-02-answers.md), then revisit whichever trace you could not predict. Further reading is optional; the lessons above are self-contained.

Continue with [Unit 3: Make one CPU core faster](unit-03-faster-core.md).
