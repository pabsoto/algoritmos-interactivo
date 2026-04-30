import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import { Grid3x3, Play, SkipForward, RotateCcw, Shuffle, ChevronRight, CheckCircle2, Zap, Upload, Download } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step {
  type: "initial" | "optimization";
  row?: number;
  col?: number;
  allocation?: number;
  allocations: AllocationCell[];
  supplyAfter: number[];
  demandAfter: number[];
  u?: (number | null)[];
  v?: (number | null)[];
  loop?: { row: number; col: number }[];
  description: string;
}

interface AllocationCell {
  row: number;
  col: number;
  value: number;
}

interface SolveContext {
  costs: number[][];
  supply: number[];
  demand: number[];
  rows: number;
  cols: number;
  dummyRow: number | null;
  dummyCol: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandom = (rows: number, cols: number) => {
  const costs = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.floor(Math.random() * 30) + 1)
  );

  const supply = Array.from({ length: rows }, () => Math.floor(Math.random() * 50) + 10);
  const totalS = supply.reduce((a, b) => a + b, 0);
  const demand = new Array(cols).fill(0);
  let remaining = totalS;
  for (let i = 0; i < cols - 1; i++) {
    // Leave at least 1 per remaining destination so last demand is always positive
    const maxAllowed = remaining - (cols - i - 1);
    const val = Math.min(maxAllowed, Math.floor(Math.random() * (remaining / (cols - i)) * 1.5) + 1);
    demand[i] = Math.max(1, val);
    remaining -= demand[i];
  }
  demand[cols - 1] = remaining;
  return { costs, supply, demand };
};

const northwestCorner = (
  supply: number[],
  demand: number[],
  costs: number[][]
): Step[] => {
  const s = [...supply];
  const d = [...demand];
  const steps: Step[] = [];
  const currentAllocations: AllocationCell[] = [];
  let i = 0;
  let j = 0;

  while (i < s.length && j < d.length) {
    const allocation = Math.min(s[i], d[j]);
    const prevS = s[i];
    const prevD = d[j];
    
    s[i] -= allocation;
    d[j] -= allocation;
    currentAllocations.push({ row: i, col: j, value: allocation });

    steps.push({
      type: "initial",
      row: i,
      col: j,
      allocation,
      allocations: currentAllocations.map(a => ({ ...a })),
      supplyAfter: [...s],
      demandAfter: [...d],
      description: `Esquina Noroeste: Asignar min(O${i + 1}=${prevS}, D${j + 1}=${prevD}) = ${allocation}`,
    });

    if (s[i] === 0 && d[j] === 0) {
      if (i < s.length - 1) i++;
      else j++;
    } else {
      if (s[i] === 0) i++;
      if (d[j] === 0) j++;
    }
  }

  return steps;
};

const minimumCostMethod = (
  supply: number[],
  demand: number[],
  costs: number[][],
  mode: "minimize" | "maximize"
): Step[] => {
  const s = [...supply];
  const d = [...demand];
  const steps: Step[] = [];
  const currentAllocations: AllocationCell[] = [];
  const rows = s.length;
  const cols = d.length;
  const visitedRows = new Set<number>();
  const visitedCols = new Set<number>();

  while (visitedRows.size < rows && visitedCols.size < cols) {
    let bestVal = mode === "minimize" ? Infinity : -Infinity;
    let bestCell: [number, number] | null = null;

    for (let i = 0; i < rows; i++) {
      if (visitedRows.has(i)) continue;
      for (let j = 0; j < cols; j++) {
        if (visitedCols.has(j)) continue;
        const cost = costs[i][j];
        if (mode === "minimize" ? cost < bestVal : cost > bestVal) {
          bestVal = cost;
          bestCell = [i, j];
        }
      }
    }

    if (!bestCell) break;
    const [r, c] = bestCell;
    const allocation = Math.min(s[r], d[c]);
    const prevS = s[r];
    const prevD = d[c];

    s[r] -= allocation;
    d[c] -= allocation;
    currentAllocations.push({ row: r, col: c, value: allocation });

    steps.push({
      type: "initial",
      row: r,
      col: c,
      allocation,
      allocations: currentAllocations.map(a => ({ ...a })),
      supplyAfter: [...s],
      demandAfter: [...d],
      description: `Costo ${mode === "minimize" ? "Mínimo" : "Máximo"}: [O${r + 1}, D${c + 1}] (${bestVal}). Asignar min(${prevS}, ${prevD}) = ${allocation}`,
    });

    if (s[r] === 0) visitedRows.add(r);
    if (d[c] === 0) visitedCols.add(c);
  }

  return steps;
};

