import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  Upload,
  Download,
  Trash2,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  X,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Zap,
  Trophy,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

type NodeType = {
  id: number;
  x: number;
  y: number;
  label: string;
};

type EdgeType = {
  from: number;
  to: number;
  type: "directed";
  weight: number;
};

type CalcMode = "max" | "min";

interface ResultData {
  mode: CalcMode;
  pathNodes: string[];
  pathEdges: EdgeType[];
  totalWeight: number;
  isConnected: boolean;
  nodeDistances: Record<number, number>;
  allNodes: NodeType[];
}

/* ─────────────────────────────────────────────
   VALIDACIONES COMPARTIDAS
   Devuelve un string de error o null si todo OK
───────────────────────────────────────────── */
function validateGraph(
  nodes: NodeType[],
  edges: EdgeType[],
  mode: "min" | "max"
): string | null {

  // 1. Grafo vacío
  if (nodes.length === 0) return "El grafo no tiene nodos. Crea al menos 2 nodos y conecta\u00adlos.";
  if (edges.length === 0) return "El grafo no tiene aristas. Conecta los nodos antes de calcular.";

  // 2. Mínimo 2 nodos para que tenga sentido un camino
  if (nodes.length < 2)
    return "Se necesitan al menos 2 nodos para calcular un camino.";

  // 3. Nodos aislados (sin ninguna arista, ni entrante ni saliente)
  const isolatedNodes = nodes.filter(
    (n) => !edges.some((e) => e.from === n.id || e.to === n.id)
  );
  if (isolatedNodes.length > 0) {
    const labels = isolatedNodes.map((n) => `"${n.label}"`).join(", ");
    return `Los siguientes nodos están aislados (sin aristas): ${labels}.\nElimínalos o conéctalos antes de calcular.`;
  }

  // 4. Aristas duplicadas (misma dirección, mismo par de nodos)
  const edgeSet = new Set<string>();
  for (const e of edges) {
    const key = `${e.from}->${e.to}`;
    if (edgeSet.has(key)) {
      const fromNode = nodes.find((n) => n.id === e.from);
      const toNode   = nodes.find((n) => n.id === e.to);
      return `Existe más de una arista de "${fromNode?.label}" a "${toNode?.label}".\nElimina las aristas duplicadas; Dijkstra no maneja multigrafos.`;
    }
    edgeSet.add(key);
  }

  // 5. Pesos negativos (solo para Minimizar — Dijkstra clásico)
  if (mode === "min") {
    const negEdge = edges.find((e) => e.weight < 0);
    if (negEdge) {
      const fromNode = nodes.find((n) => n.id === negEdge.from);
      const toNode   = nodes.find((n) => n.id === negEdge.to);
      return `La arista de "${fromNode?.label}" a "${toNode?.label}" tiene peso negativo (${negEdge.weight}).\nDijkstra clásico requiere pesos ≥ 0. Usa Bellman-Ford para pesos negativos.`;
    }
  }

  // 6. Self-loops: advertencia (no bloquean, pero los ignoramos en el camino)
  // — no se bloquea, solo se informa en el resultado

  // 7. Nodo inicio: exactamente uno sin aristas entrantes
  //    (excluyendo self-loops para esta detección)
  const realEdges = edges.filter((e) => e.from !== e.to);
  const startNodes = nodes.filter(
    (n) => !realEdges.some((e) => e.to === n.id)
  );
  const endNodes = nodes.filter(
    (n) => !realEdges.some((e) => e.from === n.id)
  );

  if (startNodes.length === 0)
    return "No se encontró un nodo de inicio (todos tienen aristas entrantes). El grafo posiblemente tiene ciclos.";

  if (startNodes.length > 1) {
    const labels = startNodes.map((n) => `"${n.label}"`).join(", ");
    return `Hay ${startNodes.length} nodos sin aristas entrantes: ${labels}.\nEl grafo debe tener exactamente UN nodo de inicio (sin aristas entrantes).`;
  }

  if (endNodes.length === 0)
    return "No se encontró un nodo destino (todos tienen aristas salientes). El grafo posiblemente tiene ciclos.";

  if (endNodes.length > 1) {
    const labels = endNodes.map((n) => `"${n.label}"`).join(", ");
    return `Hay ${endNodes.length} nodos sin aristas salientes: ${labels}.\nEl grafo debe tener exactamente UN nodo destino (sin aristas salientes).`;
  }

  // 8. El nodo inicio y fin no pueden ser el mismo
  if (startNodes[0].id === endNodes[0].id)
    return `El nodo "${startNodes[0].label}" es a la vez inicio y destino.\nRevisa las conexiones del grafo.`;

  return null; // ✅ todo OK
}

