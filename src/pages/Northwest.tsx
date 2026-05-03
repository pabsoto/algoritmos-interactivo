import { useState, useEffect, useRef, useCallback } from "react";
import {
  Grid3x3, Play, SkipForward, RotateCcw, Shuffle,
  ChevronRight, CheckCircle2, Zap, Upload, Download,
  TrendingDown, TrendingUp, AlertTriangle, Info
} from "lucide-react";
import Navbar from "@/components/Navbar";
// ─── Strict Types ─────────────────────────────────────────────────────────────

interface Cell {
  row: number;
  col: number;
  cost: number;
  allocated: number;
  isEpsilon: boolean; // Degenerate artificial zero
}

interface UVSolution {
  u: (number | undefined)[];
  v: (number | undefined)[];
}

interface MarginalCost {
  row: number;
  col: number;
  value: number; // c_ij - u_i - v_j
}

interface LoopCell {
  row: number;
  col: number;
  sign: "+" | "-";
}

interface IterationResult {
  phase: "northwest" | "modi";
  iterationNumber: number;
  description: string;
  allocations: Cell[];
  uv: UVSolution | null;
  marginalCosts: MarginalCost[];
  enteringCell: { row: number; col: number } | null;
  leavingCell: { row: number; col: number } | null;
  loop: LoopCell[];
  theta: number | null;
  totalCost: number;
  isOptimal: boolean;
  degeneracyFixed: boolean;
}

interface SolveContext {
  costs: number[][];
  supply: number[];
  demand: number[];
  rows: number;
  cols: number;
  dummyRow: number | null;
  dummyCol: number | null;
  mode: "minimize" | "maximize";
  originalMaxValue: number | null; // For maximize conversion
}

// ─── Pure Algorithm Functions ─────────────────────────────────────────────────

/** Deep copy of Cell array — never mutates original */
const deepCopyCells = (cells: Cell[]): Cell[] =>
  cells.map((c) => ({ ...c }));

/** Compute total real cost (ignoring dummy rows/cols and epsilon cells) */
const computeTotalCost = (
  cells: Cell[],
  dummyRow: number | null,
  dummyCol: number | null
): number =>
  cells.reduce((sum, c) => {
    if (c.row === dummyRow || c.col === dummyCol) return sum;
    if (c.isEpsilon) return sum;
    return sum + c.allocated * c.cost;
  }, 0);

/**
 * Solve the UV multipliers for MODI.
 * Uses iterative propagation starting from u[0] = 0.
 */
const solveUV = (basis: Cell[], rows: number, cols: number): UVSolution => {
  const u: (number | undefined)[] = new Array(rows).fill(undefined);
  const v: (number | undefined)[] = new Array(cols).fill(undefined);
  u[0] = 0;

  let changed = true;
  let guard = 0;
  while (changed && guard < (rows + cols) * (rows + cols)) {
    changed = false;
    guard++;
    for (const cell of basis) {
      const { row: r, col: c, cost } = cell;
      if (u[r] !== undefined && v[c] === undefined) {
        v[c] = cost - u[r]!;
        changed = true;
      } else if (v[c] !== undefined && u[r] === undefined) {
        u[r] = cost - v[c]!;
        changed = true;
      }
    }
  }
  return { u, v };
};

/**
 * Compute marginal costs for all non-basic cells.
 * For minimize: delta = c_ij - u_i - v_j. Negative means improvable.
 * For maximize: we work on the negated cost matrix, so same logic applies.
 */
const computeMarginalCosts = (
  costs: number[][],
  basis: Cell[],
  uv: UVSolution,
  rows: number,
  cols: number
): MarginalCost[] => {
  const result: MarginalCost[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (basis.find((b) => b.row === r && b.col === c)) continue;
      if (uv.u[r] === undefined || uv.v[c] === undefined) continue;
      result.push({
        row: r,
        col: c,
        value: costs[r][c] - uv.u[r]! - uv.v[c]!,
      });
    }
  }
  return result;
};

/**
 * BFS-based closed loop finder — safe against stack overflow.
 * Returns ordered loop of cells (alternating row/col pivots), or null.
 */
const findClosedLoopBFS = (
  entering: { row: number; col: number },
  basicPositions: { row: number; col: number }[]
): { row: number; col: number }[] | null => {
  const allPoints = [entering, ...basicPositions];

  // Adjacency: two points are "row-adjacent" if same row, "col-adjacent" if same col.
  // We model the path as: alternate between row-move and col-move.
  // State: (currentPointIndex, lastMoveType, path)

  type State = {
    pos: { row: number; col: number };
    lastMove: "row" | "col";
    path: { row: number; col: number }[];
    visited: Set<string>;
  };

  const key = (p: { row: number; col: number }) => `${p.row},${p.col}`;

  // Try starting with a row move first, then col move
  for (const firstMove of ["row", "col"] as const) {
    const queue: State[] = [{
      pos: entering,
      lastMove: firstMove === "row" ? "col" : "row", // trick: first step will flip
      path: [entering],
      visited: new Set([key(entering)]),
    }];

    // Actually let's do it properly: BFS where we alternate move direction
    const queue2: State[] = [{
      pos: entering,
      lastMove: firstMove === "row" ? "col" : "row",
      path: [entering],
      visited: new Set([key(entering)]),
    }];

    while (queue2.length > 0) {
      const state = queue2.shift()!;
      const nextMove: "row" | "col" = state.lastMove === "row" ? "col" : "row";

      const neighbors = allPoints.filter((p) => {
        if (key(p) === key(state.pos)) return false;
        return nextMove === "row"
          ? p.row === state.pos.row
          : p.col === state.pos.col;
      });

      for (const next of neighbors) {
        // Closing the loop: must return to entering cell via the correct axis
        if (key(next) === key(entering) && state.path.length >= 4) {
          // Valid loop
          return state.path;
        }
        if (state.visited.has(key(next))) continue;
        const newVisited = new Set(state.visited);
        newVisited.add(key(next));
        queue2.push({
          pos: next,
          lastMove: nextMove,
          path: [...state.path, next],
          visited: newVisited,
        });
      }
    }
  }

  return null;
};

/**
 * Add epsilon (degenerate) cell to basis so that |basis| = m + n - 1.
 * Chooses cell that doesn't create a sub-loop in existing basis.
 */
