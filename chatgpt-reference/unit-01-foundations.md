# Unit 1 — Build the smallest useful computer

Four introductory lessons · Version 1 · 25 September 2026

Part of [From a tiny computer to modern CPUs and GPUs](learning-path.md). [Worked answers](unit-01-answers.md) are in a separate file.

**Outcome:** explain how bits, combinational circuits, state, and instructions combine into a programmable machine. Then trace a complete program without appealing to a mysterious “CPU does it” step.

You need basic arithmetic and a willingness to keep track of a few numbers. Code snippets are notation, not software you need to install. The small machine below is invented for this course; it is not an actual commercial CPU or an implementation of RISC-V.

## Lesson 1 — A bit is a state; its meaning is an agreement

### The problem

We want a physical machine to represent information reliably. A digital circuit treats ranges of electrical conditions as two logical values: 0 and 1. A bit is an abstract binary value. It is not a tiny printed digit inside the chip, and “1” does not always mean exactly one particular voltage on every chip.

With one bit we can distinguish two possibilities. With two bits we can distinguish four: 00, 01, 10, 11. With n bits there are 2^n possible patterns.

In ordinary decimal notation, each position has a weight: 1, 10, 100, and so on. In binary the weights are 1, 2, 4, 8, and so on. Thus:

```text
binary:       1 0 1 1
weights:      8 4 2 1
unsigned value = 8 + 0 + 2 + 1 = 11
```

Eight bits form a byte. An 8-bit unsigned integer can represent 0 through 255. Hexadecimal is just a compact way of writing bit patterns: each hexadecimal digit represents four bits. For example, binary 0001 1000 is hexadecimal 0x18, which is decimal 24.

### Representation is not meaning

The pattern 11111111 can represent unsigned 255 or signed −1 under 8-bit two's-complement interpretation. It might instead be eight flags, part of a character encoding, or an instruction. Context and operations determine the interpretation.

For an 8-bit two's-complement integer, the high bit has weight −128 and the remaining bits have weights 64 through 1. Thus 11111111 means −128 + 127 = −1. We will use unsigned values first and return to signed arithmetic later.

Our teaching machine retains only the low eight bits of an arithmetic result. Adding 250 and 10 therefore produces 4: 260 modulo 256 is 4. A real architecture must define its arithmetic behavior; a programming language can add different rules on top. Do not assume every language's overflow behaves like our toy machine.

### An address is not the stored value

Think of memory as indexed storage. The address selects a location; the contents are the bits stored there.

```text
address    contents
   8           7
   9           5
  10           0
```

We write M[8] = 7 to mean “the memory location at address 8 contains 7.” It does not mean that 8 and 7 are interchangeable. If an instruction says to read address 8, the value it retrieves here is 7.

We must also specify the size of an addressable unit. Our toy machine has 16 locations, each holding one 8-bit word. Modern mainstream CPU instruction sets usually use byte addresses. A machine's register width, address width, instruction width, and memory capacity are separate design choices.

### Predict before continuing

1. Interpret 00001101 as an unsigned value. How many distinct patterns can a 5-bit register hold?
2. In our 8-bit arithmetic, what is 255 + 2? Why is this not ordinary unbounded integer arithmetic?
3. If M[8] = 7 and M[7] = 99, what value does a direct read of address 8 return?

**Checkpoint:** explain the difference between a bit pattern, its interpretation, an address, and the contents at that address.

## Lesson 2 — A circuit can calculate without remembering

### The problem

Representing values is useful only if we can transform them. A combinational circuit computes outputs from its current inputs after a physical propagation delay. Its logical output does not depend on a stored history.

Three elementary operations are enough to begin:

| A | B | A AND B | A OR B | A XOR B |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 | 1 |
| 1 | 0 | 0 | 1 | 1 |
| 1 | 1 | 1 | 1 | 0 |

NOT reverses one bit. AND produces 1 only when both inputs are 1. OR produces 1 when at least one input is 1. XOR produces 1 when exactly one input is 1.

A **multiplexer**, usually shortened to mux, selects one input according to a control value. For a two-input mux, S = 0 selects A and S = 1 selects B. Selection is fundamental: the same hardware path can receive a value from different sources at different times.

### Build addition from small pieces

A full adder takes A, B, and a carry-in bit. It produces a sum bit and a carry-out bit:

```text
sum       = A XOR B XOR carry-in
carry-out = (A AND B) OR (A AND carry-in) OR (B AND carry-in)
```