const Dijkstra = () => {
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [tempConnection, setTempConnection] = useState<{
    from: NodeType;
    to: NodeType;
  } | null>(null);
  const [weightInput, setWeightInput] = useState<string>("1");

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showHelp, setShowHelp] = useState(false);

  const [editingNode, setEditingNode] = useState<NodeType | null>(null);
  const [nodeNameInput, setNodeNameInput] = useState("");
  const [editingEdge, setEditingEdge] = useState<EdgeType | null>(null);
  const [edgeValueInput, setEdgeValueInput] = useState("");
  const [edgeMenuPosition, setEdgeMenuPosition] = useState({ x: 100, y: 100 });
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);

  // Resultado en modal flotante
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showDistances, setShowDistances] = useState(false);

  // Para highlight en canvas sin panel inferior
  const [calcMode, setCalcMode] = useState<CalcMode | null>(null);
  const [resultPathEdges, setResultPathEdges] = useState<number[]>([]);

  // Error modal
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Contador global de IDs para evitar duplicados al borrar
  const nodeIdCounter = useRef(0);

  /* ---------- MEDIR CONTENEDOR ---------- */
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  /* ---------- DRAGGING ---------- */
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (draggingNodeId === null || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setNodes((prev) =>
        prev.map((node) =>
          node.id === draggingNodeId
            ? { ...node, x: e.clientX - rect.left, y: e.clientY - rect.top }
            : node
        )
      );
    };
    const stop = () => setDraggingNodeId(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [draggingNodeId]);

  /* ---------- PERSISTENCIA ---------- */
  useEffect(() => {
    const saved = localStorage.getItem("grafo_dijkstra");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loadedNodes: NodeType[] = parsed.nodes || [];
        setNodes(loadedNodes);
        setEdges(parsed.edges || []);
        if (loadedNodes.length > 0) {
          nodeIdCounter.current = Math.max(...loadedNodes.map((n) => n.id));
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("grafo_dijkstra", JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  /* ---------- HELPERS ---------- */
  const detectNodeAtPosition = (x: number, y: number): NodeType | null => {
    for (const node of nodes) {
      const d = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (d <= 24) return node;
    }
    return null;
  };

  const clearNetworkMetrics = () => {
    setCalcMode(null);
    setResultPathEdges([]);
  };

  // Cuenta self-loops del grafo actual
  const selfLoopCount = edges.filter((e) => e.from === e.to).length;

  /* ---------- CANVAS CLICK ---------- */
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (showMenu) {
      setShowMenu(false);
      setSelectedNode(null);
      setTempConnection(null);
      setWeightInput("1");
      return;
    }
    if (editingNode) { setEditingNode(null); setNodeNameInput(""); return; }
    if (editingEdge) { setEditingEdge(null); setEdgeValueInput(""); return; }

    const rect = containerRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const clicked = detectNodeAtPosition(clickX, clickY);

    if (clicked) {
      handleNodeClick(clicked);
    } else {
      nodeIdCounter.current += 1;
      const newNode: NodeType = {
        id: nodeIdCounter.current,
        x: clickX,
        y: clickY,
        label: String.fromCharCode(65 + (nodes.length % 26)),
      };
      setNodes((prev) => [...prev, newNode]);
    }
  };

  /* ---------- NODE CLICK ---------- */
  const handleNodeClick = (node: NodeType) => {
    if (!selectedNode) {
      setSelectedNode(node);
    } else {
      if (selectedNode.id === node.id) { setSelectedNode(null); return; }
      setTempConnection({ from: selectedNode, to: node });
      setMenuPosition({ x: node.x + 30, y: node.y });
      setShowMenu(true);
      setSelectedNode(null);
      clearNetworkMetrics();
    }
  };

  const handleNodeRightClick = (e: React.MouseEvent, node: NodeType) => {
    e.preventDefault();
    setEditingNode(node);
    setNodeNameInput(node.label);
  };

  const handleEdgeRightClick = (e: React.MouseEvent, edge: EdgeType) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = Math.min(e.clientX - rect.left, rect.width - 260);
      const y = Math.min(e.clientY - rect.top, rect.height - 220);
      setEdgeMenuPosition({ x: Math.max(0, x), y: Math.max(0, y) });
    }
    setEditingEdge(edge);
    setEdgeValueInput(edge.weight.toString());
  };

  const handleConfirmNodeName = () => {
    if (!editingNode || nodeNameInput.trim() === "") return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNode.id ? { ...n, label: nodeNameInput.trim() } : n
      )
    );
    setEditingNode(null);
    setNodeNameInput("");
    clearNetworkMetrics();
  };

  const handleConfirmEdgeValue = () => {
    if (!editingEdge || edgeValueInput.trim() === "") return;
    const newWeight = Number(edgeValueInput.trim());
    if (isNaN(newWeight)) return;
    setEdges((prev) =>
      prev.map((edge) =>
        edge.from === editingEdge.from && edge.to === editingEdge.to
          ? { ...edge, weight: newWeight }
          : edge
      )
    );
    setEditingEdge(null);
    setEdgeValueInput("");
    clearNetworkMetrics();
  };

  const deleteEdge = (index: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== index));
    clearNetworkMetrics();
  };

  const deleteNode = (nodeId: number) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId));
    clearNetworkMetrics();
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowMenu(false);
    setTempConnection(null);
    nodeIdCounter.current = 0;
    localStorage.removeItem("grafo_dijkstra");
    clearNetworkMetrics();
    setShowResult(false);
    setResultData(null);
  };

  const createEdge = () => {
    if (!tempConnection) return;
    if (tempConnection.from.id === tempConnection.to.id) {
      // Permitir self-loop pero avisar que no cuenta para el camino
      const finalWeight = weightInput === "" ? 1 : Number(weightInput);
      setEdges((prev) => [
        ...prev,
        { from: tempConnection.from.id, to: tempConnection.to.id, type: "directed", weight: finalWeight },
      ]);
      setShowMenu(false);
      setTempConnection(null);
      setWeightInput("1");
      clearNetworkMetrics();
      return;
    }

    // Verificar arista duplicada antes de crear
    const alreadyExists = edges.some(
      (e) => e.from === tempConnection.from.id && e.to === tempConnection.to.id
    );
    if (alreadyExists) {
      setErrorMsg(
        `Ya existe una arista de "${tempConnection.from.label}" a "${tempConnection.to.label}".\n` +
        `Dijkstra no permite aristas paralelas. Edita el peso de la existente con clic derecho.`
      );
      setShowMenu(false);
      setTempConnection(null);
      setWeightInput("1");
      return;
    }

    const finalWeight = weightInput === "" ? 1 : Number(weightInput);
    setEdges((prev) => [
      ...prev,
      { from: tempConnection.from.id, to: tempConnection.to.id, type: "directed", weight: finalWeight },
    ]);
    setShowMenu(false);
    setTempConnection(null);
    setWeightInput("1");
    clearNetworkMetrics();
  };

  /* ---------- EXPORTAR / IMPORTAR ---------- */
  const handleExportGraph = () => {
    const fileName = prompt("Introduce el nombre del grafo:");
    if (!fileName?.trim()) return;
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.trim() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportGraph = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          if (data.nodes.length > 0)
            nodeIdCounter.current = Math.max(...data.nodes.map((n: NodeType) => n.id));
        }
      } catch {}
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  /* ---------- ALGORITMOS ---------- */
  const buildResult = (
    mode: CalcMode,
    pathEdgeIndices: number[],
    distances: Record<number, number>,
    isConnected: boolean
  ): ResultData => {
    const pathEdgeObjects = pathEdgeIndices
      .map((i) => edges[i])
      .filter((e): e is EdgeType => Boolean(e));

    const pathNodeLabels: string[] = [];
    pathEdgeObjects.forEach((edge) => {
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      if (from && to) {
        if (pathNodeLabels.length === 0) pathNodeLabels.push(from.label);
        pathNodeLabels.push(to.label);
      }
    });

    return {
      mode,
      pathNodes: pathNodeLabels,
      pathEdges: pathEdgeObjects,
      totalWeight: pathEdgeObjects.reduce((s, e) => s + e.weight, 0),
      isConnected,
      nodeDistances: distances,
      allNodes: nodes,
    };
  };

  const minimizeShortestPath = () => {
    // ── VALIDACIÓN UNIFICADA ──
    const err = validateGraph(nodes, edges, "min");
    if (err) { setErrorMsg(err); return; }

    // Trabajar solo con aristas reales (sin self-loops para el algoritmo)
    const realEdges = edges.filter((e) => e.from !== e.to);
    const startNode = nodes.filter((n) => !realEdges.some((e) => e.to === n.id))[0];
    const endNode   = nodes.filter((n) => !realEdges.some((e) => e.from === n.id))[0];

    const distances: Record<number, number> = {};
    const previous: Record<number, number | null> = {};
    const unvisited = new Set<number>();

    nodes.forEach((n) => {
      distances[n.id] = n.id === startNode.id ? 0 : Infinity;
      previous[n.id] = null;
      unvisited.add(n.id);
    });

    while (unvisited.size > 0) {
      let current: number | null = null;
      let minDist = Infinity;
      unvisited.forEach((id) => {
        if (distances[id] < minDist) { minDist = distances[id]; current = id; }
      });
      if (current === null || distances[current] === Infinity) break;
      if (current === endNode.id) break;
      unvisited.delete(current);
      // Solo aristas reales
      realEdges.forEach((edge) => {
        if (edge.from === current && unvisited.has(edge.to)) {
          const alt = distances[current!] + edge.weight;
          if (alt < distances[edge.to]) {
            distances[edge.to] = alt;
            previous[edge.to] = current;
          }
        }
      });
    }

    const isConnected = Number.isFinite(distances[endNode.id]);
    const path: number[] = [];
    let curr: number | null = endNode.id;
    const seen = new Set<number>();
    while (curr !== null) {
      if (seen.has(curr)) break;
      seen.add(curr);
      path.unshift(curr);
      curr = previous[curr];
    }

    // Reconstruir índices usando TODAS las aristas (edges[]), no solo realEdges
    const pathEdgeIds: number[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const idx = edges.findIndex((e) => e.from === path[i] && e.to === path[i + 1]);
      if (idx !== -1) pathEdgeIds.push(idx);
    }

    setCalcMode("min");
    setResultPathEdges(pathEdgeIds);
    setResultData(buildResult("min", pathEdgeIds, distances, isConnected));
    setShowBreakdown(true);
    setShowDistances(false);
    setShowResult(true);
  };

  const maximizeLongestPath = () => {
    // ── VALIDACIÓN UNIFICADA ──
    const err = validateGraph(nodes, edges, "max");
    if (err) { setErrorMsg(err); return; }

    const realEdges = edges.filter((e) => e.from !== e.to);
    const startNode = nodes.filter((n) => !realEdges.some((e) => e.to === n.id))[0];
    const endNode   = nodes.filter((n) => !realEdges.some((e) => e.from === n.id))[0];

    // Kahn's topological sort + cycle detection (sobre aristas reales)
    const inDegree: Record<number, number> = {};
    nodes.forEach((n) => { inDegree[n.id] = 0; });
    realEdges.forEach((e) => { inDegree[e.to] = (inDegree[e.to] || 0) + 1; });
    const q = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const topoOrder: number[] = [];
    const queue = [...q];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      topoOrder.push(curr);
      realEdges.forEach((e) => {
        if (e.from === curr) {
          inDegree[e.to]--;
          if (inDegree[e.to] === 0) queue.push(e.to);
        }
      });
    }
    if (topoOrder.length !== nodes.length) {
      setErrorMsg(
        "El grafo contiene ciclos. El camino más largo (Maximizar) solo puede calcularse en grafos\n" +
        "acíclicos dirigidos (DAG). Elimina los ciclos e intenta de nuevo."
      );
      return;
    }

    const distances: Record<number, number> = {};
    const previous: Record<number, number | null> = {};
    nodes.forEach((n) => {
      distances[n.id] = n.id === startNode.id ? 0 : -Infinity;
      previous[n.id] = null;
    });
    for (const curr of topoOrder) {
      if (!Number.isFinite(distances[curr])) continue;
      realEdges.forEach((edge) => {
        if (edge.from === curr) {
          const alt = distances[curr] + edge.weight;
          if (alt > distances[edge.to]) {
            distances[edge.to] = alt;
            previous[edge.to] = curr;
          }
        }
      });
    }

    const isConnected = Number.isFinite(distances[endNode.id]);
    const path: number[] = [];
    let curr: number | null = endNode.id;
    const seen = new Set<number>();
    while (curr !== null) {
      if (seen.has(curr)) break;
      seen.add(curr);
      path.unshift(curr);
      curr = previous[curr];
    }

    const pathEdgeIds: number[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const idx = edges.findIndex((e) => e.from === path[i] && e.to === path[i + 1]);
      if (idx !== -1) pathEdgeIds.push(idx);
    }

    setCalcMode("max");
    setResultPathEdges(pathEdgeIds);
    setResultData(buildResult("max", pathEdgeIds, distances, isConnected));
    setShowBreakdown(true);
    setShowDistances(false);
    setShowResult(true);
  };

  /* ---------- COLORES DE ARISTAS ---------- */
  const getEdgeStyle = (index: number) => {
    const isPath = resultPathEdges.includes(index);
    if (!calcMode) return { color: "#94a3b8", width: 3, opacity: 1 };
    if (calcMode === "min") {
      if (isPath) return { color: "#10b981", width: 5, opacity: 1 };
      return { color: "#94a3b8", width: 2, opacity: 0.25 };
    }
    if (calcMode === "max") {
      if (isPath) return { color: "#ef4444", width: 5, opacity: 1 };
      return { color: "#94a3b8", width: 2, opacity: 0.25 };
    }
    return { color: "#94a3b8", width: 3, opacity: 1 };
  };

  /* ---------- RENDER ---------- */
  const isMin = resultData?.mode === "min";
  const accent = isMin ? "#10b981" : "#ef4444";

  return (
    <Layout>
      <style>{`
        /* ── RESULT MODAL ── */
        .result-overlay {
          position: fixed; inset: 0; z-index: 60;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
          padding: 1.5rem;
          animation: rFadeIn 0.28s ease;
        }
        .result-modal {
          background: #0d1117;
          border-radius: 24px;
          width: 100%; max-width: 660px; max-height: 88vh;
          overflow-y: auto;
          box-shadow: 0 30px 80px rgba(0,0,0,0.7);
          animation: rSlideUp 0.32s cubic-bezier(0.16,1,0.3,1);
        }
        .result-modal.is-min { border: 1px solid rgba(16,185,129,0.3); box-shadow: 0 0 60px rgba(16,185,129,0.1), 0 30px 80px rgba(0,0,0,0.7); }
        .result-modal.is-max { border: 1px solid rgba(239,68,68,0.3);  box-shadow: 0 0 60px rgba(239,68,68,0.1), 0 30px 80px rgba(0,0,0,0.7); }
        @keyframes rFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes rSlideUp { from { opacity:0; transform:translateY(20px) scale(0.97) } to { opacity:1; transform:none } }

        .result-header { padding: 1.75rem 2rem 1.25rem; border-bottom: 1px solid #1f2937; display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .result-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.8rem; border-radius:999px; font-size:0.62rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:0.5rem; }
        .result-badge.min { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.35); color:#10b981; }
        .result-badge.max { background:rgba(239,68,68,0.1);   border:1px solid rgba(239,68,68,0.3);   color:#ef4444; }
        .result-title { font-size:1.35rem; font-weight:800; color:white; line-height:1.2; letter-spacing:-0.02em; }

        .result-body { padding:1.5rem 2rem; display:flex; flex-direction:column; gap:1.25rem; }

        .stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:0.7rem; }
        .stat-card { background:#111827; border:1px solid #1f2937; border-radius:14px; padding:0.9rem; text-align:center; }
        .stat-val { font-size:1.7rem; font-weight:900; font-variant-numeric:tabular-nums; line-height:1; margin-bottom:0.25rem; }
        .stat-lbl { font-size:0.58rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#64748b; }

        .path-row { display:flex; flex-wrap:wrap; align-items:center; gap:0.4rem; padding:1rem 1.25rem; background:#111827; border:1px solid #1f2937; border-radius:14px; }
        .path-node { padding:0.3rem 0.85rem; border-radius:999px; font-size:0.9rem; font-weight:800; font-family:'JetBrains Mono','Fira Code',monospace; }
        .path-node.min { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); color:#86efac; }
        .path-node.max { background:rgba(239,68,68,0.1);   border:1px solid rgba(239,68,68,0.22);   color:#fca5a5; }
        .path-arrow.min { color:#10b981; font-size:0.85rem; }
        .path-arrow.max { color:#ef4444; font-size:0.85rem; }

        .weight-bar { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.35rem; border-radius:14px; }
        .weight-bar.min { background:linear-gradient(135deg,#111827,#0d1f17); border:1px solid rgba(16,185,129,0.22); }
        .weight-bar.max { background:linear-gradient(135deg,#111827,#1c0f0f); border:1px solid rgba(239,68,68,0.22); }
        .weight-num { font-size:2.5rem; font-weight:900; font-variant-numeric:tabular-nums; }

        .alert-disc { display:flex; align-items:center; gap:0.7rem; padding:0.8rem 1rem; background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.22); border-radius:12px; font-size:0.75rem; color:#fca5a5; }
        .alert-warn { display:flex; align-items:center; gap:0.7rem; padding:0.8rem 1rem; background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.22); border-radius:12px; font-size:0.75rem; color:#fcd34d; }

        .acc-header { display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.9rem; border-radius:10px; cursor:pointer; transition:background 0.15s,border-color 0.15s; user-select:none; border:1px solid transparent; }
        .acc-header.min { background:rgba(16,185,129,0.05); border-color:rgba(16,185,129,0.14); }
        .acc-header.min:hover { background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.28); }
        .acc-header.dist { background:rgba(99,102,241,0.05); border-color:rgba(99,102,241,0.14); }
        .acc-header.dist:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.28); }
        .acc-header.max { background:rgba(239,68,68,0.05); border-color:rgba(239,68,68,0.14); }
        .acc-header.max:hover { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.28); }
        .acc-left { display:flex; align-items:center; gap:0.45rem; }
        .acc-count { font-size:0.58rem; font-weight:800; padding:0.13rem 0.45rem; border-radius:999px; }
        .acc-count.min  { background:rgba(16,185,129,0.15);  color:#10b981; }
        .acc-count.max  { background:rgba(239,68,68,0.12);   color:#ef4444; }
        .acc-count.dist { background:rgba(99,102,241,0.15);  color:#818cf8; }
        .acc-chevron { transition:transform 0.25s cubic-bezier(0.4,0,0.2,1); color:#475569; flex-shrink:0; }
        .acc-chevron.open { transform:rotate(180deg); }
        .acc-body { overflow:hidden; transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,margin-top 0.25s; }
        .acc-body.closed { max-height:0!important; opacity:0; pointer-events:none; margin-top:0; }
        .acc-body.open { opacity:1; margin-top:0.5rem; }

        .edge-item { display:flex; align-items:center; justify-content:space-between; padding:0.55rem 0.8rem; border-radius:9px; font-size:0.78rem; font-weight:600; font-family:'JetBrains Mono','Fira Code',monospace; }
        .edge-item.min { background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.18); color:#86efac; }
        .edge-item.max { background:rgba(239,68,68,0.06);  border:1px solid rgba(239,68,68,0.15);  color:#fca5a5; }
        .edge-badge { font-size:0.65rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:6px; }
        .edge-badge.min { background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); }
        .edge-badge.max { background:rgba(239,68,68,0.1);   color:#ef4444; border:1px solid rgba(239,68,68,0.22); }

        .dist-item { display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; border-radius:9px; font-size:0.78rem; font-family:'JetBrains Mono','Fira Code',monospace; background:#111827; border:1px solid #1f2937; }
        .dist-val { font-weight:800; color:#818cf8; }

        .result-footer { padding:1rem 2rem 1.5rem; display:flex; justify-content:flex-end; gap:0.7rem; border-top:1px solid #1f2937; }
        .btn-close  { background:#1f2937; border:1px solid #374151; color:#94a3b8; padding:0.55rem 1.3rem; border-radius:9px; font-size:0.72rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; transition:0.18s; }
        .btn-close:hover { background:#374151; color:white; }
        .btn-reset  { border:none; color:white; padding:0.55rem 1.3rem; border-radius:9px; font-size:0.72rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; transition:0.18s; }
        .btn-reset.min { background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 0 14px rgba(16,185,129,0.18); }
        .btn-reset.max { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 0 14px rgba(239,68,68,0.18); }
        .btn-reset:hover { transform:translateY(-1px); }

        .result-modal::-webkit-scrollbar { width:4px; }
        .result-modal::-webkit-scrollbar-track { background:transparent; }
        .result-modal::-webkit-scrollbar-thumb { background:#1f2937; border-radius:4px; }

        .node-selected { outline: 3px solid #06b6d4; outline-offset: 3px; }

        /* Error modal */
        .error-overlay { position:fixed; inset:0; z-index:70; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); padding:1.5rem; animation:rFadeIn 0.2s ease; }
        .error-modal { background:#0d1117; border:1px solid rgba(239,68,68,0.4); border-radius:20px; width:100%; max-width:480px; padding:2rem; box-shadow:0 0 50px rgba(239,68,68,0.12),0 20px 60px rgba(0,0,0,0.6); animation:rSlideUp 0.28s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">

        {/* HEADER */}
        <div className="w-full bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Algoritmo de Dijkstra</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white"
              >
                <Upload size={16} /><span>Importar</span>
              </button>
              <button
                onClick={handleExportGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white"
              >
                <Download size={16} /><span>Exportar</span>
              </button>
              <button
                onClick={clearGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 rounded-md transition-all hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} /><span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex gap-8">

          {/* PANEL LATERAL */}
          <aside className="w-64 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Estadísticas</h2>
              <div className="space-y-2 text-slate-300 text-sm">
                <div className="flex justify-between"><span>Nodos</span><span className="font-bold text-white">{nodes.length}</span></div>
                <div className="flex justify-between"><span>Aristas</span><span className="font-bold text-white">{edges.length}</span></div>
                {selfLoopCount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Auto-lazos</span>
                    <span className="font-bold">{selfLoopCount}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Algoritmo</h2>
              <div className="space-y-3">
                <button
                  onClick={minimizeShortestPath}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition-all"
                >
                  <TrendingDown size={17} /><span>Minimizar</span>
                </button>
                <button
                  onClick={maximizeLongestPath}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow transition-all"
                >
                  <TrendingUp size={17} /><span>Maximizar</span>
                </button>
                {resultData && (
                  <button
                    onClick={() => setShowResult(true)}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-all"
                  >
                    <Trophy size={13} className="text-yellow-400" />
                    Ver resultado
                  </button>
                )}
              </div>
            </div>

            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportGraph} />

            <div className="text-xs text-slate-400 leading-relaxed p-2 space-y-1">
              <p className="font-semibold text-slate-300 mb-1">Instrucciones</p>
              <p>• Clic en lienzo → crear nodo</p>
              <p>• Clic nodo + clic nodo → crear arista</p>
              <p>• Clic derecho nodo → editar / eliminar</p>
              <p>• Clic derecho arista → editar / eliminar</p>
              <p>• Cambios guardados automáticamente</p>
            </div>
          </aside>

          {/* CANVAS */}
          <div className="flex-1">
            <div
              ref={containerRef}
              onClick={handleCanvasClick}
              className="relative rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
              style={{ height: "600px", background: "radial-gradient(circle at center,#0f172a 0%,#020617 100%)" }}
            >
              {/* Grid */}
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "linear-gradient(to right,white 1px,transparent 1px),linear-gradient(to bottom,white 1px,transparent 1px)", backgroundSize: "40px 40px" }}
              />

              {/* SVG aristas */}
              <svg width={canvasSize.width} height={canvasSize.height} className="absolute top-0 left-0" style={{ pointerEvents: "none" }}>
                <defs>
                  <marker id="arr-normal" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#ffffff" />
                  </marker>
                  <marker id="arr-hover" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#a7f3d0" />
                  </marker>
                  <marker id="arr-min" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
                  </marker>
                  <marker id="arr-max" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
                  </marker>
                  <marker id="arr-small" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L5,3 z" fill="#ffffff" />
                  </marker>
                </defs>

                {edges.map((edge, index) => {
                  const from = nodes.find((n) => n.id === edge.from);
                  const to = nodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;

                  const style = getEdgeStyle(index);
                  const isHovered = hoveredEdgeIndex === index;
                  const isPath = resultPathEdges.includes(index);
                  const isSelfLoop = edge.from === edge.to;

                  let strokeColor = isHovered ? "#a7f3d0" : style.color;
                  // Self-loops siempre en amarillo ámbar para distinguirlos
                  if (isSelfLoop) strokeColor = isHovered ? "#fcd34d" : "#f59e0b";

                  const strokeWidth = isHovered ? 5 : style.width;
                  const opacity = hoveredEdgeIndex !== null && !isHovered ? Math.min(style.opacity, 0.2) : style.opacity;

                  let markerEnd = "url(#arr-normal)";
                  if (isHovered) markerEnd = "url(#arr-hover)";
                  else if (isPath && calcMode === "min") markerEnd = "url(#arr-min)";
                  else if (isPath && calcMode === "max") markerEnd = "url(#arr-max)";

                  // Self-loop
                  if (isSelfLoop) {
                    const lH = 60, lW = 50, nr = 24;
                    const sX = from.x - 6, sY = from.y - nr;
                    const c1X = from.x - lW, c1Y = from.y - lH;
                    const c2X = from.x + lW, c2Y = from.y - lH;
                    const eX = from.x + 6, eY = from.y - nr;
                    const d = `M ${sX} ${sY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${eX} ${eY}`;
                    return (
                      <g key={index} onContextMenu={(e) => { e.preventDefault(); handleEdgeRightClick(e, edge); }}
                        onMouseEnter={() => setHoveredEdgeIndex(index)} onMouseLeave={() => setHoveredEdgeIndex(null)}
                        style={{ pointerEvents: "auto", cursor: "pointer", opacity }}>
                        <path d={d} fill="none" stroke="#fff" strokeWidth={20} strokeOpacity={0.001} />
                        <path d={d} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="5,3" markerEnd="url(#arr-small)" style={{ transition: "all 0.3s" }} />
                        <text x={from.x} y={from.y - lH - 8} fill={isHovered ? "#fcd34d" : "#f59e0b"} fontSize="12" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: "auto", cursor: "pointer", transition: "all 0.3s" }}>
                          {edge.weight}
                        </text>
                        {/* Etiqueta "loop" */}
                        <text x={from.x} y={from.y - lH - 22} fill="#f59e0b" fontSize="8" fontWeight="700" textAnchor="middle" opacity="0.7">auto</text>
                      </g>
                    );
                  }

                  const hasBidirectional = edges.some((e) => e.from === edge.to && e.to === edge.from);
                  const midX = (from.x + to.x) / 2;
                  const midY = (from.y + to.y) / 2;
                  let pathD: string, textX = midX, textY = midY - 10;

                  if (hasBidirectional) {
                    const dx = to.x - from.x, dy = to.y - from.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const offset = 40;
                    const offX = (-dy / len) * offset, offY = (dx / len) * offset;
                    pathD = `M ${from.x} ${from.y} Q ${midX + offX} ${midY + offY} ${to.x} ${to.y}`;
                    textX = midX + offX;
                    textY = midY + offY - 10;
                  } else {
                    pathD = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
                  }

                  return (
                    <g key={index} onContextMenu={(e) => { e.preventDefault(); handleEdgeRightClick(e, edge); }}
                      onMouseEnter={() => setHoveredEdgeIndex(index)} onMouseLeave={() => setHoveredEdgeIndex(null)}
                      style={{ pointerEvents: "auto", cursor: "pointer", opacity }}>
                      <path d={pathD} fill="none" stroke="#fff" strokeWidth={20} strokeOpacity={0.001} />
                      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} markerEnd={markerEnd} style={{ transition: "all 0.3s" }} />
                      <text x={textX} y={textY} fill={isHovered ? "#a7f3d0" : "#f8fafc"} fontSize="12" fontWeight="bold" textAnchor="middle"
                        onContextMenu={(e) => handleEdgeRightClick(e, edge)}
                        style={{ pointerEvents: "auto", cursor: "pointer", transition: "all 0.3s" }}>
                        {edge.weight}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Panel peso nueva arista */}
              {showMenu && (
                <div className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-2xl shadow-2xl z-50 w-56 border border-white/10"
                  style={{ left: menuPosition.x, top: menuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Peso de la arista</p>
                  {tempConnection && tempConnection.from.id === tempConnection.to.id && (
                    <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle size={10} /> Auto-lazo: no cuenta en el camino
                    </p>
                  )}
                  <input type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createEdge()}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-3 text-white" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={createEdge} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-bold transition">Crear</button>
                    <button onClick={() => { setShowMenu(false); setSelectedNode(null); setTempConnection(null); setWeightInput("1"); }}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl text-sm font-bold transition">Cancelar</button>
                  </div>
                </div>
              )}

              {/* NODOS */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const dist = resultData?.nodeDistances?.[node.id];
                const showDist = calcMode && dist !== undefined && Number.isFinite(dist);
                return (
                  <div key={node.id}>
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); setDraggingNodeId(node.id); }}
                      onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
                      onContextMenu={(e) => handleNodeRightClick(e, node)}
                      className={`absolute w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer transition-all duration-200 shadow-2xl hover:scale-110 select-none ${isSelected ? "node-selected scale-110" : ""}`}
                      style={{
                        left: node.x - 24, top: node.y - 24,
                        background: isSelected
                          ? "linear-gradient(135deg,#06b6d4,#3b82f6)"
                          : "linear-gradient(135deg,#6366f1,#06b6d4)",
                        boxShadow: isSelected
                          ? "0 0 24px rgba(6,182,212,0.8)"
                          : "0 0 18px rgba(99,102,241,0.5)",
                        color: "white",
                      }}
                    >
                      {node.label}
                    </div>
                    {showDist && (
                      <div className="absolute text-[10px] font-bold bg-slate-900/90 border border-slate-700 text-white px-1.5 py-0.5 rounded-md whitespace-nowrap pointer-events-none"
                        style={{ left: node.x - 26, top: node.y - 42 }}>
                        {calcMode === "min" ? "min" : "max"}: {dist}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Panel editar nodo */}
              {editingNode && (
                <div className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-2xl shadow-2xl z-50 w-56 border border-white/10"
                  style={{ left: editingNode.x + 32, top: editingNode.y }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Editar nodo</p>
                  <input type="text" value={nodeNameInput} onChange={(e) => setNodeNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmNodeName()}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-3 text-white" autoFocus />
                  <div className="flex gap-2 mb-2">
                    <button onClick={handleConfirmNodeName} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-bold transition">Guardar</button>
                    <button onClick={() => { setEditingNode(null); setNodeNameInput(""); }} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl text-sm font-bold transition">Cancelar</button>
                  </div>
                  <button onClick={() => { deleteNode(editingNode.id); setEditingNode(null); setNodeNameInput(""); }}
                    className="w-full bg-red-600/80 hover:bg-red-600 py-2 rounded-xl text-sm font-bold transition">Eliminar nodo</button>
                </div>
              )}

              {/* Panel editar arista */}
              {editingEdge && (
                <div className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-2xl shadow-2xl z-50 w-56 border border-white/10"
                  style={{ left: edgeMenuPosition.x, top: edgeMenuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Editar arista</p>
                  {editingEdge.from === editingEdge.to && (
                    <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle size={10} /> Auto-lazo (no cuenta en el camino)
                    </p>
                  )}
                  <input type="number" value={edgeValueInput} onChange={(e) => setEdgeValueInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmEdgeValue()}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-3 text-white" autoFocus />
                  <div className="flex gap-2 mb-2">
                    <button onClick={handleConfirmEdgeValue} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-sm font-bold transition">Guardar</button>
                    <button onClick={() => { setEditingEdge(null); setEdgeValueInput(""); }} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl text-sm font-bold transition">Cancelar</button>
                  </div>
                  <button onClick={() => { deleteEdge(edges.findIndex((e) => e.from === editingEdge.from && e.to === editingEdge.to)); setEditingEdge(null); setEdgeValueInput(""); }}
                    className="w-full bg-red-600/80 hover:bg-red-600 py-2 rounded-xl text-sm font-bold transition">Eliminar arista</button>
                </div>
              )}

              {/* Indicador nodo seleccionado */}
              {selectedNode && !showMenu && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyan-500/90 text-white text-xs font-black tracking-widest px-4 py-2 rounded-full animate-pulse shadow-xl pointer-events-none">
                  NODO "{selectedNode.label}" SELECCIONADO — HAZ CLIC EN OTRO NODO
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ERROR MODAL ── */}
      {errorMsg && (
        <div className="error-overlay" onClick={() => setErrorMsg(null)}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-red-400 mb-1 uppercase tracking-wider">Restricción del grafo</div>
                <div className="text-white font-semibold text-base leading-snug">No se puede calcular</div>
              </div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-5">
              {errorMsg.split("\n").map((line, i) => (
                <p key={i} className={`text-sm ${i === 0 ? "text-slate-200 font-medium" : "text-slate-400 mt-1 text-xs"}`}>{line}</p>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMsg(null)}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RESULTADO FLOTANTE ── */}
      {showResult && resultData && (
        <div className="result-overlay" onClick={() => setShowResult(false)}>
          <div
            className={`result-modal ${resultData.mode === "min" ? "is-min" : "is-max"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="result-header">
              <div>
                <div className={`result-badge ${resultData.mode}`}>
                  {resultData.mode === "min"
                    ? <><Zap size={9} /> Dijkstra — Camino más corto</>
                    : <><Trophy size={9} /> DAG DP — Camino más largo</>}
                </div>
                <div className="result-title">
                  {resultData.mode === "min" ? "Ruta Óptima Mínima" : "Ruta Óptima Máxima"}
                </div>
                <div className="mt-2">
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    padding: "0.18rem 0.55rem", borderRadius: "999px",
                    color: resultData.isConnected ? "#10b981" : "#ef4444",
                    background: resultData.isConnected ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${resultData.isConnected ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}>
                    {resultData.isConnected
                      ? <><CheckCircle2 size={9} /> Camino encontrado</>
                      : <><XCircle size={9} /> Sin camino disponible</>}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowResult(false)}
                className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-full mt-1 flex-shrink-0">
                <X size={19} />
              </button>
            </div>

            {/* Body */}
            <div className="result-body">

              {/* Stats */}
              <div className="stat-row">
                <div className="stat-card">
                  <div className="stat-val" style={{ color: accent }}>{resultData.totalWeight}</div>
                  <div className="stat-lbl">Peso Total</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val text-cyan-400">{resultData.pathNodes.length}</div>
                  <div className="stat-lbl">Nodos en ruta</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val text-slate-400">{resultData.pathEdges.length}</div>
                  <div className="stat-lbl">Aristas usadas</div>
                </div>
              </div>

              {/* Alerta si no conectado */}
              {!resultData.isConnected && (
                <div className="alert-disc">
                  <XCircle size={15} className="flex-shrink-0" />
                  <span>No existe un camino entre el nodo origen y el nodo destino. Verifica que el grafo esté conectado correctamente.</span>
                </div>
              )}

              {/* Visualización del camino */}
              {resultData.pathNodes.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.5rem" }}>
                    Secuencia del camino
                  </div>
                  <div className="path-row">
                    {resultData.pathNodes.map((label, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {i > 0 && <ArrowRight size={13} className={`path-arrow ${resultData.mode}`} />}
                        <span className={`path-node ${resultData.mode}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Desglose aristas — accordion */}
              {resultData.pathEdges.length > 0 && (
                <div>
                  <div className={`acc-header ${resultData.mode}`} onClick={() => setShowBreakdown((v) => !v)}>
                    <div className="acc-left">
                      <CheckCircle2 size={12} style={{ color: accent }} />
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: accent }}>
                        Desglose de aristas
                      </span>
                      <span className={`acc-count ${resultData.mode}`}>{resultData.pathEdges.length}</span>
                    </div>
                    <ChevronDown size={14} className={`acc-chevron ${showBreakdown ? "open" : ""}`} />
                  </div>
                  <div className={`acc-body ${showBreakdown ? "open" : "closed"}`}
                    style={{ maxHeight: showBreakdown ? `${resultData.pathEdges.length * 50 + 16}px` : "0" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {resultData.pathEdges.map((edge, i) => {
                        const fromNode = resultData.allNodes.find((n) => n.id === edge.from);
                        const toNode = resultData.allNodes.find((n) => n.id === edge.to);
                        return (
                          <div key={i} className={`edge-item ${resultData.mode}`}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ color: "#475569", fontSize: "0.6rem", minWidth: "1.2rem" }}>{i + 1}.</span>
                              <span>{fromNode?.label ?? "?"}</span>
                              <ArrowRight size={11} style={{ color: accent }} />
                              <span>{toNode?.label ?? "?"}</span>
                            </div>
                            <span className={`edge-badge ${resultData.mode}`}>w = {edge.weight}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Distancias acumuladas — accordion */}
              {Object.keys(resultData.nodeDistances).length > 0 && (
                <div>
                  <div className="acc-header dist" onClick={() => setShowDistances((v) => !v)}>
                    <div className="acc-left">
                      <Zap size={12} style={{ color: "#818cf8" }} />
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#818cf8" }}>
                        Distancias acumuladas por nodo
                      </span>
                      <span className="acc-count dist">{Object.keys(resultData.nodeDistances).length}</span>
                    </div>
                    <ChevronDown size={14} className={`acc-chevron ${showDistances ? "open" : ""}`} />
                  </div>
                  <div className={`acc-body ${showDistances ? "open" : "closed"}`}
                    style={{ maxHeight: showDistances ? `${Object.keys(resultData.nodeDistances).length * 46 + 16}px` : "0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.35rem" }}>
                      {resultData.allNodes.map((node) => {
                        const d = resultData.nodeDistances[node.id];
                        const finite = Number.isFinite(d);
                        return (
                          <div key={node.id} className="dist-item">
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Nodo {node.label}</span>
                            <span className="dist-val">{finite ? d : "∞"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Peso total resaltado */}
              <div className={`weight-bar ${resultData.mode}`}>
                <div>
                  <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", marginBottom: "0.2rem" }}>
                    {resultData.mode === "min" ? "Costo Mínimo Total" : "Costo Máximo Total"}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    {resultData.pathEdges.length} arista{resultData.pathEdges.length !== 1 ? "s" : ""} · {resultData.pathNodes.length} nodo{resultData.pathNodes.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="weight-num" style={{ color: accent }}>{resultData.totalWeight}</div>
              </div>
            </div>

            {/* Footer */}
            <div className="result-footer">
              <button className="btn-close" onClick={() => setShowResult(false)}>Cerrar</button>
              <button
                className={`btn-reset ${resultData.mode}`}
                onClick={() => {
                  setShowResult(false);
                  setCalcMode(null);
                  setResultPathEdges([]);
                  setResultData(null);
                }}
              >
                Limpiar resultado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN AYUDA */}
      <div className="fixed bottom-6 right-6 z-40">
        <button onClick={() => setShowHelp(true)}
          className="w-12 h-12 rounded-full border-2 border-slate-500 text-slate-400 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-all hover:scale-110 hover:bg-slate-500 hover:text-slate-900 shadow-lg"
          title="Ver guía de uso">
          <HelpCircle size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* MODAL AYUDA — COMPLETO Y DETALLADO */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-full">
              <X size={18} />
            </button>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <HelpCircle size={19} className="text-slate-300" />
              Guía completa — Algoritmo de Dijkstra
            </h2>
            <div className="text-slate-300 text-sm space-y-5 max-h-[70vh] overflow-y-auto pr-2">

              {/* Qué es */}
              <div>
                <h3 className="text-base font-bold text-white mb-1">¿Qué es Dijkstra?</h3>
                <p>El <strong>Algoritmo de Dijkstra</strong> es un método clásico de teoría de grafos para encontrar el camino más corto (menor costo acumulado) desde un nodo origen hacia un nodo destino en un grafo dirigido con pesos no negativos.</p>
                <p className="mt-1">Para el camino más largo se usa <strong>Programación Dinámica en orden topológico</strong>, aplicable solo en <strong>DAGs</strong> (grafos dirigidos sin ciclos).</p>
              </div>

              {/* Nodos */}
              <div>
                <h3 className="text-base font-bold text-white mb-2">Nodos</h3>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Representan</span><span>Puntos, ciudades, etapas o estados del sistema</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Creación</span><span>Clic en zona vacía del lienzo</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Nombre</span><span>Asignado automáticamente (A, B, C…). Editar con clic derecho</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Mover</span><span>Arrastrar con clic sostenido</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Eliminar</span><span>Clic derecho → "Eliminar nodo" (también borra sus aristas)</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Nodo inicio</span><span>El único sin aristas <em>entrantes</em> (no tiene flechas que lleguen a él)</span></div>
                  <div className="flex gap-2"><span className="text-cyan-400 font-bold w-28">Nodo destino</span><span>El único sin aristas <em>salientes</em> (no tiene flechas que salgan de él)</span></div>
                </div>
              </div>

              {/* Aristas */}
              <div>
                <h3 className="text-base font-bold text-white mb-2">Aristas</h3>
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Tipo</span><span>Siempre <strong>dirigidas</strong> (con flecha → indicando dirección del flujo)</span></div>
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Peso</span><span>Número entero o decimal. Representa costo, distancia, tiempo, etc.</span></div>
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Creación</span><span>Clic en nodo A → clic en nodo B → ingresar peso → "Crear"</span></div>
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Editar peso</span><span>Clic derecho sobre la arista o su etiqueta de peso</span></div>
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Eliminar</span><span>Clic derecho → "Eliminar arista"</span></div>
                  <div className="flex gap-2"><span className="text-indigo-400 font-bold w-28">Bidireccional</span><span>Crear A→B y B→A por separado; se dibujan curvadas para distinguirlas</span></div>
                  <div className="flex gap-2"><span className="text-amber-400 font-bold w-28">Auto-lazo</span><span>Clic en el mismo nodo dos veces. Se dibuja en <span className="text-amber-400">naranja punteado</span> y <strong>no se cuenta</strong> en el camino</span></div>
                </div>
              </div>

              {/* Restricciones */}
              <div>
                <h3 className="text-base font-bold text-white mb-2">Restricciones del grafo</h3>
                <div className="space-y-2">
                  {[
                    { color: "text-red-400", label: "Pesos negativos (Minimizar)", desc: "Dijkstra clásico no funciona con pesos < 0. Edita las aristas para usar valores ≥ 0." },
                    { color: "text-red-400", label: "Nodos aislados", desc: "Todo nodo debe estar conectado con al menos una arista. Los nodos sin conexión se bloquean." },
                    { color: "text-red-400", label: "Aristas paralelas", desc: "No se permiten dos aristas en la misma dirección entre el mismo par de nodos." },
                    { color: "text-red-400", label: "Múltiples nodos de inicio/destino", desc: "Debe haber exactamente UN nodo sin aristas entrantes y UNO sin aristas salientes." },
                    { color: "text-red-400", label: "Ciclos (Maximizar)", desc: "El camino más largo solo funciona en DAGs. Si hay ciclos el algoritmo no se ejecuta." },
                    { color: "text-amber-400", label: "Auto-lazos", desc: "Se permiten visualmente pero se ignoran completamente en el cálculo del camino." },
                  ].map((r, i) => (
                    <div key={i} className="flex gap-2 bg-slate-800/40 border border-slate-700/60 rounded-lg p-2.5">
                      <XCircle size={13} className={`${r.color} flex-shrink-0 mt-0.5`} />
                      <div><span className={`font-bold ${r.color}`}>{r.label}:</span> <span className="text-slate-400">{r.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingDown size={14} className="text-emerald-400" />
                    <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider">Minimizar</span>
                  </div>
                  <p className="text-xs text-slate-300">Dijkstra clásico. Encuentra la ruta con menor suma de pesos. El camino se resalta en <strong className="text-emerald-400">verde</strong>. No permite pesos negativos.</p>
                </div>
                <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp size={14} className="text-red-400" />
                    <span className="font-bold text-red-400 text-xs uppercase tracking-wider">Maximizar</span>
                  </div>
                  <p className="text-xs text-slate-300">DP topológico en DAG. Encuentra la ruta con mayor suma de pesos. El camino se resalta en <strong className="text-red-400">rojo</strong>. Solo funciona sin ciclos.</p>
                </div>
              </div>

              {/* Resultado */}
              <div>
                <h3 className="text-base font-bold text-white mb-1">Resultado modal</h3>
                <p className="text-xs text-slate-400">Muestra: <strong className="text-slate-300">peso total</strong> del camino, <strong className="text-slate-300">secuencia de nodos</strong>, <strong className="text-slate-300">desglose de aristas</strong> (con peso individual) y <strong className="text-slate-300">distancias acumuladas</strong> desde el origen hacia cada nodo (∞ = inalcanzable). El camino queda resaltado en el lienzo hasta que limpies el resultado.</p>
              </div>

            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setShowHelp(false)} className="px-5 py-2 bg-slate-200 hover:bg-white text-slate-900 font-semibold rounded-lg transition-colors text-sm">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dijkstra;