const fixDegeneracy = (
  basis: Cell[],
  costs: number[][],
  rows: number,
  cols: number
): { newBasis: Cell[]; fixed: boolean } => {
  const needed = rows + cols - 1;
  if (basis.length >= needed) return { newBasis: basis, fixed: false };

  const newBasis = deepCopyCells(basis);
  // Try cells row by row; skip any that would create a loop with current basis
  for (let r = 0; r < rows && newBasis.length < needed; r++) {
    for (let c = 0; c < cols && newBasis.length < needed; c++) {
      if (newBasis.find((b) => b.row === r && b.col === c)) continue;
      // Check that adding this cell doesn't form a loop with existing basis
      const positions = newBasis.map((b) => ({ row: b.row, col: b.col }));
      const loop = findClosedLoopBFS({ row: r, col: c }, positions);
      if (!loop) {
        newBasis.push({ row: r, col: c, cost: costs[r][c], allocated: 0, isEpsilon: true });
      }
    }
  }
  return { newBasis, fixed: newBasis.length > basis.length };
};

/**
 * Northwest Corner Method → returns array of IterationResult (one per allocation step).
 */
const northwestCorner = (
  supply: number[],
  demand: number[],
  costs: number[][]
): { iterations: IterationResult[]; finalCells: Cell[] } => {
  const s = [...supply];
  const d = [...demand];
  const rows = s.length;
  const cols = d.length;
  const iterations: IterationResult[] = [];
  const currentCells: Cell[] = [];
  let i = 0;
  let j = 0;
  let stepNum = 1;

  while (i < rows && j < cols) {
    const allocated = Math.min(s[i], d[j]);
    const prevS = s[i];
    const prevD = d[j];

    s[i] -= allocated;
    d[j] -= allocated;

    const existingIdx = currentCells.findIndex((c) => c.row === i && c.col === j);
    if (existingIdx >= 0) {
      currentCells[existingIdx].allocated += allocated;
      currentCells[existingIdx].isEpsilon = false;
    } else {
      currentCells.push({ row: i, col: j, cost: costs[i][j], allocated, isEpsilon: false });
    }

    iterations.push({
      phase: "northwest",
      iterationNumber: stepNum++,
      description: `Asignar min(O${i + 1}=${prevS}, D${j + 1}=${prevD}) = ${allocated} → celda [O${i + 1}, D${j + 1}]`,
      allocations: deepCopyCells(currentCells),
      uv: null,
      marginalCosts: [],
      enteringCell: { row: i, col: j },
      leavingCell: null,
      loop: [],
      theta: null,
      totalCost: 0, // filled after
      isOptimal: false,
      degeneracyFixed: false,
    });

    if (s[i] === 0 && d[j] === 0) {
      if (i < rows - 1) i++;
      else j++;
    } else {
      if (s[i] === 0) i++;
      if (d[j] === 0) j++;
    }
  }

  return { iterations, finalCells: deepCopyCells(currentCells) };
};

/**
 * MODI optimization phase — runs until optimal or maxIter reached.
 * Returns one IterationResult per MODI step (including the final "optimal" step).
 */
const runMODI = (
  initialCells: Cell[],
  costs: number[][],
  rows: number,
  cols: number,
  dummyRow: number | null,
  dummyCol: number | null,
  maxIter = 100
): IterationResult[] => {
  const iterations: IterationResult[] = [];
  let currentCells = deepCopyCells(initialCells);
  let iterNum = 1;

  for (let iter = 0; iter < maxIter; iter++) {
    // Step 1: Fix degeneracy
    const { newBasis, fixed } = fixDegeneracy(currentCells, costs, rows, cols);
    currentCells = newBasis;

    // Step 2: Compute UV
    const uv = solveUV(currentCells, rows, cols);

    // Step 3: Marginal costs
    const marginals = computeMarginalCosts(costs, currentCells, uv, rows, cols);

    // Step 4: Find most negative marginal (entering cell)
    let bestMarginal: MarginalCost | null = null;
    for (const m of marginals) {
      if (m.value < -1e-9) {
        if (!bestMarginal || m.value < bestMarginal.value) bestMarginal = m;
      }
    }

    const totalCost = computeTotalCost(currentCells, dummyRow, dummyCol);

    if (!bestMarginal) {
      // OPTIMAL
      iterations.push({
        phase: "modi",
        iterationNumber: iterNum++,
        description: "✓ Solución Óptima: todos los costos marginales son ≥ 0. No hay mejoras posibles.",
        allocations: deepCopyCells(currentCells),
        uv,
        marginalCosts: marginals,
        enteringCell: null,
        leavingCell: null,
        loop: [],
        theta: null,
        totalCost,
        isOptimal: true,
        degeneracyFixed: fixed,
      });
      break;
    }

    // Step 5: Find closed loop via BFS
    const basicPositions = currentCells
      .filter((c) => !c.isEpsilon || c.allocated > 0)
      .map((c) => ({ row: c.row, col: c.col }));

    const rawLoop = findClosedLoopBFS(
      { row: bestMarginal.row, col: bestMarginal.col },
      basicPositions
    );

    if (!rawLoop) {
      // Can't find loop — degenerate edge case, stop
      iterations.push({
        phase: "modi",
        iterationNumber: iterNum++,
        description: `⚠ No se encontró circuito cerrado para [O${bestMarginal.row + 1}, D${bestMarginal.col + 1}]. Solución actual es la mejor posible.`,
        allocations: deepCopyCells(currentCells),
        uv,
        marginalCosts: marginals,
        enteringCell: { row: bestMarginal.row, col: bestMarginal.col },
        leavingCell: null,
        loop: [],
        theta: null,
        totalCost,
        isOptimal: true,
        degeneracyFixed: fixed,
      });
      break;
    }

    // Step 6: Build signed loop
    const signedLoop: LoopCell[] = rawLoop.map((p, idx) => ({
      row: p.row,
      col: p.col,
      sign: idx % 2 === 0 ? "+" : "-",
    }));

    // Step 7: Compute theta — min allocated among "-" cells
    const minusCells = signedLoop.filter((l) => l.sign === "-");
    let theta = Infinity;
    let leavingCell: { row: number; col: number } | null = null;
    for (const lc of minusCells) {
      const cell = currentCells.find((c) => c.row === lc.row && c.col === lc.col);
      const val = cell?.allocated ?? 0;
      if (val < theta) {
        theta = val;
        leavingCell = { row: lc.row, col: lc.col };
      }
    }
    if (theta === Infinity) theta = 0;

    iterations.push({
      phase: "modi",
      iterationNumber: iterNum++,
      description: `Entra [O${bestMarginal.row + 1}, D${bestMarginal.col + 1}] (Δ=${bestMarginal.value.toFixed(2)}). Sale [O${leavingCell ? leavingCell.row + 1 : "?"},D${leavingCell ? leavingCell.col + 1 : "?"}]. θ = ${theta}`,
      allocations: deepCopyCells(currentCells),
      uv,
      marginalCosts: marginals,
      enteringCell: { row: bestMarginal.row, col: bestMarginal.col },
      leavingCell,
      loop: signedLoop,
      theta,
      totalCost,
      isOptimal: false,
      degeneracyFixed: fixed,
    });

    // Step 8: Update allocations
    const nextCells = deepCopyCells(currentCells);

    // Add entering cell if not present
    const enteringInBasis = nextCells.find(
      (c) => c.row === bestMarginal!.row && c.col === bestMarginal!.col
    );
    if (enteringInBasis) {
      enteringInBasis.allocated += theta;
      enteringInBasis.isEpsilon = false;
    } else {
      nextCells.push({
        row: bestMarginal.row,
        col: bestMarginal.col,
        cost: costs[bestMarginal.row][bestMarginal.col],
        allocated: theta,
        isEpsilon: false,
      });
    }

    // Apply loop changes
    for (const lc of signedLoop.slice(1)) {
      const cellIdx = nextCells.findIndex((c) => c.row === lc.row && c.col === lc.col);
      if (cellIdx < 0) continue;
      nextCells[cellIdx].allocated += lc.sign === "+" ? theta : -theta;
    }

    // Remove cells with zero or negative allocation (except epsilon placeholders keep 0)
    currentCells = nextCells.filter((c) => c.allocated > 1e-9 || c.isEpsilon);
    // Clean up epsilon cells with non-zero allocation
    for (const c of currentCells) {
      if (c.isEpsilon && c.allocated > 1e-9) c.isEpsilon = false;
    }
  }

  return iterations;
};

