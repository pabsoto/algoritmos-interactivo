import Navbar from "@/components/Navbar";
import React, { useState, useRef, ChangeEvent } from "react";
import {
  HelpCircle,
  X,
  MousePointer2,
  GitBranch,
  Edit3,
  Trash2,
  Info,
  SkipForward,
  Trophy,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";

// --- TIPOS ---
interface NodeData {
  id: string;
  x: number;
  y: number;
  label: string;
  color?: string;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  weight: number;
  state?: "default" | "evaluating" | "included" | "rejected";
}

interface SolutionData {
  includedEdges: EdgeData[];
  rejectedEdges: EdgeData[];
  totalWeight: number;
  isConnected: boolean;
  optMode: "min" | "max";
  nodeCount: number;
}

type ToolMode = "NODO" | "ARISTA" | "Editar" | "Eliminar";
type OptimizationMode = "min" | "max";

export default function KruskalSection() {
  // --- ESTADOS ---
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [mode, setMode] = useState<ToolMode>("NODO");
  const [optMode, setOptMode] = useState<OptimizationMode>("min");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const hasMoved = useRef(false);

  const [EditaringElement, setEditaringElement] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [tempElement, setTempElement] = useState<NodeData | EdgeData | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // --- NUEVOS ESTADOS ---
  const [showSolution, setShowSolution] = useState(false);
  const [solutionData, setSolutionData] = useState<SolutionData | null>(null);
  const skipRef = useRef(false);

  // --- LÓGICA DE INTERACCIÓN ---

  const handleSvgClick = (e: React.MouseEvent) => {
    if (mode !== "NODO" || isAnimating || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode: NodeData = {
      id: `node-${Date.now()}`,
      x,
      y,
      label: String.fromCharCode(65 + (nodes.length % 26)),
      color: "#3b82f6",
    };

    setTempElement(newNode);
    setEditaringElement(newNode);
    setIsPanelOpen(true);
  };

  const handleNodeClick = (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();

    if (isAnimating || hasMoved.current) {
      hasMoved.current = false;
      return;
    }

    if (mode === "Eliminar") {
      setNodes(nodes.filter((n) => n.id !== node.id));
      setEdges(edges.filter((edge) => edge.source !== node.id && edge.target !== node.id));
    } else if (mode === "Editar") {
      setEditaringElement(node);
      setIsPanelOpen(true);
    } else if (mode === "ARISTA") {
      if (!selectedNodeId) {
        setSelectedNodeId(node.id);
      } else if (selectedNodeId !== node.id) {
        const exists = edges.some(
          (edge) =>
            (edge.source === selectedNodeId && edge.target === node.id) ||
            (edge.source === node.id && edge.target === selectedNodeId)
        );

        if (!exists) {
          const newEdge: EdgeData = {
            id: `edge-${Date.now()}`,
            source: selectedNodeId,
            target: node.id,
            weight: 0,
            state: "default",
          };
          setTempElement(newEdge);
          setEditaringElement(newEdge);
          setIsPanelOpen(true);
        }
        setSelectedNodeId(null);
      }
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, edge: EdgeData) => {
    e.stopPropagation();
    if (isAnimating) return;

    if (mode === "Eliminar") {
      setEdges(edges.filter((e) => e.id !== edge.id));
    } else if (mode === "Editar") {
      const newWeightStr = prompt("Ingrese el nuevo peso:", edge.weight.toString());
      const newWeight = parseFloat(newWeightStr || "");
      if (!isNaN(newWeight)) {
        setEdges(edges.map((e) => (e.id === edge.id ? { ...e, weight: newWeight } : e)));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();
    if (isAnimating) return;
    if (mode === "Editar" || mode === "NODO" || mode === "ARISTA") {
      setDraggingNodeId(node.id);
      hasMoved.current = false;
    }
  };

  const draggingNodeRef = useRef<SVGGElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !draggingNodeRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draggingNodeRef.current.setAttribute("transform", `translate(${x}, ${y})`);
  };

  const handleMouseUp = () => {
    if (draggingNodeId && draggingNodeRef.current) {
      const transform = draggingNodeRef.current.getAttribute("transform");
      const coords = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (coords) {
        const newX = parseFloat(coords[1]);
        const newY = parseFloat(coords[2]);
        setNodes((prev) =>
          prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
        );
      }
    }
    setDraggingNodeId(null);
    draggingNodeRef.current = null;
  };

  // --- EXPORTAR E IMPORTAR JSON ---
  const handleExport = () => {
    const fileName = prompt("Ingresa el nombre para tu archivo:", "grafo-kruskal");
    if (fileName === null || fileName.trim() === "") return;

    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const finalName = fileName.endsWith(".json") ? fileName : `${fileName}.json`;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.nodes && json.edges) {
          setNodes(json.nodes);
          setEdges(json.edges.map((edge: any) => ({ ...edge, state: "default" })));
        }
      } catch (err) {
        alert("Error al leer el archivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- ALGORITMO DE KRUSKAL ---
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, skipRef.current ? 0 : ms));

  const runKruskal = async () => {
    if (nodes.length === 0 || edges.length === 0) return;
    setIsAnimating(true);
    setShowSolution(false);
    setSolutionData(null);
    setSelectedNodeId(null);
    skipRef.current = false;

    let localEdges: EdgeData[] = edges.map((e) => ({ ...e, state: "default" }));
    setEdges(localEdges);
    await sleep(500);

    const sortedEdges = [...localEdges].sort((a, b) => {
      const weightA = Number(a.weight);
      const weightB = Number(b.weight);
      return optMode === "min" ? weightA - weightB : weightB - weightA;
    });

    const parent: Record<string, string> = {};
    nodes.forEach((n) => (parent[n.id] = n.id));

    const find = (i: string): string => {
      if (parent[i] === i) return i;
      return (parent[i] = find(parent[i]));
    };

    const union = (i: string, j: string) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    let edgesIncluded = 0;
    const includedEdgeIds: string[] = [];

    for (const edge of sortedEdges) {
      if (edgesIncluded >= nodes.length - 1) {
        localEdges = localEdges.map((e) =>
          e.id === edge.id ? { ...e, state: "rejected" } : e
        );
        setEdges([...localEdges]);
        continue;
      }

      localEdges = localEdges.map((e) =>
        e.id === edge.id ? { ...e, state: "evaluating" } : e
      );
      setEdges([...localEdges]);
      await sleep(600);

      const rootSource = find(edge.source);
      const rootTarget = find(edge.target);

      if (rootSource !== rootTarget) {
        union(rootSource, rootTarget);
        localEdges = localEdges.map((e) =>
          e.id === edge.id ? { ...e, state: "included" } : e
        );
        includedEdgeIds.push(edge.id);
        edgesIncluded++;
      } else {
        localEdges = localEdges.map((e) =>
          e.id === edge.id ? { ...e, state: "rejected" } : e
        );
      }

      setEdges([...localEdges]);
      await sleep(400);
    }

    // Calcular datos de solución
    const finalIncluded = localEdges.filter((e) => e.state === "included");
    const finalRejected = localEdges.filter((e) => e.state === "rejected");
    const totalWeight = finalIncluded.reduce((sum, e) => sum + Number(e.weight), 0);
    const isConnected = edgesIncluded >= nodes.length - 1;

    setSolutionData({
      includedEdges: finalIncluded,
      rejectedEdges: finalRejected,
      totalWeight,
      isConnected,
      optMode,
      nodeCount: nodes.length,
    });

    setIsAnimating(false);
    skipRef.current = false;
    setShowSolution(true);
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setShowSolution(false);
    setSolutionData(null);
  };

  // --- HELPERS VISUALES ---
  const getNodeById = (id: string) => nodes.find((n) => n.id === id);

  const getEdgeStyle = (state: EdgeData["state"]) => {
    switch (state) {
      case "evaluating":
        return { stroke: "#eab308", strokeWidth: 4, opacity: 1 };
      case "included":
        return { stroke: "#22c55e", strokeWidth: 5, opacity: 1 };
      case "rejected":
        return { stroke: "#ef4444", strokeWidth: 2, opacity: 0.2, strokeDasharray: "4" };
      default:
        return { stroke: "#9ca3af", strokeWidth: 2, opacity: 1 };
    }
  };

  // --- Matriz de Adyacencia ---
  const generateMatrix = () => {
    const size = nodes.length;

    interface MatrixCell {
      weight: number | string;
      isMst: boolean;
    }

    const matrix: MatrixCell[][] = Array(size)
      .fill(null)
      .map(() => Array(size).fill(null).map(() => ({ weight: "∞", isMst: false })));

    const nodeToIndex = new Map(nodes.map((n, i) => [n.id, i]));

    edges.forEach((edge) => {
      const i = nodeToIndex.get(edge.source);
      const j = nodeToIndex.get(edge.target);

      if (i !== undefined && j !== undefined) {
        const isMst = edge.state === "included";
        const weightValue = edge.weight ?? 0;
        matrix[i][j] = { weight: weightValue, isMst };
        matrix[j][i] = { weight: weightValue, isMst };
      }
    });

    for (let i = 0; i < size; i++) {
      matrix[i][i] = { weight: 0, isMst: false };
    }

    return matrix;
  };

  // --- Obtener label de nodo por id ---
  const getNodeLabel = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="kruskal-wrapper">
      <style>{`
      :root {
        --bg-main: #0b0e14;
        --bg-card: #111827;
        --accent-cyan: #00d2ff;
        --accent-green: #10b981;
        --accent-red: #ef4444;
        --accent-yellow: #fbbf24;
        --border-color: #1f2937;
        --text-dim: #94a3b8;
        --grid-opacity: 0.05;
      }

      .kruskal-wrapper {
        background-color: var(--bg-main);
        color: white;
        min-height: 100vh;
        padding: 1.5rem 2.5rem;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .kruskal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
      }

      .nav-actions { display: flex; gap: 1rem; }
      
      .btn-nav {
        background: #1f2937;
        border: 1px solid var(--border-color);
        color: var(--text-dim);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: 0.2s;
      }
      .btn-nav:hover { color: white; background: #374151; }

      .kruskal-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 2rem;
        margin-left: 8%;
        margin-right: 4%;
      }

      .panel-stack { display: flex; flex-direction: column; gap: 1.5rem; }
      
      .card-premium {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
      }

      .card-tag {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        color: var(--text-dim);
        margin-bottom: 1rem;
        letter-spacing: 1.5px;
        display: block;
      }

      .btn-solve-neon {
        width: 100%;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 1rem;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        transition: 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
      .btn-solve-neon:hover { 
        transform: translateY(-2px);
        box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
      }
      .btn-solve-neon:disabled {
        opacity: 0.8;
        transform: none;
        cursor: not-allowed;
      }

      .canvas-viewport {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        position: relative;
        overflow: hidden;
        height: 650px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      }

      .node-neon { transition: all 0.3s; cursor: pointer; }
      .node-neon:hover { filter: url(#glow-cyan); }
      .edge-tube { transition: all 0.5s ease; stroke-linecap: round; }

      /* --- SKIP BUTTON --- */
      .btn-skip {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.4);
        color: #fbbf24;
        padding: 0.5rem 1rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: 0.2s;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .btn-skip:hover {
        background: rgba(251, 191, 36, 0.2);
        border-color: #fbbf24;
      }

      /* --- SOLUTION MODAL --- */
      .solution-overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(6px);
        padding: 1.5rem;
        animation: fadeIn 0.3s ease;
      }

      .solution-modal {
        background: #0d1117;
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 24px;
        width: 100%;
        max-width: 640px;
        max-height: 88vh;
        overflow-y: auto;
        box-shadow: 0 0 60px rgba(16, 185, 129, 0.12), 0 30px 60px rgba(0,0,0,0.6);
        animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .solution-modal.max-mode {
        border-color: rgba(249, 115, 22, 0.3);
        box-shadow: 0 0 60px rgba(249, 115, 22, 0.12), 0 30px 60px rgba(0,0,0,0.6);
      }

      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes slideUp { 
        from { opacity: 0; transform: translateY(24px) scale(0.97) } 
        to { opacity: 1; transform: translateY(0) scale(1) } 
      }

      .solution-header {
        padding: 1.75rem 2rem 1.25rem;
        border-bottom: 1px solid #1f2937;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .solution-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.65rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 0.6rem;
      }

      .solution-badge.min {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #10b981;
      }

      .solution-badge.max {
        background: rgba(249, 115, 22, 0.15);
        border: 1px solid rgba(249, 115, 22, 0.4);
        color: #f97316;
      }

      .solution-title {
        font-size: 1.4rem;
        font-weight: 800;
        color: white;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      .solution-body {
        padding: 1.5rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      /* Stat Cards */
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }

      .stat-card {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 14px;
        padding: 1rem;
        text-align: center;
      }

      .stat-value {
        font-size: 1.75rem;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        margin-bottom: 0.3rem;
      }

      .stat-label {
        font-size: 0.6rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #64748b;
      }

      /* Edge Table */
      .edge-section-title {
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #64748b;
        margin-bottom: 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .edge-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .edge-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.6rem 0.85rem;
        border-radius: 10px;
        font-size: 0.8rem;
        font-weight: 600;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        transition: background 0.15s;
      }

      .edge-item.included {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.2);
        color: #86efac;
      }

      .edge-item.rejected {
        background: rgba(239, 68, 68, 0.05);
        border: 1px solid rgba(239, 68, 68, 0.15);
        color: #64748b;
        text-decoration: line-through;
        opacity: 0.7;
      }

      .edge-nodes {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .edge-node-badge {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        font-weight: 900;
        background: rgba(255,255,255,0.07);
        color: white;
        text-decoration: none;
      }

      .edge-arrow {
        font-size: 0.7rem;
        color: #374151;
      }

      .edge-weight-badge {
        font-size: 0.7rem;
        font-weight: 800;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
      }

      .edge-weight-badge.included {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.3);
        text-decoration: none;
      }

      .edge-weight-badge.rejected {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.2);
      }

      .reason-tag {
        font-size: 0.55rem;
        color: #475569;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-decoration: none;
      }

      /* Total Weight display */
      .total-weight-bar {
        background: linear-gradient(135deg, #111827 0%, #0d1f17 100%);
        border: 1px solid rgba(16, 185, 129, 0.25);
        border-radius: 14px;
        padding: 1.1rem 1.4rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .total-weight-bar.max {
        background: linear-gradient(135deg, #111827 0%, #1a1207 100%);
        border-color: rgba(249, 115, 22, 0.25);
      }

      /* Alert banner */
      .alert-disconnected {
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
        display: flex;
        align-items: center;
        gap: 0.7rem;
        font-size: 0.75rem;
        color: #fca5a5;
        font-weight: 500;
      }

      .solution-footer {
        padding: 1rem 2rem 1.5rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        border-top: 1px solid #1f2937;
      }

      .btn-solution-close {
        background: #1f2937;
        border: 1px solid #374151;
        color: #94a3b8;
        padding: 0.6rem 1.4rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
        transition: 0.2s;
      }
      .btn-solution-close:hover { background: #374151; color: white; }

      .btn-solution-reset {
        background: linear-gradient(135deg, #10b981, #059669);
        border: none;
        color: white;
        padding: 0.6rem 1.4rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
        transition: 0.2s;
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.2);
      }
      .btn-solution-reset.max {
        background: linear-gradient(135deg, #f97316, #ea580c);
        box-shadow: 0 0 16px rgba(249, 115, 22, 0.2);
      }
      .btn-solution-reset:hover { 
        transform: translateY(-1px);
        box-shadow: 0 0 24px rgba(16, 185, 129, 0.35);
      }

      /* Connected status glow */
      .status-connected {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #10b981;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .status-disconnected {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
      }

      /* Scrollbar */
      .solution-modal::-webkit-scrollbar { width: 4px; }
      .solution-modal::-webkit-scrollbar-track { background: transparent; }
      .solution-modal::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
    `}</style>

      <Navbar />

      <header className="kruskal-header">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Algoritmo de Kruskal</h1>
        </div>

        <div className="nav-actions">
          <label className="btn-nav cursor-pointer flex items-center gap-2">
            ↓ Importar
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="btn-nav">↑ Exportar</button>
          <button onClick={clearGraph} className="btn-nav text-red-400">↺ Limpiar</button>
        </div>
      </header>
       <header className="kruskal-header">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Algoritmo de Kruskal</h1>
        </div>

        <div className="nav-actions">
          <label className="btn-nav cursor-pointer flex items-center gap-2">
            ↓ Importar
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="btn-nav">↑ Exportar</button>
          <button onClick={clearGraph} className="btn-nav text-red-400">↺ Limpiar</button>
        </div>
      </header>
      

      <div className="kruskal-layout">
        <aside className="panel-stack">
          {/* ESTADÍSTICAS */}
          <div className="card-premium">
            <span className="card-tag">Estadísticas</span>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">Nodos</span>
              <span className="font-mono font-bold text-cyan-400">{nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">Aristas</span>
              <span className="font-mono font-bold text-cyan-400">{edges.length}</span>
            </div>
          </div>

          {/* HERRAMIENTAS */}
          <div className="card-premium">
            <span className="card-tag">Herramientas</span>
            <div className="grid grid-cols-2 gap-2">
              {["NODO", "ARISTA", "Editar", "Eliminar"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMode(t as ToolMode)}
                  className={`p-2 rounded-lg text-xs font-bold border transition-all ${
                    mode === t
                      ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                      : "bg-slate-800 border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* SELECTOR DE OPTIMIZACIÓN */}
          <div className="card-premium">
            <span className="card-tag">Modo de ejecución</span>
            <div className="flex flex-col gap-3">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setOptMode("min")}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                    optMode === "min"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  MÍNIMO (MST)
                </button>
                <button
                  onClick={() => setOptMode("max")}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                    optMode === "max"
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  MÁXIMO (MaxST)
                </button>
              </div>

              {/* Botón de ejecución */}
              <button
                onClick={runKruskal}
                disabled={isAnimating}
                className={`btn-solve-neon !transition-colors ${
                  optMode === "max"
                    ? "from-orange-500 to-red-600 shadow-orange-500/20"
                    : "from-emerald-500 to-teal-600"
                }`}
              >
                <span className="text-lg">{isAnimating ? "●" : "▷"}</span>
                {isAnimating
                  ? "Procesando..."
                  : `Resolver ${optMode === "min" ? "Mínimo" : "Máximo"}`}
              </button>

              {/* BOTÓN SALTAR ANIMACIÓN — solo visible durante animación */}
              {isAnimating && (
                <button
                  onClick={() => { skipRef.current = true; }}
                  className="btn-skip"
                >
                  <SkipForward size={13} />
                  Saltar animación
                </button>
              )}

              {/* Ver solución de nuevo si ya existe */}
              {!isAnimating && solutionData && (
                <button
                  onClick={() => setShowSolution(true)}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Trophy size={13} className="text-yellow-400" />
                  VER SOLUCIÓN
                </button>
              )}

              <button
                onClick={() => setIsMatrixOpen(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-[10px] font-bold transition-all mt-1 flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
                VER MATRIZ
              </button>
            </div>
          </div>

          <div className="px-4 text-[11px] text-slate-500 leading-relaxed italic">
            Tip: Usa 'ARISTA' para conectar nodos. El algoritmo visualizará el proceso paso a paso con efectos neón.
          </div>
        </aside>

        <main className="canvas-viewport">
          <svg
            ref={svgRef}
            onClick={handleSvgClick}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05" />
              </pattern>
              <filter id="glow-cyan">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-green-line">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {nodes.map((node) => (
                <linearGradient key={`grad-${node.id}`} id={`grad-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={node.color || "#3b82f6"} />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              ))}
              <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#tech-grid)" />

            {/* ARISTAS */}
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              let color = "#ffffff";
              let width = 2;
              let filter = "";

              if (edge.state === "evaluating") { color = "var(--accent-yellow)"; width = 4; }
              if (edge.state === "included") { color = "var(--accent-green)"; width = 6; filter = "url(#glow-green-line)"; }
              if (edge.state === "rejected") { color = "var(--accent-red)"; width = 2; }

              return (
                <g key={edge.id}>
                  <line
                    x1={source.x} y1={source.y}
                    x2={target.x} y2={target.y}
                    stroke={color}
                    strokeWidth={width}
                    filter={filter}
                    className="edge-tube"
                    opacity={edge.state === "default" ? 0.3 : 1}
                  />
                  <g
                    transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`}
                    onClick={(e) => { e.stopPropagation(); setEditaringElement(edge); setIsPanelOpen(true); }}
                    className="cursor-pointer"
                  >
                    <rect x="-14" y="-10" width="28" height="20" rx="6" fill="var(--bg-main)" stroke={color} strokeWidth="1.5" />
                    <text dy="5" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" style={{ userSelect: "none" }}>
                      {edge.weight}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* NODOS */}
            {nodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                ref={draggingNodeId === node.id ? draggingNodeRef : null}
                onClick={(e) => handleNodeClick(e, node)}
                onMouseDown={(e) => handleMouseDown(e, node)}
                className="cursor-grab active:cursor-grabbing"
                style={{
                  transition: draggingNodeId === node.id ? "none" : "transform 0.1s ease-out",
                  pointerEvents: "all",
                }}
              >
                <circle
                  r="30" fill="none"
                  stroke={`url(#grad-${node.id})`}
                  strokeWidth="2"
                  opacity={selectedNodeId === node.id || draggingNodeId === node.id ? "1" : "0.4"}
                  filter="url(#neonGlow)"
                />
                <circle
                  r="22" fill="#111827"
                  stroke={selectedNodeId === node.id || draggingNodeId === node.id ? "white" : `url(#grad-${node.id})`}
                  strokeWidth={selectedNodeId === node.id || draggingNodeId === node.id ? "3" : "2"}
                />
                <circle r="15" cy="-2" fill="url(#nodeGradient)" opacity="0.15" className="pointer-events-none" />
                <text
                  textAnchor="middle" dy="5" fill="white" fontSize="12" fontWeight="900"
                  className="pointer-events-none select-none"
                  style={{ textShadow: "0px 0px 4px rgba(0,0,0,0.8)", userSelect: "none" }}
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>

          {/* PANEL EDICIÓN */}
          {isPanelOpen && EditaringElement && (
            <div className="absolute right-4 top-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-2xl z-[100] animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">
                  {EditaringElement.source
                    ? tempElement ? "Nueva Arista" : "Editar Arista"
                    : tempElement ? "Nuevo Nodo" : "Editar Nodo"}
                </h3>
                <button
                  onClick={() => { setIsPanelOpen(false); setEditaringElement(null); setTempElement(null); }}
                  className="text-slate-500 hover:text-white transition-colors"
                >✕</button>
              </div>

              <div className="space-y-4">
                {EditaringElement.source ? (
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Peso</label>
                    <input
                      type="number"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-all"
                      value={EditaringElement.weight === "" ? "" : EditaringElement.weight}
                      autoFocus
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") { setEditaringElement({ ...EditaringElement, weight: "" }); return; }
                        const parsedVal = parseInt(val);
                        if (isNaN(parsedVal)) return;
                        setEditaringElement({ ...EditaringElement, weight: parsedVal });
                        if (parsedVal > 0) {
                          setEdges((prevEdges) =>
                            prevEdges.map((edge) => edge.id === EditaringElement.id ? { ...edge, weight: parsedVal } : edge)
                          );
                        }
                      }}
                    />
                    <p className="text-[9px] text-slate-600 mt-1 italic">* El peso debe ser un número entero positivo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Etiqueta</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-all"
                        value={EditaringElement.label || ""}
                        autoFocus
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          setEditaringElement({ ...EditaringElement, label: newLabel });
                          setNodes((prevNodes) =>
                            prevNodes.map((node) => node.id === EditaringElement.id ? { ...node, label: newLabel } : node)
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Color Neón</label>
                      <div className="flex gap-3 items-center bg-slate-900 border border-slate-700 rounded-lg p-2 transition-all focus-within:border-cyan-500">
                        <input
                          type="color"
                          className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-md overflow-hidden"
                          value={EditaringElement.color || "#3b82f6"}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            setEditaringElement({ ...EditaringElement, color: newColor });
                            setNodes((prevNodes) =>
                              prevNodes.map((node) => node.id === EditaringElement.id ? { ...node, color: newColor } : node)
                            );
                          }}
                        />
                        <span className="text-[11px] font-mono text-slate-400 uppercase">{EditaringElement.color || "#3b82f6"}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={() => {
                      if (EditaringElement.source) {
                        const weightVal = parseInt(EditaringElement.weight);
                        if (isNaN(weightVal) || weightVal <= 0) {
                          alert("¡Atención! El peso debe ser un número mayor a 0.");
                          return;
                        }
                      }
                      if (tempElement) {
                        if (EditaringElement.source) {
                          setEdges((prev) => [...prev, EditaringElement as EdgeData]);
                        } else {
                          setNodes((prev) => [...prev, EditaringElement as NodeData]);
                        }
                      } else {
                        if (EditaringElement.source) {
                          setEdges((prev) => prev.map((e) => e.id === EditaringElement.id ? (EditaringElement as EdgeData) : e));
                        } else {
                          setNodes((prev) => prev.map((n) => n.id === EditaringElement.id ? (EditaringElement as NodeData) : n));
                        }
                      }
                      setIsPanelOpen(false);
                      setEditaringElement(null);
                      setTempElement(null);
                    }}
                    className="w-full bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-400 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                  >
                    {tempElement ? "CREAR ELEMENTO" : "GUARDAR CAMBIOS"}
                  </button>

                  <div className="flex gap-2">
                    {!tempElement && (
                      <button
                        onClick={() => {
                          if (EditaringElement.source) {
                            setEdges((prev) => prev.filter((e) => e.id !== EditaringElement.id));
                          } else {
                            setNodes((prev) => prev.filter((n) => n.id !== EditaringElement.id));
                            setEdges((prev) => prev.filter((e) => e.source !== EditaringElement.id && e.target !== EditaringElement.id));
                          }
                          setIsPanelOpen(false);
                          setEditaringElement(null);
                        }}
                        className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                      >ELIMINAR</button>
                    )}
                    <button
                      onClick={() => { setIsPanelOpen(false); setEditaringElement(null); setTempElement(null); }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                    >CANCELAR</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "ARISTA" && selectedNodeId && (
            <div className="absolute bottom-6 right-8 bg-cyan-500 text-white px-4 py-2 rounded-full text-xs font-black tracking-widest animate-pulse shadow-2xl">
              SISTEMA DE CONEXIÓN ACTIVO
            </div>
          )}
        </main>
      </div>

      {/* ── MATRIZ ─────────────────────────────────────────────── */}
      {isMatrixOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-2xl rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <h3 className="text-cyan-400 text-xs font-black tracking-[0.2em] uppercase">Matriz de Transición</h3>
              </div>
              <button onClick={() => setIsMatrixOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-slate-800 bg-slate-800/30 text-[10px] text-slate-500 italic">Nodos</th>
                    {nodes.map((n) => (
                      <th key={n.id} className="p-2 border border-slate-800 bg-slate-800/30 text-cyan-500 font-mono text-xs">{n.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {generateMatrix().map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 border border-slate-800 bg-slate-900 text-cyan-500 font-mono text-xs text-center font-black">{nodes[i].label}</td>
                      {row.map((cell, j) => (
                        <td key={j} className={`p-3 border border-slate-800 text-center font-mono text-sm transition-all duration-300 ${cell.isMst ? "bg-cyan-400/20 text-cyan-300 shadow-[inset_0_0_15px_rgba(34,211,238,0.4)] border-cyan-500/50" : "text-slate-400"}`}>
                          <span className={cell.isMst ? "drop-shadow-[0_0_5px_#22d3ee] font-bold" : ""}>{cell.weight}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-right">
              <button onClick={() => setIsMatrixOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-all">
                CERRAR TERMINAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SOLUCIÓN ─────────────────────────────────────────────── */}
      {showSolution && solutionData && (
        <div className="solution-overlay" onClick={() => setShowSolution(false)}>
          <div
            className={`solution-modal ${solutionData.optMode === "max" ? "max-mode" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="solution-header">
              <div>
                <div className={`solution-badge ${solutionData.optMode}`}>
                  {solutionData.optMode === "min" ? (
                    <><Zap size={10} /> Árbol de Expansión Mínimo</>
                  ) : (
                    <><Trophy size={10} /> Árbol de Expansión Máximo</>
                  )}
                </div>
                <div className="solution-title">
                  {solutionData.optMode === "min" ? "MST — Solución" : "MaxST — Solución"}
                </div>
                <div className="mt-2">
                  <span className={`status-connected ${!solutionData.isConnected ? "status-disconnected" : ""}`}>
                    {solutionData.isConnected ? (
                      <><CheckCircle2 size={10} /> Grafo Conectado</>
                    ) : (
                      <><XCircle size={10} /> Grafo Desconectado</>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSolution(false)}
                className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-full mt-1 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="solution-body">
              {/* Stats */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: solutionData.optMode === "min" ? "#10b981" : "#f97316" }}>
                    {solutionData.totalWeight}
                  </div>
                  <div className="stat-label">Peso Total</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value text-cyan-400">{solutionData.includedEdges.length}</div>
                  <div className="stat-label">Aristas en árbol</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value text-slate-400">{solutionData.rejectedEdges.length}</div>
                  <div className="stat-label">Aristas Rechazadas</div>
                </div>
              </div>

              {/* Alerta si desconectado */}
              {!solutionData.isConnected && (
                <div className="alert-disconnected">
                  <XCircle size={16} className="text-red-400 flex-shrink-0" />
                  <span>
                    El grafo no está completamente conectado. El algoritmo no pudo formar un árbol que abarque todos los nodos. Revisa si existen nodos aislados.
                  </span>
                </div>
              )}

              {/* Aristas incluidas */}
              {solutionData.includedEdges.length > 0 && (
                <div>
                  <div className="edge-section-title">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    Aristas incluidas en el árbol
                  </div>
                  <div className="edge-list">
                    {solutionData.includedEdges.map((edge, idx) => (
                      <div key={edge.id} className="edge-item included">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 text-[10px] font-mono w-5">{idx + 1}.</span>
                          <div className="edge-nodes">
                            <span className="edge-node-badge">{getNodeLabel(edge.source)}</span>
                            <span className="edge-arrow">——</span>
                            <span className="edge-node-badge">{getNodeLabel(edge.target)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="reason-tag" style={{ textDecoration: "none" }}>sin ciclo</span>
                          <span className="edge-weight-badge included">w = {edge.weight}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aristas rechazadas */}
              {solutionData.rejectedEdges.length > 0 && (
                <div>
                  <div className="edge-section-title">
                    <XCircle size={11} className="text-red-500" />
                    Aristas rechazadas (forman ciclo o no necesarias)
                  </div>
                  <div className="edge-list">
                    {solutionData.rejectedEdges.map((edge, idx) => (
                      <div key={edge.id} className="edge-item rejected">
                        <div className="flex items-center gap-2">
                          <span className="text-red-900 text-[10px] font-mono w-5">{idx + 1}.</span>
                          <div className="edge-nodes">
                            <span className="edge-node-badge">{getNodeLabel(edge.source)}</span>
                            <span className="edge-arrow">——</span>
                            <span className="edge-node-badge">{getNodeLabel(edge.target)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="reason-tag">ciclo/extra</span>
                          <span className="edge-weight-badge rejected">w = {edge.weight}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total weight highlight */}
              <div className={`total-weight-bar ${solutionData.optMode === "max" ? "max" : ""}`}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                    {solutionData.optMode === "min" ? "Costo Mínimo Total" : "Costo Máximo Total"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Suma de los pesos de {solutionData.includedEdges.length} aristas seleccionadas
                  </div>
                </div>
                <div
                  className="text-3xl font-black font-mono"
                  style={{ color: solutionData.optMode === "min" ? "#10b981" : "#f97316" }}
                >
                  {solutionData.totalWeight}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="solution-footer">
              <button className="btn-solution-close" onClick={() => setShowSolution(false)}>
                Cerrar
              </button>
              <button
                className={`btn-solution-reset ${solutionData.optMode === "max" ? "max" : ""}`}
                onClick={() => {
                  setShowSolution(false);
                  setEdges((prev) => prev.map((e) => ({ ...e, state: "default" })));
                  setSolutionData(null);
                }}
              >
                Reiniciar grafo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTÓN FLOTANTE DE AYUDA ─────────────────────────────────────────── */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={() => setShowHelp(true)}
          className="w-14 h-14 rounded-full border-2 border-cyan-500/50 text-cyan-400 flex items-center justify-center bg-slate-900/80 backdrop-blur-md transition-all hover:scale-110 hover:bg-cyan-500 hover:text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] group"
          title="Ver guía de uso"
        >
          <HelpCircle size={28} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      {/* ── MODAL DE GUÍA ────────────────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div
            className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 mb-8">
              <div className="bg-cyan-500/20 p-2 rounded-xl border border-cyan-500/30">
                <Info className="text-cyan-400" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Guía de Uso: Algoritmo de Kruskal</h2>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                  Concepto Fundamental
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  El algoritmo de Kruskal es un proceso "voraz" que busca encontrar el{" "}
                  <b>Árbol de Expansión Mínimo (MST)</b> de un grafo. Conecta todos los nodos
                  usando el menor peso total posible, sin formar ciclos.
                </p>
              </section>

              <section>
                <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                  Herramientas de Construcción
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: <MousePointer2 size={16} className="text-cyan-400" />, title: "Modo NODO", desc: "Haz clic en cualquier espacio vacío del lienzo para crear un nuevo nodo. Se asignará una letra automáticamente." },
                    { icon: <GitBranch size={16} className="text-cyan-400" />, title: "Modo ARISTA", desc: "Selecciona un nodo y luego otro para conectarlos. Se te pedirá ingresar el peso de la conexión." },
                    { icon: <Edit3 size={16} className="text-cyan-400" />, title: "Modo EDITAR", desc: "Arrastra nodos para reposicionarlos o haz clic en aristas y nodos para modificar sus valores." },
                    { icon: <Trash2 size={16} className="text-red-400" />, title: "Modo ELIMINAR", desc: "Haz clic sobre cualquier elemento (nodo o arista) para eliminarlo permanentemente del grafo." },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-white font-bold text-sm">{title}</span></div>
                      <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                  Estados de la Animación
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                    <span className="text-xs text-slate-300"><b>Amarillo:</b> La arista está siendo evaluada por el algoritmo.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-xs text-slate-300"><b>Verde:</b> Arista incluida exitosamente en el árbol (no forma ciclo).</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-0.5 bg-red-500/30 border-t border-dashed border-red-500"></div>
                    <span className="text-xs text-slate-300"><b>Rojo Tenue:</b> Arista rechazada porque formaría un ciclo.</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                  Nuevas Funciones
                </h3>
                <div className="space-y-2">
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <SkipForward size={13} className="text-yellow-400" />
                      <span className="text-white font-bold text-xs">Saltar Animación</span>
                    </div>
                    <p className="text-slate-400 text-xs">Aparece durante la ejecución. Aplica el resultado instantáneamente sin esperar la animación paso a paso.</p>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy size={13} className="text-yellow-400" />
                      <span className="text-white font-bold text-xs">Ventana de Solución</span>
                    </div>
                    <p className="text-slate-400 text-xs">Al terminar la ejecución se abre automáticamente mostrando el peso total, aristas incluidas/rechazadas y estado de conectividad.</p>
                  </div>
                </div>
              </section>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <p className="text-[10px] text-slate-500 italic">Puedes importar grafos guardados desde archivos JSON en el botón superior.</p>
                <button
                  onClick={() => setShowHelp(false)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-6 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}