For A = 1, B = 1, carry-in = 0, the sum bit is 0 and the carry-out is 1. That is binary 10, representing decimal 2. Connect several full adders so that each carry-out supplies the next position's carry-in, and you obtain a simple multi-bit adder.

For example, add 0111 and 0101, starting at the rightmost bit:

| Bit weight | A | B | Carry in | Sum | Carry out |
|---|---|---|---|---|---|
| 1 | 1 | 1 | 0 | 0 | 1 |
| 2 | 1 | 0 | 1 | 0 | 1 |
| 4 | 1 | 1 | 1 | 1 | 1 |
| 8 | 0 | 0 | 1 | 1 | 0 |

Read the sum from the highest weight downward: 1100, or 12.

An **arithmetic logic unit**, or ALU, combines operations such as addition, subtraction, AND, and OR with a way to choose the result. A simplified picture is:

```text
input A ──┬── adder ──┐
          ├── AND ────┤
input B ──┴── other ──┤── selected result
                      ↑
                 operation control
```

The diagram is a functional sketch: both inputs feed the relevant operations, and control selects the required output. Physical implementations may share internal circuits instead of building a separate complete circuit for every operation.

### What we still cannot do

If you remove or change the inputs, the output changes after propagation. The adder has not saved its previous answer. It is a calculator circuit, not yet a machine that can execute a sequence.

This distinction survives all the way to a GPU: arithmetic resources transform values, while registers and other memories hold the values and execution state around them.

### Predict before continuing

4. A mux has A = 7 and B = 12. What does it output for S = 0? What about S = 1?
5. What are the sum and carry-out for a full adder with A = 1, B = 1, carry-in = 1?
6. Why does building a faster adder not, by itself, give us a programmable computer?

**Checkpoint:** identify what computes, what selects, and what must eventually remember.

## Lesson 3 — State turns calculation into a sequence

### The problem

We need the result of one calculation to become an input to the next calculation. A **register** stores a fixed number of bits. In our simplified synchronous model, it captures its input at a rising clock edge if its write enable is set; otherwise, it keeps its old value.

Between edges, combinational logic calculates possible next values. At the next edge, enabled registers capture those values.

```text
current register value → combinational logic → next register value
          ↑                                       │
          └────────── capture at clock edge ────────┘
```

A clock does not make every circuit operation instantaneous. The clock period must leave time for the chosen logic path to settle and for storage timing requirements to be met. Later, pipelining will let us break a long path into shorter stages, at the cost of more state and coordination.

### A subtle but essential example

Suppose A = 3 and B = 9. At the same clock edge, two enabled registers perform:

```text
A_next = B_current
B_next = A_current
```

After the edge, A = 9 and B = 3. Both read old values. These assignments describe simultaneous hardware updates, not two sequential lines in an ordinary imperative program.

Now give one register an adder and a constant input of 1:

```text
R_next = (R_current + 1) modulo 256
```

If R starts at 0 and its write enable remains on, it becomes 1, 2, 3, and so on at successive edges. This is an 8-bit counter. If its enable is off, it holds its value despite the clock continuing to tick.

### Registers and memory

Both hold state. “Register” usually refers to a small, directly used storage element or a member of a register file. A memory array has many locations selected by an address. We will care about their capacity, number of access ports, latency, bandwidth, and energy—not only their names.

A processor's **datapath** moves and transforms values. Its **control logic** chooses operations, input sources, destinations, and write enables. We now have ingredients for both.

### Predict before continuing

7. A = 3 and B = 9. At one edge, A_next = A_current + B_current and B_next = A_current. What are the new values?
8. A register contains 12. Its adder output is 13, but its write enable is off. What happens at the next clock edge?
9. Why can we not always double a circuit's clock frequency and expect correct results?

**Checkpoint:** describe a machine as current state, combinational next-state logic, and a rule for when state changes.

## Lesson 4 — Let stored instructions choose the next state

### The problem

Our counter always performs the same operation. We want the same physical circuit to execute different sequences. We store instructions in memory and add state that tracks which instruction to execute next.

### Specify the machine before tracing it

Our toy machine is called **Tiny-8**. Its entire relevant specification fits here:

| Component | Meaning |
|---|---|
| M[0] through M[15] | Sixteen 8-bit memory words; instructions and data share this memory. |
| ACC | An 8-bit accumulator holding the main working value. |
| PC | A 4-bit program counter. During fetch it selects an instruction address. After fetch it already points to the sequential successor. |
| IR | An 8-bit instruction register holding the fetched instruction while it is decoded and executed. |
| Control phase | Fetch, decode, or execute. Only one instruction is in progress. |
| Halted | A flag that stops further instruction execution. |