// ─── Random Data Generator ────────────────────────────────────────────────────

const generateRandom = (rows: number, cols: number) => {
  const costs = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.floor(Math.random() * 30) + 1)
  );
  const supply = Array.from({ length: rows }, () => Math.floor(Math.random() * 50) + 10);
  const totalS = supply.reduce((a, b) => a + b, 0);
  const demand = new Array(cols).fill(0);
  let remaining = totalS;
  for (let i = 0; i < cols - 1; i++) {
    const maxAllowed = remaining - (cols - i - 1);
    const val = Math.min(maxAllowed, Math.floor(Math.random() * (remaining / (cols - i)) * 1.5) + 1);
    demand[i] = Math.max(1, val);
    remaining -= demand[i];
  }
  demand[cols - 1] = remaining;
  return { costs, supply, demand };
};

// ─── CellInput component ──────────────────────────────────────────────────────

const CellInput = ({
  value,
  onChange,
  accent = "emerald",
}: {
  value: number;
  onChange: (v: number) => void;
  accent?: "emerald" | "blue" | "violet";
}) => {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setText(value === 0 ? "" : String(value));
  }, [value]);

  const ringColor =
    accent === "blue" ? "focus:ring-blue-500" :
    accent === "violet" ? "focus:ring-violet-500" :
    "focus:ring-emerald-500";

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      placeholder="0"
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        const num = parseInt(text);
        const final = isNaN(num) ? 0 : Math.max(0, num);
        onChange(final);
        setText(final === 0 ? "" : String(final));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setText(raw);
        onChange(isNaN(parseInt(raw)) ? 0 : parseInt(raw));
      }}
      className={`w-full max-w-[176px] bg-slate-800/80 border border-slate-700 text-white text-center text-base py-1.5 rounded-lg focus:outline-none focus:ring-2 ${ringColor} transition-all placeholder-slate-600`}
    />
  );
};

// ─── Phase Badge ──────────────────────────────────────────────────────────────

