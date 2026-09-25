# Unit 1 — Worked answers

Use with the [foundations workbook](unit-01-foundations.md). Try each prediction before reading its answer.

## Lesson 1

**1.** 00001101 is 8 + 4 + 1 = **13**. Five bits have **32 distinct patterns**, representing 0–31 under unsigned interpretation. The number of possibilities and the maximum unsigned value differ by one because zero is a possibility.

**2.** 255 + 2 gives **1** in our machine. The mathematical result is 257, and 257 modulo 256 is 1. Only the low eight bits are retained. This is a property of the specified fixed-width arithmetic, not of mathematical integers in general.

**3.** A direct read of address 8 returns **7**. It does not automatically use that result as a second address. Retrieving 99 would require another access using address 7, or an instruction explicitly defined to perform indirect addressing.

## Lesson 2

**4.** S = 0 produces **7**; S = 1 produces **12**. A mux selects between inputs. It does not add them.

**5.** The three input bits sum to decimal 3, or binary 11. The **sum bit is 1 and carry-out is 1**.

**6.** A faster adder only transforms its current inputs more quickly. A programmable machine also needs stored state, encoded instructions, and control logic that chooses the successive transformations.

## Lesson 3

**7.** The new values are **A = 12 and B = 3**. Both next-state expressions use the old values. B does not read the newly calculated 12 in this simultaneous update model.

**8.** The register stays at **12**. The disabled write prevents it from capturing 13.

**9.** The next values may not settle before the capture edge. Propagation delay and register timing requirements impose limits. Faster clocking can therefore produce incorrect behavior; circuit design, voltage, and temperature affect those limits.

## Lesson 4

**10.** After tick 6, **PC = 2, ACC = 12, and M[10] = 0**. ADD has finished, but STORE has not executed. The instruction contract for ADD changes ACC only.

**11.** It stores **4**. LOAD sets ACC to 250, ADD produces (250 + 10) modulo 256 = 4, and STORE writes 4 to M[10].

**12.** It executes **10 instructions and takes 30 ticks**:

| Instruction number | Instruction address | Operation | ACC afterward | PC afterward |
|---|---|---|---|---|
| 1 | 0 | LOAD 8 | 3 | 1 |
| 2 | 1 | SUB 9 | 2 | 2 |
| 3 | 2 | JZ 4, not taken | 2 | 3 |
| 4 | 3 | JMP 1 | 2 | 1 |
| 5 | 1 | SUB 9 | 1 | 2 |
| 6 | 2 | JZ 4, not taken | 1 | 3 |
| 7 | 3 | JMP 1 | 1 | 1 |
| 8 | 1 | SUB 9 | 0 | 2 |
| 9 | 2 | JZ 4, taken | 0 | 4 |
| 10 | 4 | HALT | 0 | 5 |

Every instruction takes three ticks by definition, including both taken and untaken branches. Real branch costs will be introduced with an explicit pipeline model later.

**13.** Tick 4 has fetched ADD 9 into **IR = 0x39** and advanced **PC to 2**. Decode and execute are still pending. Saving PC and ACC alone loses which instruction is in progress and which phase comes next. Resuming with a new fetch from PC = 2 would skip ADD. Exact mid-instruction resumption requires the relevant internal state as well as access to memory; a different design could instead define recovery to an instruction boundary.

**14.** There are **four instruction reads**, **two data reads** (M[8] and M[9]), and **one data write** (M[10]). Total: seven memory accesses. Decode performs no memory access in our specified model. The same physical memory serves both kinds of read; the categories describe why an access occurred.

## Transfer exercises

Use these after the main questions. They test whether you can carry the ideas to a slightly changed situation.

**A. Can the addition program run twice without changing code?** Yes, if you restore PC = 0 and clear Halted. The first LOAD replaces ACC, so its initial value does not affect the final sum. The output location also need not be cleared because STORE overwrites it. Keep the input words unchanged if you want the same answer.

**B. If M[8] and M[9] are both zero, is the CPU doing no work?** No. It still fetches, decodes, and executes the four instructions. Data values and amount of work are different things for this program.

**C. If the countdown starts at zero, does it halt immediately?** No. It subtracts before checking. The first SUB produces 255 under modulo-256 arithmetic. It reaches zero after 256 subtractions. Counting one LOAD, 256 SUBs, 256 JZs, 255 JMPs, and one HALT gives **769 instructions, or 2,307 ticks**. Moving the zero check before the subtraction would change this behavior. Trace the specified program, not its intended name.

**D. Does our 4-bit PC imply a 4-bit ALU?** No. The PC needs to select 16 instruction locations. ACC and the main data ALU operate on 8-bit values. Different widths serve different purposes.

## Readiness check

You are ready to continue if you can trace both programs, explain simultaneous register updates, distinguish addresses from contents, and identify what must be preserved to resume work. Speed is not the criterion; explaining each change is.

If the machine trace is confusing, repeat Lesson 4 with inputs 2 and 3. If arithmetic encodings are confusing, return to Lesson 1. If the timing is confusing, draw a vertical line for each clock edge and write the old and new state on opposite sides.