An instruction is one byte. The high four bits specify the operation; the low four bits specify an address. Decimal address 10 is hexadecimal A. We use the following encodings:

| Assembly notation | Encoding | Effect during execute |
|---|---|---|
| LOAD a | 0x1a | ACC gets M[a]. |
| STORE a | 0x2a | M[a] gets ACC; ACC is unchanged. |
| ADD a | 0x3a | ACC gets (ACC + M[a]) modulo 256. |
| SUB a | 0x4a | ACC gets (ACC − M[a]) modulo 256. |
| JMP a | 0x5a | PC gets a. |
| JZ a | 0x6a | PC gets a if ACC is zero; otherwise PC is unchanged. |
| HALT | 0xF0 | Halted becomes true. |

Here “a” in an encoding is a placeholder for the low hexadecimal digit, not the literal digit A. For example, LOAD 8 is 0x18, and STORE 10 is 0x2A. Other encodings are outside this teaching specification. JZ tests ACC directly; we have not introduced a separate condition-code register. STORE may overwrite any memory word, including a program word; our examples keep code and data separate by address.

### The instruction cycle is not the clock cycle

We deliberately use three clock ticks per instruction. This is an educational timing model, not a claim about real memory latency.

1. **Fetch:** read M[PC] into IR; advance PC by one modulo 16. Both updates use the old PC.
2. **Decode:** interpret IR and select the operation. ACC and memory do not change. The controller advances its phase.
3. **Execute:** apply the instruction's effect, then prepare to fetch again unless halted.

We assume an ideal memory that makes the required value available within the appropriate phase. A real design may require extra registers, requests, responses, or wait cycles. In Lesson 6 we will vary the implementation while preserving the instruction behavior.

### Work a complete program

Goal: add the values at addresses 8 and 9 and write the answer to address 10. Start with ACC = 0, PC = 0, and not halted.

| Address | Stored byte | Interpretation for this program |
|---|---|---|
| 0 | 0x18 | LOAD 8 |
| 1 | 0x39 | ADD 9 |
| 2 | 0x2A | STORE 10 |
| 3 | 0xF0 | HALT |
| 8 | 0x07 | Input value 7 |
| 9 | 0x05 | Input value 5 |
| 10 | 0x00 | Output location, initially zero |

All other words start at zero and are not accessed in this program. The machine does not know the labels “input” or “output.” It only follows instruction effects on addressed words.

For the first instruction:

- Tick 1 reads M[0] = 0x18 into IR and sets PC to 1.
- Tick 2 decodes IR as LOAD 8. PC remains 1, and ACC remains 0.
- Tick 3 reads M[8] = 7 into ACC. The instruction is complete.

The same three phases repeat for the remaining instructions:

| After tick | Just-completed phase | PC | IR | ACC | M[10] | Halted |
|---|---|---|---|---|---|---|
| 0 | Initial state | 0 | — | 0 | 0 | No |
| 1 | Fetch LOAD 8 | 1 | 0x18 | 0 | 0 | No |
| 2 | Decode LOAD 8 | 1 | 0x18 | 0 | 0 | No |
| 3 | Execute LOAD 8 | 1 | 0x18 | 7 | 0 | No |
| 4 | Fetch ADD 9 | 2 | 0x39 | 7 | 0 | No |
| 5 | Decode ADD 9 | 2 | 0x39 | 7 | 0 | No |
| 6 | Execute ADD 9 | 2 | 0x39 | 12 | 0 | No |
| 7 | Fetch STORE 10 | 3 | 0x2A | 12 | 0 | No |
| 8 | Decode STORE 10 | 3 | 0x2A | 12 | 0 | No |
| 9 | Execute STORE 10 | 3 | 0x2A | 12 | 12 | No |
| 10 | Fetch HALT | 4 | 0xF0 | 12 | 12 | No |
| 11 | Decode HALT | 4 | 0xF0 | 12 | 12 | No |
| 12 | Execute HALT | 4 | 0xF0 | 12 | 12 | Yes |

Notice that completing ADD changes ACC, but not M[10]. Only STORE changes the output location. Also notice that the final PC is 4: fetching HALT already advanced it before HALT executed. These results follow from our specified conventions, not from a universal rule for all processors.

### Branches turn sequences into loops