const PhaseBadge = ({ phase }: { phase: "northwest" | "modi" }) => (
  <span className={`text-sm font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
    phase === "northwest"
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
  }`}>
    {phase === "northwest" ? "NW" : "MODI"}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Northwest = () => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [costs, setCosts] = useState<number[][]>(
    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0))
  );
  const [supply, setSupply] = useState<number[]>(new Array(3).fill(0));
  const [demand, setDemand] = useState<number[]>(new Array(3).fill(0));

  const [allIterations, setAllIterations] = useState<IterationResult[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [tab, setTab] = useState<"config" | "result">("config");
  const [method, setMethod] = useState<"northwest" | "min_cost">("northwest");
  const [mode, setMode] = useState<"minimize" | "maximize">("minimize");
  const [fileName, setFileName] = useState("");
  const [solveCtx, setSolveCtx] = useState<SolveContext | null>(null);
  // Which sub-tab to show in result view
  const [resultView, setResultView] = useState<"steps" | "northwest" | "modi">("steps");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFinished = currentStep === allIterations.length - 1 && allIterations.length > 0;
  const currentIteration: IterationResult | null = currentStep >= 0 ? allIterations[currentStep] : null;

  // Derived helpers
  const northwestIterations = allIterations.filter((it) => it.phase === "northwest");
  const modiIterations = allIterations.filter((it) => it.phase === "modi");
  const nwFinalIteration = northwestIterations.length > 0
    ? northwestIterations[northwestIterations.length - 1]
    : null;
  const modiFinalIteration = modiIterations.length > 0
    ? modiIterations[modiIterations.length - 1]
    : null;

  // ── Grid resize ────────────────────────────────────────────────────────────
  const resizeGrid = (newRows: number, newCols: number) => {
    setCosts((prev) =>
      Array.from({ length: newRows }, (_, r) =>
        Array.from({ length: newCols }, (_, c) => prev[r]?.[c] ?? 0)
      )
    );
    setSupply((prev) => Array.from({ length: newRows }, (_, r) => prev[r] ?? 0));
    setDemand((prev) => Array.from({ length: newCols }, (_, c) => prev[c] ?? 0));
    setRows(newRows);
    setCols(newCols);
    clearResults();
  };

  const clearResults = () => {
    setAllIterations([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    setSolveCtx(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const randomize = () => {
    const { costs: nc, supply: ns, demand: nd } = generateRandom(rows, cols);
    setCosts([...nc]);
    setSupply([...ns]);
    setDemand([...nd]);
    clearResults();
    setTab("config");
  };

  // ── Run solver ─────────────────────────────────────────────────────────────
  const run = () => {
    const totalSupply = supply.reduce((a, b) => a + b, 0);
    const totalDemand = demand.reduce((a, b) => a + b, 0);

    let solvedCosts = costs.map((r) => [...r]);
    let solvedSupply = [...supply];
    let solvedDemand = [...demand];
    let solvedRows = rows;
    let solvedCols = cols;
    let dummyRow: number | null = null;
    let dummyCol: number | null = null;
    let originalMaxValue: number | null = null;

    // Balance
    if (totalSupply > totalDemand) {
      dummyCol = cols;
      solvedCols = cols + 1;
      solvedDemand = [...demand, totalSupply - totalDemand];
      solvedCosts = costs.map((row) => [...row, 0]);
    } else if (totalDemand > totalSupply) {
      dummyRow = rows;
      solvedRows = rows + 1;
      solvedSupply = [...supply, totalDemand - totalSupply];
      solvedCosts = [...costs.map((r) => [...r]), new Array(cols).fill(0)];
    }

    // For maximize: convert to minimize by negating costs
    // We'll display original costs in the UI but solve on negated
    let workingCosts = solvedCosts.map((r) => [...r]);
    if (mode === "maximize") {
      // Negate all costs (standard big-M conversion)
      workingCosts = solvedCosts.map((row) => row.map((c) => -c));
      originalMaxValue = null; // we negate, not subtract
    }

    // Phase 1: Northwest or Min Cost BFS
    const { iterations: nwIters, finalCells } =
      method === "northwest"
        ? northwestCorner(solvedSupply, solvedDemand, workingCosts)
        : runMinCostBFS(solvedSupply, solvedDemand, workingCosts, mode);

    // Attach real costs to cells for display (use solvedCosts, not negated)
    const finalCellsWithRealCost: Cell[] = finalCells.map((c) => ({
      ...c,
      cost: solvedCosts[c.row][c.col],
    }));

    // Recompute totalCost for NW iterations using real costs
    const nwWithCosts: IterationResult[] = nwIters.map((it) => ({
      ...it,
      allocations: it.allocations.map((c) => ({
        ...c,
        cost: solvedCosts[c.row][c.col],
      })),
      totalCost: computeTotalCost(
        it.allocations.map((c) => ({ ...c, cost: solvedCosts[c.row][c.col] })),
        dummyRow,
        dummyCol
      ),
    }));

    // Phase 2: MODI on working (possibly negated) costs
    const modiIters = runMODI(
      finalCells, // use working-cost cells for optimization
      workingCosts,
      solvedRows,
      solvedCols,
      dummyRow,
      dummyCol
    );

    // Map MODI results back to real costs for display
    const modiWithRealCosts: IterationResult[] = modiIters.map((it) => ({
      ...it,
      allocations: it.allocations.map((c) => ({
        ...c,
        cost: solvedCosts[c.row][c.col],
      })),
      totalCost: computeTotalCost(
        it.allocations.map((c) => ({ ...c, cost: solvedCosts[c.row][c.col] })),
        dummyRow,
        dummyCol
      ),
      // Also remap marginal costs for display
      marginalCosts: it.marginalCosts.map((mc) => ({
        ...mc,
        // Keep the working-cost marginal value (sign is correct for the optimization direction)
      })),
    }));

    const allIters = [...nwWithCosts, ...modiWithRealCosts];
    setSolveCtx({
      costs: solvedCosts,
      supply: solvedSupply,
      demand: solvedDemand,
      rows: solvedRows,
      cols: solvedCols,
      dummyRow,
      dummyCol,
      mode,
      originalMaxValue,
    });
    setAllIterations(allIters);
    setCurrentStep(-1);
    setTab("result");
    setResultView("steps");
  };

  // ── Min Cost BFS ──────────────────────────────────────────────────────────
  const runMinCostBFS = (
    supply: number[],
    demand: number[],
    costs: number[][],
    mode: "minimize" | "maximize"
  ): { iterations: IterationResult[]; finalCells: Cell[] } => {
    const s = [...supply];
    const d = [...demand];
    const rows = s.length;
    const cols = d.length;
    const iterations: IterationResult[] = [];
    const currentCells: Cell[] = [];
    const doneRows = new Set<number>();
    const doneCols = new Set<number>();
    let stepNum = 1;

    while (doneRows.size < rows || doneCols.size < cols) {
      let bestVal = mode === "minimize" ? Infinity : -Infinity;
      let bestCell: [number, number] | null = null;

      for (let r = 0; r < rows; r++) {
        if (doneRows.has(r)) continue;
        for (let c = 0; c < cols; c++) {
          if (doneCols.has(c)) continue;
          const cost = costs[r][c];
          if (mode === "minimize" ? cost < bestVal : cost > bestVal) {
            bestVal = cost;
            bestCell = [r, c];
          }
        }
      }
      if (!bestCell) break;

      const [r, c] = bestCell;
      const allocated = Math.min(s[r], d[c]);
      const prevS = s[r];
      const prevD = d[c];
      s[r] -= allocated;
      d[c] -= allocated;

      currentCells.push({ row: r, col: c, cost: costs[r][c], allocated, isEpsilon: false });
      iterations.push({
        phase: "northwest",
        iterationNumber: stepNum++,
        description: `Costo ${mode === "minimize" ? "mínimo" : "máximo"} disponible: ${bestVal} en [O${r+1},D${c+1}]. Asignar min(${prevS}, ${prevD}) = ${allocated}`,
        allocations: deepCopyCells(currentCells),
        uv: null,
        marginalCosts: [],
        enteringCell: { row: r, col: c },
        leavingCell: null,
        loop: [],
        theta: null,
        totalCost: 0,
        isOptimal: false,
        degeneracyFixed: false,
      });

      if (s[r] === 0) doneRows.add(r);
      if (d[c] === 0) doneCols.add(c);

      // If both exhausted and not last iteration, mark one as "done" for traversal
      if (s[r] === 0 && d[c] === 0) {
        if (doneRows.size < rows) doneRows.delete(r); // allow row to continue if still needed
      }
    }

    return { iterations, finalCells: deepCopyCells(currentCells) };
  };

  const reset = () => {
    setCosts(Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)));
    setSupply(Array.from({ length: rows }, () => 0));
    setDemand(Array.from({ length: cols }, () => 0));
    clearResults();
    setTab("config");
  };

  const stepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, allIterations.length - 1));
  }, [allIterations.length]);

  const stepBackward = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, -1));
  }, []);

  // ── Auto-play ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= allIterations.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, allIterations.length]);

  // ── Export / Import ────────────────────────────────────────────────────────
  const exportData = async () => {
    const data = { rows, cols, costs, supply, demand, timestamp: new Date().toISOString() };
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    
    // ── Priority: Native File System Explorer ──
    const win = window as any;
    if (win.showSaveFilePicker) {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: `transporte-${rows}x${cols}.json`,
          types: [{
            description: "JSON File",
            accept: { "application/json": [".json"] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return; // Success
      } catch (err: any) {
        if (err.name === "AbortError") return; // User cancelled
        console.error("FileSystem API Error:", err);
      }
    }
    
    // ── Fallback: Traditional Download ──
    
    // Fallback to traditional download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (fileName || `transporte-${rows}x${cols}`) + ".json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.costs || !parsed.supply || !parsed.demand) throw new Error();
        const newRows = parsed.rows || parsed.costs.length;
        const newCols = parsed.cols || parsed.costs[0].length;
        setRows(newRows);
        setCols(newCols);
        setCosts(parsed.costs.map((r: number[]) => [...r]));
        setSupply([...parsed.supply]);
        setDemand([...parsed.demand]);
        clearResults();
        setTab("config");
      } catch { alert("Archivo inválido."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Computed display values ────────────────────────────────────────────────
  const totalSupply = supply.reduce((a, b) => a + b, 0);
  const totalDemand = demand.reduce((a, b) => a + b, 0);
  const isImbalanced = totalSupply !== totalDemand;
  const isReadyToSolve = totalSupply > 0 && totalDemand > 0;
  const ctx = solveCtx;

  // ── Allocation table renderer ──────────────────────────────────────────────
  const renderAllocationTable = (iteration: IterationResult | null, solveCtx: SolveContext) => {
    if (!iteration) return null;
    const { allocations, loop, enteringCell, uv } = iteration;

    return (
      <div className="overflow-x-auto flex justify-center w-full scrollbar-hide">
        <table className="border-separate border-spacing-1 mx-auto">
          <thead>
            <tr>
              <th className="w-20 text-right pr-2">
                {uv && <span className="text-xs text-yellow-500/70 font-mono">u↓ / v→</span>}
              </th>
              {Array.from({ length: solveCtx.cols }, (_, c) => (
                <th key={c} className={`text-sm font-bold pb-1 ${c === solveCtx.dummyCol ? "text-yellow-400/60" : "text-blue-400"}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{c === solveCtx.dummyCol ? "D*" : `D${c + 1}`}</span>
                    {uv && uv.v[c] !== undefined && (
                      <span className="text-xs text-yellow-500 font-mono">v={uv.v[c]}</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="text-sm text-emerald-400 font-bold pb-1">Oferta</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: solveCtx.rows }, (_, r) => (
              <tr key={r}>
                <td className={`text-sm font-bold text-right pr-2 ${r === solveCtx.dummyRow ? "text-yellow-400/60" : "text-emerald-400"}`}>
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{r === solveCtx.dummyRow ? "O*" : `O${r + 1}`}</span>
                    {uv && uv.u[r] !== undefined && (
                      <span className="text-xs text-yellow-500 font-mono">u={uv.u[r]}</span>
                    )}
                  </div>
                </td>
                {Array.from({ length: solveCtx.cols }, (_, c) => {
                  const cell = allocations.find((a) => a.row === r && a.col === c);
                  const isActive = enteringCell?.row === r && enteringCell?.col === c;
                  const loopEntry = loop.find((l) => l.row === r && l.col === c);
                  const isInLoop = !!loopEntry;
                  const isDummy = r === solveCtx.dummyRow || c === solveCtx.dummyCol;

                  return (
                    <td key={c} className="p-0">
                      <div className={`
                        relative rounded-xl p-2 min-w-[120px] min-h-[70px] flex flex-col items-center justify-center transition-all duration-300
                        ${isDummy ? "opacity-40" : ""}
                        ${isActive && !isInLoop ? "bg-emerald-500/25 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-105" : ""}
                        ${isInLoop && loopEntry?.sign === "+" ? "bg-emerald-500/20 border-2 border-emerald-400" : ""}
                        ${isInLoop && loopEntry?.sign === "-" ? "bg-red-500/20 border-2 border-red-400" : ""}
                        ${!isActive && !isInLoop && cell && !isDummy ? "bg-blue-500/10 border border-blue-500/25" : ""}
                        ${!isActive && !isInLoop && cell?.isEpsilon ? "bg-amber-500/10 border border-amber-500/25" : ""}
                        ${!isActive && !isInLoop && !cell ? "bg-slate-800/50 border border-slate-700/40" : ""}
                      `}>
                        {isInLoop && (
                          <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-sm font-black shadow-lg z-10 ${loopEntry?.sign === "+" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                            {loopEntry?.sign}
                          </div>
                        )}
                        <span className="absolute top-1 right-1.5 text-xs text-slate-500 font-mono">
                          {solveCtx.costs[r][c]}
                        </span>
                        {cell ? (
                          <span className={`text-base font-black ${cell.isEpsilon ? "text-amber-400/70" : isActive ? "text-emerald-300" : "text-blue-300"}`}>
                            {cell.isEpsilon ? "ε" : cell.allocated}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-lg">—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="text-center pl-1">
                  <span className="text-sm font-bold px-2 py-1 rounded-lg bg-emerald-900/30 text-emerald-400">
                    {solveCtx.supply[r]}
                  </span>
                </td>
              </tr>
            ))}
            <tr>
              <td className="text-sm text-blue-400 font-bold text-right pr-2">Demanda</td>
              {Array.from({ length: solveCtx.cols }, (_, c) => (
                <td key={c} className="text-center pt-1">
                  <span className={`text-sm font-bold px-2 py-1 rounded-lg ${c === solveCtx.dummyCol ? "bg-yellow-900/20 text-yellow-400/60" : "bg-blue-900/30 text-blue-400"}`}>
                    {solveCtx.demand[c]}
                  </span>
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ── MODI Detail Panel ──────────────────────────────────────────────────────
  const renderMODIDetail = (it: IterationResult) => (
    <div className="space-y-3">
      {/* UV Values */}
      {it.uv && (
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
          <h4 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-3">
            Multiplicadores U-V
          </h4>
          <div className="flex flex-wrap gap-2">
            {it.uv.u.map((u, i) => (
              u !== undefined && (
                <span key={`u${i}`} className="text-sm font-mono bg-slate-700 rounded-lg px-2 py-1 text-yellow-300">
                  u{i + 1} = {u}
                </span>
              )
            ))}
            {it.uv.v.map((v, j) => (
              v !== undefined && (
                <span key={`v${j}`} className="text-sm font-mono bg-slate-700 rounded-lg px-2 py-1 text-sky-300">
                  v{j + 1} = {v}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {/* Marginal Costs */}
      {it.marginalCosts.length > 0 && (
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
          <h4 className="text-sm font-black text-violet-400 uppercase tracking-widest mb-3">
            Costos Marginales (c<sub>ij</sub> − u<sub>i</sub> − v<sub>j</sub>)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {it.marginalCosts.map((mc, idx) => (
              <span
                key={idx}
                className={`text-sm font-mono rounded-lg px-2 py-1 border ${
                  mc.value < -1e-9
                    ? "bg-red-900/30 text-red-300 border-red-500/30 font-bold"
                    : mc.value > 1e-9
                    ? "bg-slate-700 text-slate-400 border-slate-600"
                    : "bg-slate-700 text-slate-500 border-slate-600"
                }`}
              >
                Δ[O{mc.row + 1},D{mc.col + 1}] = {mc.value.toFixed(2)}
                {mc.value < -1e-9 && " ←"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Loop info */}
      {it.loop.length > 0 && (
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
          <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-3">
            Circuito Cerrado (θ = {it.theta})
          </h4>
          <div className="flex items-center flex-wrap gap-1">
            {it.loop.map((lc, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${lc.sign === "+" ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/30" : "bg-red-900/40 text-red-300 border border-red-500/30"}`}>
                  {lc.sign}[O{lc.row + 1},D{lc.col + 1}]
                </span>
                {idx < it.loop.length - 1 && <span className="text-slate-600">→</span>}
              </span>
            ))}
          </div>
          {it.enteringCell && it.leavingCell && (
            <div className="mt-2 flex gap-4 text-sm text-slate-400">
              <span>Entra: <span className="text-emerald-400 font-bold">[O{it.enteringCell.row + 1},D{it.enteringCell.col + 1}]</span></span>
              <span>Sale: <span className="text-red-400 font-bold">[O{it.leavingCell.row + 1},D{it.leavingCell.col + 1}]</span></span>
            </div>
          )}
        </div>
      )}

      {it.degeneracyFixed && (
        <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          <AlertTriangle size={12} />
          Se detectó degeneración. Se agregó celda ε artificial para calcular multiplicadores.
        </div>
      )}
    </div>
  );

  // ── Summary Table for final result ─────────────────────────────────────────
  const renderFinalSummary = (iteration: IterationResult, label: string, accentClass: string) => {
    if (!ctx) return null;
    const realAllocations = iteration.allocations.filter(
      (a) => !a.isEpsilon && a.row !== ctx.dummyRow && a.col !== ctx.dummyCol
    );

    return (
      <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl`}>
        <h3 className={`text-base font-black uppercase tracking-widest mb-4 ${accentClass}`}>
          {label}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {realAllocations.map((a, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
              <span className="text-slate-400 text-sm font-mono">O{a.row + 1} → D{a.col + 1}</span>
              <div className="text-right text-sm">
                <span className="text-white font-bold">{a.allocated}</span>
                <span className="text-slate-500 mx-1">×</span>
                <span className="text-slate-400">{ctx.costs[a.row][a.col]}</span>
                <span className="text-slate-500 mx-1">=</span>
                <span className="text-yellow-400 font-bold">{a.allocated * ctx.costs[a.row][a.col]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`flex items-center justify-between rounded-2xl px-5 py-4 border ${accentClass.includes("emerald") ? "bg-emerald-900/30 border-emerald-500/30" : "bg-violet-900/30 border-violet-500/30"}`}>
          <span className={`font-bold text-base ${accentClass}`}>
            {ctx.mode === "maximize" ? "Beneficio Total" : "Costo Total"}
          </span>
          <span className={`font-black text-2xl ${accentClass}`}>
            {iteration.totalCost}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />
      {/* ── HEADER ── */}
      <div className="w-full flex justify-between items-center px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl sticky top-16 z-40">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Grid3x3 size={20} className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none">NorthWest</h1>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex bg-slate-800 rounded-xl p-1">
              <button onClick={() => setTab("config")}
                className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all ${tab === "config" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}>
                Configurar
              </button>
              <button onClick={() => setTab("result")} disabled={allIterations.length === 0}
                className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all disabled:opacity-30 ${tab === "result" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}>
                Solución
              </button>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700" />
          <div className="flex items-center gap-2">
            <button onClick={exportData} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
              <Download size={13} /> Exportar
            </button>
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer">
              <Upload size={13} /> Importar
              <input type="file" className="hidden" accept=".json" onChange={importData} />
            </label>
            <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-all">
              <RotateCcw size={13} /> Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex gap-6 px-6 pb-6 pt-20">
        {/* ── SIDEBAR ── */}
        <aside className="w-56 space-y-4 shrink-0">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4">Configuración</h2>
            <div className="space-y-4">

              <div>
                <label className="text-sm text-slate-500 uppercase font-black tracking-widest block mb-1.5">Objetivo</label>
                <div className="flex bg-slate-800 rounded-lg p-0.5">
                  <button onClick={() => setMode("minimize")}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-sm font-black rounded-md transition-all ${mode === "minimize" ? "bg-emerald-600 text-white" : "text-slate-400"}`}>
                    <TrendingDown size={10} /> Min
                  </button>
                  <button onClick={() => setMode("maximize")}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-sm font-black rounded-md transition-all ${mode === "maximize" ? "bg-violet-600 text-white" : "text-slate-400"}`}>
                    <TrendingUp size={10} /> Max
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                <label className="text-sm text-slate-500 uppercase font-black tracking-widest block mb-2">Dimensiones</label>
                {[
                  { label: "Orígenes", val: rows, setter: (n: number) => resizeGrid(n, cols), min: 2, max: 6 },
                  { label: "Destinos", val: cols, setter: (n: number) => resizeGrid(rows, n), min: 2, max: 6 },
                ].map(({ label, val, setter, min, max }) => (
                  <div key={label} className="mb-2">
                    <label className="text-xs text-slate-600 uppercase font-bold">{label}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => setter(Math.max(min, val - 1))}
                        className="bg-slate-700 hover:bg-slate-600 text-white w-7 h-7 rounded-lg font-bold text-base transition-colors">−</button>
                      <span className="flex-1 text-center text-white font-black text-base">{val}</span>
                      <button onClick={() => setter(Math.min(max, val + 1))}
                        className="bg-slate-700 hover:bg-slate-600 text-white w-7 h-7 rounded-lg font-bold text-base transition-colors">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 space-y-3">
            <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Info size={14} /> Guía rápida
            </h3>
            <div className="space-y-2 text-sm text-slate-400 leading-snug">
              <p><b>1.</b> Llena la tabla con costos, oferta y demanda.</p>
              <p><b>2.</b> Elige tu objetivo (Min/Max) y presiona <b>Resolver</b>.</p>
              <p><b>3.</b> Usa las flechas para ver la optimización paso a paso.</p>
              <p><b>4.</b> Navega entre la resolución con Northwest y el resultado más óptimo con MODI.</p>
            </div>
          </div>
        </aside>

        {/* ── MAIN PANEL ── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* ── CONFIG TAB ── */}
          {tab === "config" && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-black text-white uppercase tracking-widest">Tabla de Costos</h2>
                <button onClick={randomize}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-bold transition-all">
                  <Shuffle size={12} /> Aleatorio
                </button>
              </div>

              <div className="overflow-x-auto flex justify-center w-full scrollbar-hide">
                <table className="border-separate border-spacing-1.5 mx-auto">
                  <thead>
                    <tr>
                      <th className="w-14" />
                      {Array.from({ length: cols }, (_, c) => (
                        <th key={c} className="text-sm text-blue-400 font-bold pb-1">D{c + 1}</th>
                      ))}
                      <th className="text-sm text-emerald-400 font-bold pb-1">Oferta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rows }, (_, r) => (
                      <tr key={r}>
                        <td className="text-sm text-emerald-400 font-bold text-right pr-2">O{r + 1}</td>
                        {Array.from({ length: cols }, (_, c) => (
                          <td key={c} className="p-0">
                            <CellInput value={costs[r]?.[c] ?? 0} onChange={(v) => {
                              setCosts(costs.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row));
                            }} />
                          </td>
                        ))}
                        <td className="p-0">
                          <CellInput accent="emerald" value={supply[r] ?? 0} onChange={(v) => {
                            const next = [...supply]; next[r] = v; setSupply(next);
                          }} />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="text-sm text-blue-400 font-bold text-right pr-2 pt-1">Demanda</td>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="p-0 pt-1">
                          <CellInput accent="blue" value={demand[c] ?? 0} onChange={(v) => {
                            const next = [...demand]; next[c] = v; setDemand(next);
                          }} />
                        </td>
                      ))}
                      <td className="text-center text-slate-700 text-sm">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {isImbalanced && isReadyToSolve && (
                <div className="mt-4 flex items-start gap-2 text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <Zap size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Oferta ({totalSupply}) ≠ Demanda ({totalDemand}).
                    Se añadirá una {totalSupply > totalDemand ? "columna ficticia D*" : "fila ficticia O*"} con costo 0.
                  </span>
                </div>
              )}

              {mode === "maximize" && (
                <div className="mt-3 flex items-start gap-2 text-violet-400 text-sm bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                  <TrendingUp size={13} className="shrink-0 mt-0.5" />
                  Modo maximizar: los costos se negarán internamente (×−1) para aplicar MODI correctamente. El resultado muestra el beneficio real.
                </div>
              )}

              <div className="mt-5">
                <button onClick={run} disabled={!isReadyToSolve}
                  className={`w-full text-white py-3 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${mode === "maximize" ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/40" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40"}`}>
                  <Play size={15} />
                  Resolver ({method === "northwest" ? "" : "Costo Mín."} {mode === "minimize" ? "Minimizar" : "Maximizar"})
                </button>
              </div>
            </div>
          )}

          {/* ── RESULT TAB ── */}
          {tab === "result" && allIterations.length > 0 && ctx && (
            <>
              {/* Balance notice */}
              {(ctx.dummyRow !== null || ctx.dummyCol !== null) && (
                <div className="flex items-center gap-2 text-yellow-300 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                  <Zap size={13} className="shrink-0" />
                  Problema desbalanceado: se agregó {ctx.dummyCol !== null ? "columna ficticia D*" : "fila ficticia O*"} con costo 0. Las asignaciones ficticias no cuentan en el costo total.
                </div>
              )}

              {/* Result sub-tabs */}
              <div className="flex justify-center bg-slate-800/60 rounded-xl p-1 gap-1 w-fit mx-auto">
                {[
                  { key: "steps" as const, label: "Paso a Paso" },
                  { key: "northwest" as const, label: `Resultado` },
                  { key: "modi" as const, label: "Resultado Óptimo" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setResultView(key)}
                    className={`px-4 py-1 text-xs font-black rounded-lg transition-all ${resultView === key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* STEP-BY-STEP VIEW */}
              {resultView === "steps" && (
                <>
                  {/* Playback controls */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-2 flex-wrap">
                    <button onClick={() => { setCurrentStep(-1); setIsPlaying(false); }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all">
                      ⏮
                    </button>
                    <button onClick={stepBackward} disabled={currentStep <= -1}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-all">
                      ←
                    </button>
                    <button onClick={() => setIsPlaying((p) => !p)} disabled={isFinished}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-all">
                      {isPlaying ? "⏸ Pausar" : <><Play size={12} /> Reproducir</>}
                    </button>
                    <button onClick={stepForward} disabled={isFinished || isPlaying}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-all">
                      <ChevronRight size={13} /> Paso
                    </button>
                    <button onClick={() => { setCurrentStep(allIterations.length - 1); setIsPlaying(false); }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all">
                      ⏭
                    </button>
                    <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
                      <span>{currentStep + 1} / {allIterations.length}</span>
                      {currentIteration && <PhaseBadge phase={currentIteration.phase} />}
                    </div>
                    {isFinished && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 size={14} /> Óptimo
                      </div>
                    )}
                  </div>

                  {/* Step description */}
                  {currentIteration && (
                    <div className={`border rounded-2xl px-5 py-3 flex items-start gap-3 ${currentIteration.phase === "modi" ? "bg-violet-900/20 border-violet-500/30" : "bg-emerald-900/20 border-emerald-500/30"}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5 ${currentIteration.phase === "modi" ? "bg-violet-600" : "bg-emerald-600"} text-white`}>
                        {currentStep + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-base font-medium ${currentIteration.phase === "modi" ? "text-violet-300" : "text-emerald-300"}`}>
                          {currentIteration.description}
                        </p>
                        {currentIteration.totalCost > 0 && (
                          <p className="text-sm text-slate-500 mt-1">
                            {ctx.mode === "maximize" ? "Beneficio" : "Costo"} actual: <span className="text-yellow-400 font-bold">{currentIteration.totalCost}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Main allocation table */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-black text-white uppercase tracking-widest">Tabla de Asignación</h2>
                      {currentIteration && <PhaseBadge phase={currentIteration.phase} />}
                    </div>
                    {currentIteration
                      ? renderAllocationTable(currentIteration, ctx)
                      : renderAllocationTable(null, ctx)
                    }
                  </div>

                  {/* MODI detail panel (only for MODI steps) */}
                  {currentIteration?.phase === "modi" && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                      <h2 className="text-sm font-black text-violet-400 uppercase tracking-widest mb-4">Detalle MODI — Iteración {currentIteration.iterationNumber}</h2>
                      {renderMODIDetail(currentIteration)}
                    </div>
                  )}
                </>
              )}

              {/* NORTHWEST FINAL VIEW */}
              {resultView === "northwest" && nwFinalIteration && (
                <div className="space-y-4">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                    <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4">
                      Resultado {method === "northwest" ? "Esquina Noroeste" : "Costo Mínimo"} — Solución Básica Factible Inicial
                    </h2>
                    {renderAllocationTable(nwFinalIteration, ctx)}
                  </div>
                  {renderFinalSummary(nwFinalIteration, `Costo BFS Inicial (${method === "northwest" ? "NW" : "Min Cost"})`, "text-emerald-400")}
                  <div className="text-sm text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/50">
                    <b className="text-slate-400">Nota:</b> Esta es la solución básica factible inicial, no necesariamente óptima. El método MODI la mejora iterativamente.
                  </div>
                </div>
              )}

              {/* MODI OPTIMAL VIEW */}
              {resultView === "modi" && modiFinalIteration && (
                <div className="space-y-4">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                    <h2 className="text-sm font-black text-violet-400 uppercase tracking-widest mb-4">
                      Solución Óptima — Tras {modiIterations.length} Iteración{modiIterations.length !== 1 ? "es" : ""} MODI
                    </h2>
                    {renderAllocationTable(modiFinalIteration, ctx)}
                    {modiFinalIteration.uv && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-sm text-slate-500 uppercase font-black tracking-widest mb-2">Multiplicadores finales</p>
                        <div className="flex flex-wrap gap-1.5">
                          {modiFinalIteration.uv.u.map((u, i) => u !== undefined && (
                            <span key={`u${i}`} className="text-sm font-mono bg-slate-800 rounded-lg px-2 py-0.5 text-yellow-300 border border-slate-700">
                              u{i+1}={u}
                            </span>
                          ))}
                          {modiFinalIteration.uv.v.map((v, j) => v !== undefined && (
                            <span key={`v${j}`} className="text-sm font-mono bg-slate-800 rounded-lg px-2 py-0.5 text-sky-300 border border-slate-700">
                              v{j+1}={v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {renderFinalSummary(modiFinalIteration, `Solución Óptima (${ctx.mode === "maximize" ? "Maximizar" : "Minimizar"})`, "text-violet-400")}

                  {/* Comparison */}
                  {nwFinalIteration && nwFinalIteration.totalCost !== modiFinalIteration.totalCost && (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Mejora MODI</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-slate-700/50 rounded-xl px-4 py-3 text-center">
                          <p className="text-sm text-slate-500 mb-1">Antes (NW)</p>
                          <p className="text-xl font-black text-slate-300">{nwFinalIteration.totalCost}</p>
                        </div>
                        <div className="text-slate-600">→</div>
                        <div className="flex-1 bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-4 py-3 text-center">
                          <p className="text-sm text-emerald-500 mb-1">Después (MODI)</p>
                          <p className="text-xl font-black text-emerald-400">{modiFinalIteration.totalCost}</p>
                        </div>
                        <div className="flex-1 text-center">
                          <p className="text-sm text-slate-500 mb-1">Diferencia</p>
                          <p className={`text-xl font-black ${
                            (ctx.mode === "minimize" ? modiFinalIteration.totalCost < nwFinalIteration.totalCost : modiFinalIteration.totalCost > nwFinalIteration.totalCost)
                              ? "text-emerald-400" : "text-yellow-400"
                          }`}>
                            {Math.abs(modiFinalIteration.totalCost - nwFinalIteration.totalCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {nwFinalIteration && nwFinalIteration.totalCost === modiFinalIteration.totalCost && (
                    <div className="text-sm text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/50">
                      La solución NW ya era óptima. MODI lo confirmó sin realizar mejoras adicionales.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* EMPTY STATE */}
          {tab === "result" && allIterations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-80 text-slate-600 gap-4">
              <Grid3x3 size={48} className="opacity-20" />
              <p className="italic text-base">Configura la tabla y presiona Resolver</p>
              <button onClick={() => setTab("config")}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-base font-bold transition-all">
                <SkipForward size={13} /> Ir a configuración
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Northwest;