const solveUV = (rows: number, cols: number, basicCells: { row: number; col: number; cost: number }[]) => {
  const u: (number | null)[] = new Array(rows).fill(null);
  const v: (number | null)[] = new Array(cols).fill(null);
  u[0] = 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (const { row: r, col: c, cost } of basicCells) {
      if (u[r] !== null && v[c] === null) {
        v[c] = cost - u[r]!;
        changed = true;
      } else if (v[c] !== null && u[r] === null) {
        u[r] = cost - v[c]!;
        changed = true;
      }
    }
  }
  return { u, v };
};

const findClosedLoop = (startCell: { row: number; col: number }, basicCells: { row: number; col: number }[]) => {
  const points = [startCell, ...basicCells];
  const path: { row: number; col: number }[] = [];

  const getNeighbors = (curr: { row: number; col: number }, type: "row" | "col") => {
    return points.filter(p => 
      p !== curr && (type === "row" ? p.row === curr.row : p.col === curr.col)
    );
  };

  const solve = (curr: { row: number; col: number }, target: "row" | "col"): boolean => {
    path.push(curr);
    if (path.length > 3) {
      const isClosing = target === "row" ? curr.row === startCell.row : curr.col === startCell.col;
      if (isClosing) return true;
    }

    const neighbors = getNeighbors(curr, target);
    for (const next of neighbors) {
      if (path.includes(next)) continue;
      if (solve(next, target === "row" ? "col" : "row")) return true;
    }

    path.pop();
    return false;
  };

  if (solve(startCell, "row")) return path;
  if (solve(startCell, "col")) return path;
  return null;
};

const computeTotalCost = (allocations: AllocationCell[], costs: number[][], dummyRow: number | null, dummyCol: number | null) =>
  allocations.reduce((sum, a) => {
    if (a.row === dummyRow || a.col === dummyCol) return sum;
    return sum + a.value * (costs[a.row]?.[a.col] ?? 0);
  }, 0);

const CellInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const isFocused = useRef(false);

  // Sync from parent only when not focused (external update, e.g. randomize/reset)
  useEffect(() => {
    if (!isFocused.current) {
      setText(value === 0 ? "" : String(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
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
        const num = parseInt(raw);
        onChange(isNaN(num) ? 0 : num);
      }}
      className="w-full bg-slate-800 border border-slate-700 text-white text-center text-sm py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Northwest = () => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const [costs, setCosts] = useState<number[][]>(
    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0))
  );
  const [supply, setSupply] = useState<number[]>(new Array(3).fill(0));
  const [demand, setDemand] = useState<number[]>(new Array(3).fill(0));

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const [tab, setTab] = useState<"config" | "result">("config");
  const [method, setMethod] = useState<"northwest" | "min_cost">("northwest");
  const [mode, setMode] = useState<"minimize" | "maximize">("minimize");

  // Context for the (potentially balanced) problem that was actually solved
  const [solveCtx, setSolveCtx] = useState<SolveContext | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ctx = solveCtx ?? { costs, supply, demand, rows, cols, dummyRow: null, dummyCol: null };

  const allocations: AllocationCell[] = currentStep >= 0 
    ? steps[currentStep].allocations 
    : [];

  const totalCost = computeTotalCost(allocations, ctx.costs, ctx.dummyRow, ctx.dummyCol);
  const isFinished = currentStep === steps.length - 1 && steps.length > 0;

  // ── Grid resize ──────────────────────────────────────────────────────────
  const resizeGrid = (newRows: number, newCols: number) => {
    setCosts((prev) =>
      Array.from({ length: newRows }, (_, r) =>
        Array.from({ length: newCols }, (_, c) => prev[r]?.[c] ?? 0)
      )
    );
    setSupply((prev) =>
      Array.from({ length: newRows }, (_, r) => prev[r] ?? 0)
    );
    setDemand((prev) =>
      Array.from({ length: newCols }, (_, c) => prev[c] ?? 0)
    );
    setRows(newRows);
    setCols(newCols);
    
    // Cleanup results
    setSteps([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    setSolveCtx(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const randomize = () => {
    const { costs: newCosts, supply: newSupply, demand: newDemand } = generateRandom(rows, cols);
    setCosts([...newCosts]);
    setSupply([...newSupply]);
    setDemand([...newDemand]);
    setSteps([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    setSolveCtx(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTab("config");
  };

  // ── Run algorithm (auto-balances if needed) ──────────────────────────────
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

    const initialSteps = method === "northwest" 
      ? northwestCorner(solvedSupply, solvedDemand, solvedCosts)
      : minimumCostMethod(solvedSupply, solvedDemand, solvedCosts, mode);

    const s = [...initialSteps];
    
    // ── Optimization Phase (MODI) ──────────────────────────────────────────
    let currentAllocations = [...s[s.length - 1].allocations];
    let optimized = false;
    let iterations = 0;

    while (!optimized && iterations < 20) {
      iterations++;
      // Ensure basis has m+n-1 cells (handle degeneracy)
      const basis = [...currentAllocations];
      if (basis.length < solvedRows + solvedCols - 1) {
        for (let r = 0; r < solvedRows; r++) {
          for (let c = 0; c < solvedCols; c++) {
            if (!basis.find(b => b.row === r && b.col === c)) {
              basis.push({ row: r, col: c, value: 0 });
              if (basis.length === solvedRows + solvedCols - 1) break;
            }
          }
          if (basis.length === solvedRows + solvedCols - 1) break;
        }
      }

      const { u, v } = solveUV(solvedRows, solvedCols, basis.map(b => ({ row: b.row, col: b.col, cost: solvedCosts[b.row][b.col] })));
      
      let bestImprovement = 0;
      let enteringCell: { row: number, col: number } | null = null;

      for (let r = 0; r < solvedRows; r++) {
        for (let c = 0; c < solvedCols; c++) {
          if (basis.find(b => b.row === r && b.col === c)) continue;
          if (u[r] === null || v[c] === null) continue;

          const shadowCost = solvedCosts[r][c] - (u[r]! + v[c]!);
          const improvement = mode === "minimize" ? shadowCost : -shadowCost;

          if (improvement < bestImprovement) {
            bestImprovement = improvement;
            enteringCell = { row: r, col: c };
          }
        }
      }

      if (!enteringCell || bestImprovement >= 0) {
        optimized = true;
        s.push({
          type: "optimization",
          allocations: currentAllocations.map(a => ({ ...a })),
          supplyAfter: new Array(solvedRows).fill(0),
          demandAfter: new Array(solvedCols).fill(0),
          u, v,
          description: "¡Solución Óptima alcanzada! No hay más mejoras posibles.",
        });
      } else {
        const loop = findClosedLoop(enteringCell, basis.map(b => ({ row: b.row, col: b.col })));
        if (!loop) {
          optimized = true; 
          continue;
        }

        // Find max units to shift
        let theta = Infinity;
        for (let i = 1; i < loop.length; i += 2) {
          const cell = currentAllocations.find(a => a.row === loop[i].row && a.col === loop[i].col);
          theta = Math.min(theta, cell?.value ?? 0);
        }

        const nextAllocations = currentAllocations.map(a => ({ ...a }));
        const enteringInAlloc = nextAllocations.find(a => a.row === enteringCell!.row && a.col === enteringCell!.col);
        if (enteringInAlloc) enteringInAlloc.value += theta;
        else nextAllocations.push({ row: enteringCell.row, col: enteringCell.col, value: theta });

        for (let i = 1; i < loop.length; i++) {
          const cellIdx = nextAllocations.findIndex(a => a.row === loop[i].row && a.col === loop[i].col);
          if (cellIdx !== -1) {
            nextAllocations[cellIdx].value += (i % 2 === 0 ? theta : -theta);
            if (nextAllocations[cellIdx].value <= 0) nextAllocations.splice(cellIdx, 1);
          }
        }

        s.push({
          type: "optimization",
          allocations: currentAllocations.map(a => ({ ...a })),
          supplyAfter: new Array(solvedRows).fill(0),
          demandAfter: new Array(solvedCols).fill(0),
          u, v, loop,
          description: `Iteración MODI: Celda de mejora [O${enteringCell.row+1}, D${enteringCell.col+1}] con costo de oportunidad ${bestImprovement}. Desplazando ${theta} unidades en el lazo.`,
        });
        currentAllocations = nextAllocations;
      }
    }

    setSolveCtx({ costs: solvedCosts, supply: solvedSupply, demand: solvedDemand, rows: solvedRows, cols: solvedCols, dummyRow, dummyCol });
    setSteps(s);
    setCurrentStep(-1);
    setTab("result");
  };

  const balanceMatrix = () => {
    const totalSupply = supply.reduce((a, b) => a + b, 0);
    const totalDemand = demand.reduce((a, b) => a + b, 0);

    if (totalSupply > totalDemand) {
      // Add column
      setCosts(prev => prev.map(row => [...row, 0]));
      setDemand(prev => [...prev, totalSupply - totalDemand]);
      setCols(prev => prev + 1);
    } else if (totalDemand > totalSupply) {
      // Add row
      setCosts(prev => [...prev, new Array(cols).fill(0)]);
      setSupply(prev => [...prev, totalDemand - totalSupply]);
      setRows(prev => prev + 1);
    }
  };

  const reset = () => {
    setCosts(Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)));
    setSupply(Array.from({ length: rows }, () => 0));
    setDemand(Array.from({ length: cols }, () => 0));
    setSteps([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    setSolveCtx(null);
    setTab("config");
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const stepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  // ── Auto-play ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, steps.length]);

  // ── Cell helpers ─────────────────────────────────────────────────────────
  const getCellState = (r: number, c: number) => {
    if (steps.length === 0) return "idle";
    const current = steps[currentStep];
    if (current && current.row === r && current.col === c) return "active";
    const done = allocations.find((a) => a.row === r && a.col === c);
    if (done) return "done";
    return "idle";
  };

  const totalSupply = supply.reduce((a, b) => a + b, 0);
  const totalDemand = demand.reduce((a, b) => a + b, 0);
  const isImbalanced = totalSupply !== totalDemand;
  const isReadyToSolve = totalSupply > 0 && totalDemand > 0;

  const getCellAllocation = (r: number, c: number) =>
    allocations.find((a) => a.row === r && a.col === c)?.value ?? null;

  const currentSupply = currentStep >= 0 ? steps[currentStep].supplyAfter : ctx.supply;
  const currentDemand = currentStep >= 0 ? steps[currentStep].demandAfter : ctx.demand;

  const finalAllocations = steps.length > 0 ? steps[steps.length - 1].allocations : [];

  // ── Exportar ─────────────────────────────────────────────────────────────
  const exportData = async () => {
    const data = { rows, cols, costs, supply, demand, timestamp: new Date().toISOString() };
    const content = JSON.stringify(data, null, 2);

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `ejercicio-noroeste-${rows}x${cols}.json`,
          types: [{ description: "Archivo de Configuración JSON", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch {
        // user cancelled
      }
    } else {
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `matriz-${rows}x${cols}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Importar ─────────────────────────────────────────────────────────────
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.costs || !parsed.supply || !parsed.demand) throw new Error("Estructura inválida");
        const newRows = parsed.rows || parsed.costs.length;
        const newCols = parsed.cols || parsed.costs[0].length;
        setRows(newRows);
        setCols(newCols);
        setCosts(parsed.costs.map((r: number[]) => [...r]));
        setSupply([...parsed.supply]);
        setDemand([...parsed.demand]);
        setSteps([]);
        setCurrentStep(-1);
        setIsPlaying(false);
        setSolveCtx(null);
        setTab("config");
      } catch {
        alert("Error: El archivo no es válido para esta aplicación.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">

        {/* ── HEADER ── */}
        <div className="w-full flex justify-between items-center px-6 py-4 bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Grid3x3 className="text-emerald-500" /> Esquina Noroeste
            </h1>

            <div className="flex items-center gap-3">
              <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setTab("config")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${tab === "config" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  Configurar
                </button>
                <button
                  onClick={() => setTab("result")}
                  disabled={steps.length === 0}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all disabled:opacity-40 ${tab === "result" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  Solución
                </button>
              </div>

              <div className="flex items-center border-r border-slate-700 pr-4 gap-2">
                <button
                  onClick={exportData}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-all"
                  title="Guardar como..."
                >
                  <Download size={16} /> Exportar
                </button>
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white cursor-pointer transition-all">
                  <Upload size={16} /> Importar
                  <input type="file" className="hidden" accept=".json" onChange={importData} />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                >
                  <RotateCcw size={16} /> Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex gap-8">

          {/* ── SIDEBAR ── */}
          <aside className="w-64 space-y-4 shrink-0">

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Configuración</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Método</label>
                  <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="northwest">Esquina Noroeste</option>
                    <option value="min_cost">Costo Mínimo</option>
                  </select>
                </div>
                
                {method === "min_cost" && (
                  <div>
                    <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Objetivo</label>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                      <button
                        onClick={() => setMode("minimize")}
                        className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "minimize" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        Minimizar
                      </button>
                      <button
                        onClick={() => setMode("maximize")}
                        className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "maximize" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        Maximizar
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-white/5">
                  <label className="text-xs text-slate-400 uppercase font-semibold block mb-2">Dimensiones</label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Orígenes</label>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => resizeGrid(Math.max(2, rows - 1), cols)} className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg font-bold transition-colors">−</button>
                        <span className="flex-1 text-center text-white font-bold">{rows}</span>
                        <button onClick={() => resizeGrid(Math.min(6, rows + 1), cols)} className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg font-bold transition-colors">+</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Destinos</label>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => resizeGrid(rows, Math.max(2, cols - 1))} className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg font-bold transition-colors">−</button>
                        <span className="flex-1 text-center text-white font-bold">{cols}</span>
                        <button onClick={() => resizeGrid(rows, Math.min(6, cols + 1))} className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg font-bold transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {steps.length > 0 && tab === "result" && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
                <h2 className="text-sm font-bold text-white mb-3">Velocidad</h2>
                <input
                  type="range" min={300} max={2000} step={100}
                  value={2300 - speed}
                  onChange={(e) => setSpeed(2300 - parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Lento</span><span>Rápido</span>
                </div>
              </div>
            )}

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Estadísticas</h2>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Orígenes</span>
                  <span className="font-bold text-white">{rows}</span>
                </div>
                <div className="flex justify-between">
                  <span>Destinos</span>
                  <span className="font-bold text-white">{cols}</span>
                </div>
                <div className="flex justify-between">
                  <span>Oferta total</span>
                  <span className="font-bold text-emerald-400">{totalSupply}</span>
                </div>
                <div className="flex justify-between">
                  <span>Demanda total</span>
                  <span className={`font-bold ${isImbalanced ? "text-yellow-400" : "text-blue-400"}`}>{totalDemand}</span>
                </div>
                {steps.length > 0 && (
                  <>
                    <div className="pt-2 border-t border-white/5 flex justify-between">
                      <span>Paso</span>
                      <span className="font-bold text-white">{currentStep + 1} / {steps.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costo parcial</span>
                      <span className="font-bold text-yellow-400">{totalCost}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed p-2">
              <b>Instrucciones:</b><br />
              • Configura la tabla de costos, oferta y demanda.<br />
              • Presiona <b>Resolver</b> para ejecutar el método.<br />
              • Si la oferta ≠ demanda, se agrega una fila/columna ficticia automáticamente.<br />
              • Usa los controles para ver el proceso paso a paso.
            </div>
          </aside>

          {/* ── MAIN PANEL ── */}
          <div className="flex-1 space-y-4">

            {/* ── CONFIG TAB ── */}
            {tab === "config" && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Tabla de Costos</h2>
                  <button
                    onClick={randomize}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    <Shuffle size={13} /> Generar aleatorio
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-1.5">
                    <thead>
                      <tr>
                        <th className="text-slate-500 text-xs w-16"></th>
                        {Array.from({ length: cols }, (_, c) => (
                          <th key={c} className="text-xs text-blue-400 font-bold uppercase pb-1">D{c + 1}</th>
                        ))}
                        <th className="text-xs text-emerald-400 font-bold uppercase pb-1">Oferta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: rows }, (_, r) => (
                        <tr key={r}>
                          <td className="text-xs text-emerald-400 font-bold text-right pr-2">O{r + 1}</td>
                          {Array.from({ length: cols }, (_, c) => (
                            <td key={c} className="p-0">
                              <CellInput
                                value={costs[r]?.[c] ?? 0}
                                onChange={(v) => {
                                  const next = costs.map((row, ri) =>
                                    ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row
                                  );
                                  setCosts(next);
                                }}
                              />
                            </td>
                          ))}
                          <td className="p-0">
                            <CellInput
                              value={supply[r] ?? 0}
                              onChange={(v) => {
                                const next = [...supply];
                                next[r] = v;
                                setSupply(next);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="text-xs text-blue-400 font-bold text-right pr-2 pt-1">Demanda</td>
                        {Array.from({ length: cols }, (_, c) => (
                          <td key={c} className="p-0 pt-1">
                            <CellInput
                              value={demand[c] ?? 0}
                              onChange={(v) => {
                                const next = [...demand];
                                next[c] = v;
                                setDemand(next);
                              }}
                            />
                          </td>
                        ))}
                        <td className="text-center text-slate-600 text-xs pt-1">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Balance info */}
                {isImbalanced && isReadyToSolve && (
                  <div className="mt-4 flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                    <Zap size={14} className="shrink-0" />
                    <span>
                      Oferta ({totalSupply}) ≠ Demanda ({totalDemand}).
                      Se añadirá automáticamente una {totalSupply > totalDemand ? "columna ficticia (D*)" : "fila ficticia (O*)"} con costo 0 para balancear el sistema.
                    </span>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={run}
                    disabled={!isReadyToSolve}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40"
                  >
                    <Play size={16} /> Resolver con {method === "northwest" ? "Esquina Noroeste" : "Costo Mínimo"}
                  </button>
                  {isImbalanced && (
                    <button
                      onClick={balanceMatrix}
                      className="px-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-bold text-sm transition-all"
                      title="Equilibrar oferta y demanda añadiendo fila/columna ficticia"
                    >
                      Equilibrar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── RESULT TAB ── */}
            {tab === "result" && steps.length > 0 && (
              <>
                {/* Balancing notice */}
                {solveCtx && (solveCtx.dummyRow !== null || solveCtx.dummyCol !== null) && (
                  <div className="flex items-center gap-2 text-yellow-300 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                    <Zap size={14} className="shrink-0" />
                    Problema desbalanceado: se agregó una {solveCtx.dummyCol !== null ? "columna ficticia D*" : "fila ficticia O*"} con costo 0 para balancear. Las asignaciones ficticias no se cuentan en el costo total.
                  </div>
                )}

                {/* Controls */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => { setCurrentStep(-1); setIsPlaying(false); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    ⏮ Inicio
                  </button>
                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    disabled={isFinished}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    {isPlaying ? "⏸ Pausar" : <><Play size={13} /> Reproducir</>}
                  </button>
                  <button
                    onClick={stepForward}
                    disabled={isFinished || isPlaying}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <ChevronRight size={14} /> Paso
                  </button>
                  <button
                    onClick={() => { setCurrentStep(steps.length - 1); setIsPlaying(false); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    ⏭ Final
                  </button>

                  {isFinished && (
                    <div className="flex items-center gap-2 ml-auto text-emerald-400 font-bold text-sm">
                      <CheckCircle2 size={16} /> Solución encontrada
                    </div>
                  )}
                </div>

                {/* Step description */}
                {currentStep >= 0 && (
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {currentStep + 1}
                    </div>
                    <p className="text-emerald-300 text-sm font-medium">
                      {steps[currentStep].description}
                    </p>
                  </div>
                )}

                {/* Allocation table */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                  <h2 className="text-base font-bold text-white mb-5">Tabla de Asignación</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1.5">
                      <thead>
                        <tr>
                          <th className="w-16"></th>
                          {Array.from({ length: ctx.cols }, (_, c) => (
                            <th key={c} className={`text-xs font-bold uppercase pb-1 ${c === ctx.dummyCol ? "text-yellow-400/70" : "text-blue-400"}`}>
                              <div className="flex flex-col items-center">
                                <span>{c === ctx.dummyCol ? "D*" : `D${c + 1}`}</span>
                                {currentStep >= 0 && steps[currentStep].v?.[c] !== undefined && (
                                  <span className="text-[10px] text-yellow-500 mt-1">v={steps[currentStep].v[c]}</span>
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="text-xs text-emerald-400 font-bold uppercase pb-1">Oferta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: ctx.rows }, (_, r) => (
                          <tr key={r}>
                            <td className={`text-xs font-bold text-right pr-2 ${r === ctx.dummyRow ? "text-yellow-400/70" : "text-emerald-400"}`}>
                              <div className="flex flex-row items-center justify-end gap-2">
                                {currentStep >= 0 && steps[currentStep].u?.[r] !== undefined && (
                                  <span className="text-[10px] text-yellow-500">u={steps[currentStep].u[r]}</span>
                                )}
                                <span>{r === ctx.dummyRow ? "O*" : `O${r + 1}`}</span>
                              </div>
                            </td>
                            {Array.from({ length: ctx.cols }, (_, c) => {
                              const state = getCellState(r, c);
                              const allocation = getCellAllocation(r, c);
                              const isDummy = r === ctx.dummyRow || c === ctx.dummyCol;
                              const step = currentStep >= 0 ? steps[currentStep] : null;
                              const isInLoop = step?.loop?.some(l => l.row === r && l.col === c);
                              const loopIndex = step?.loop?.findIndex(l => l.row === r && l.col === c);

                              return (
                                <td key={c} className="p-0">
                                  <div
                                    className={`
                                      relative rounded-xl p-2 min-w-[60px] min-h-[56px] flex flex-col items-center justify-center transition-all duration-500
                                      ${isDummy ? "opacity-50" : ""}
                                      ${state === "active" ? "bg-emerald-500/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30 scale-105" : ""}
                                      ${isInLoop ? "border-2 border-yellow-500 bg-yellow-500/10" : ""}
                                      ${state === "done" && !isDummy && !isInLoop ? "bg-blue-500/10 border border-blue-500/30" : ""}
                                      ${state === "done" && isDummy && !isInLoop ? "bg-yellow-500/10 border border-yellow-500/20" : ""}
                                      ${state === "idle" && !isInLoop ? "bg-slate-800/60 border border-slate-700/50" : ""}
                                    `}
                                  >
                                    {isInLoop && (
                                      <div className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-lg z-10">
                                        {loopIndex! % 2 === 0 ? "+" : "-"}
                                      </div>
                                    )}
                                    <span className="absolute top-1 right-1.5 text-[10px] text-slate-500 font-mono">{ctx.costs[r][c]}</span>
                                    {allocation !== null ? (
                                      <span className={`text-base font-bold ${state === "active" ? "text-emerald-300" : isDummy ? "text-yellow-300/70" : "text-blue-300"}`}>
                                        {allocation}
                                      </span>
                                    ) : (
                                      <span className="text-slate-700 text-xl">—</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="text-center">
                              <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${currentSupply[r] === 0 ? "bg-slate-700 text-slate-500 line-through" : r === ctx.dummyRow ? "bg-yellow-900/30 text-yellow-400/70" : "bg-emerald-900/40 text-emerald-400"}`}>
                                {currentSupply[r]}
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td className="text-xs text-blue-400 font-bold text-right pr-2">Demanda</td>
                          {Array.from({ length: ctx.cols }, (_, c) => (
                            <td key={c} className="text-center pt-1">
                              <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${currentDemand[c] === 0 ? "bg-slate-700 text-slate-500 line-through" : c === ctx.dummyCol ? "bg-yellow-900/30 text-yellow-400/70" : "bg-blue-900/40 text-blue-400"}`}>
                                {currentDemand[c]}
                              </span>
                            </td>
                          ))}
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final summary */}
                {isFinished && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="text-emerald-500" size={18} /> Solución Final
                    </h2>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {finalAllocations.map((a, i) => {
                        const isDummy = a.row === ctx.dummyRow || a.col === ctx.dummyCol;
                        const rowLabel = a.row === ctx.dummyRow ? "O*" : `O${a.row + 1}`;
                        const colLabel = a.col === ctx.dummyCol ? "D*" : `D${a.col + 1}`;
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between border rounded-xl px-4 py-2.5 ${isDummy ? "bg-yellow-900/20 border-yellow-500/20 opacity-60" : "bg-slate-800/60 border-white/5"}`}
                          >
                            <span className="text-slate-400 text-sm">
                              {rowLabel} → {colLabel}
                              {isDummy && <span className="ml-1 text-yellow-400/70 text-xs">(ficticio)</span>}
                            </span>
                            <div className="text-right">
                              <span className="text-white font-bold text-sm">{a.value} u.</span>
                              {!isDummy && (
                                <>
                                  <span className="text-slate-500 text-xs ml-2">× {ctx.costs[a.row][a.col]}</span>
                                  <span className="text-yellow-400 text-sm font-bold ml-2">= {a.value * ctx.costs[a.row][a.col]}</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-500/30 rounded-2xl px-5 py-4">
                      <span className="text-emerald-300 font-bold text-base">Costo Total (BFS)</span>
                      <span className="text-emerald-400 font-black text-2xl">
                        {computeTotalCost(finalAllocations, ctx.costs, ctx.dummyRow, ctx.dummyCol)}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-3">
                      * Este es el costo de la solución básica factible inicial. Para optimizar, aplica el método MODI o la regla de la piedra angular.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Empty result state */}
            {tab === "result" && steps.length === 0 && (
              <div className="flex flex-col items-center justify-center h-96 text-slate-500 gap-4">
                <Grid3x3 size={64} className="opacity-20" />
                <p className="italic text-lg">Configura la tabla y presiona "Resolver"</p>
                <button
                  onClick={() => setTab("config")}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <SkipForward size={14} /> Ir a configuración
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Northwest;