Replace the program with this one, initialize M[8] = 3 and M[9] = 1, and reset ACC, PC, and Halted:

```text
0: LOAD 8
1: SUB  9
2: JZ   4
3: JMP  1
4: HALT
```

The accumulator visits 3, 2, 1, and 0. JZ exits when it observes zero. Until then, JMP directs the next fetch back to SUB. A branch does not move the program's instructions in memory; it changes which address the next fetch uses.

The operation sequence, not counting fetch/decode phases, is:

```text
LOAD → SUB → JZ → JMP → SUB → JZ → JMP → SUB → JZ → HALT
```

The machine's circuits have not changed. Only the initial memory contents changed. This is the core of programmability.

### Execution context, introduced precisely

At an instruction boundary in Tiny-8, a resumable computation needs its PC, ACC, Halted state, and access to the appropriate memory contents. If two computations share one physical machine, each needs its own saved context and a rule for sharing or preserving memory.

IR and the control phase are temporary implementation state. If we pause in the middle of an instruction, preserving only PC and ACC is insufficient for exact mid-instruction resumption. If we pause at a defined boundary, the implementation can restart fetching from the saved PC without preserving the old IR.

In a real operating system, switching a thread normally saves architectural register state and selects the relevant address-space context as needed; it does not copy all of the process's memory on every switch. Later lessons will distinguish software thread state, hardware thread state, and microarchitectural state such as cache contents.

### What this machine teaches, and what it leaves open

Tiny-8 has enough structure to explain state, instruction encoding, data movement, arithmetic, branches, and instruction sequencing. Its accumulator forces many intermediate values through one working register. That restriction motivates our next step: several general-purpose registers.

We have not yet modeled caches, virtual addresses, interrupts, privilege, speculation, concurrent instructions, or multiple threads. When we add them, our task is to show exactly which state and rules change.

### Predict before continuing

10. Immediately after tick 6 in the addition program, what are PC, ACC, and M[10]? Why has the output location not changed yet?
11. Keep the addition program but initialize M[8] = 250 and M[9] = 10. What does it store?
12. How many instructions does the countdown program execute, including HALT? How many clock ticks in our timing model?
13. Suppose you save only PC and ACC after tick 4 of the addition program. Why is that insufficient to resume at the exact next internal phase on another copy of the machine?
14. How many instruction-memory reads, data-memory reads, and data-memory writes does the four-instruction addition program perform? Count the accesses, not the ticks.

**Checkpoint:** without looking at the table, explain why the program needs both ACC and PC, why ADD and STORE are separate operations, and how JMP changes control flow.

## A first performance calculation

This paragraph previews later lessons; it does not introduce an optimization yet.

Our four-instruction addition program takes 12 ticks. At a hypothetical 100 MHz clock, a tick takes 10 nanoseconds, so its full execution takes 120 nanoseconds. At a hypothetical 200 MHz clock, it would take 60 nanoseconds **if the implementation could still meet its timing requirements**.

More generally:

```text
execution time = instruction count × average cycles per instruction × seconds per cycle
```

For this model, the factors are 4 × 3 × 10 ns. A later processor may overlap instructions, execute several operations in parallel, or wait for memory. That changes the average cycles per instruction and sometimes the clock period. Merely comparing clock frequency will not tell us which machine finishes a workload sooner.

## How to use the interactive trace in the conversation

The trace uses exactly the addition program specified above. Each forward step advances one of Tiny-8's modeled clock ticks. Read the current PC and predict what the next phase changes before stepping. Moving backward inspects an earlier recorded state; it is a teaching control, not an instruction the toy CPU supports.

First watch the fetches: PC advances while ACC stays still. Then watch execution: LOAD and ADD change ACC, STORE changes memory, and HALT stops execution. The separation between these events is the learning objective.

## Finish the unit

Answer the fourteen prediction questions, then check the [worked solutions](unit-01-answers.md). Rework any question whose answer you guessed without tracing the state.

Finally, explain the entire machine aloud using only these words as prompts: **bits, interpretation, address, mux, ALU, register, clock, memory, instruction, PC, control, context**. You are ready for Unit B when these form a connected explanation.

For an optional external construction exercise, use the logic, arithmetic, and memory projects on the official [Nand to Tetris course page](https://www.nand2tetris.org/course). The examples and Tiny-8 specification in this workbook are original teaching material; that course uses its own machine and conventions.

When you are ready, continue to [Unit 2: Registers, programs, and execution contexts](unit-02-programs-and-contexts.md).
