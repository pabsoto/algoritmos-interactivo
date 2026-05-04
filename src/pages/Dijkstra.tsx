import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { MousePointer2, Upload, Download, Trash2, TrendingDown, TrendingUp, HelpCircle } from "lucide-react";

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

const Dijkstra = () => {
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [tempConnection, setTempConnection] =
    useState<{ from: NodeType; to: NodeType } | null>(null);

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

  const [calcMode, setCalcMode] = useState<'max' | 'min' | null>(null);
  const [resultPathEdges, setResultPathEdges] = useState<number[]>([]);
  const [nodeDistances, setNodeDistances] = useState<Record<number, number> | null>(null);

  const maximizeLongestPath = () => {
    if (nodes.length === 0 || edges.length === 0) {
      alert("Se necesitan nodos y aristas para calcular el camino más largo.");
      return;
    }

    const startNodes = nodes.filter(n => !edges.some(e => e.to === n.id));
    if (startNodes.length === 0) {
      alert("No se encontró un nodo inicial (sin aristas entrantes). El grafo puede tener ciclos.");
      return;
    }
    const startNode = startNodes[0];

    const endNodes = nodes.filter(n => !edges.some(e => e.from === n.id));
    if (endNodes.length === 0) {
      alert("No se encontró un nodo final (sin aristas salientes). El grafo puede tener ciclos.");
      return;
    }
    const endNode = endNodes[0];

    // Topological sort via Kahn's algorithm — also serves as cycle detection
    const inDegree: Record<number, number> = {};
    nodes.forEach(n => { inDegree[n.id] = 0; });
    edges.forEach(e => { inDegree[e.to] = (inDegree[e.to] || 0) + 1; });

    const queue: number[] = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    const topoOrder: number[] = [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      topoOrder.push(curr);
      edges.forEach(e => {
        if (e.from === curr) {
          inDegree[e.to]--;
          if (inDegree[e.to] === 0) queue.push(e.to);
        }
      });
    }

    if (topoOrder.length !== nodes.length) {
      alert("El grafo contiene ciclos. El camino más largo solo se puede calcular en grafos acíclicos dirigidos (DAG).");
      return;
    }

    // Longest path DP in topological order
    const distances: Record<number, number> = {};
    const previous: Record<number, number | null> = {};
    nodes.forEach(n => {
      distances[n.id] = n.id === startNode.id ? 0 : -Infinity;
      previous[n.id] = null;
    });

    for (const curr of topoOrder) {
      if (!Number.isFinite(distances[curr])) continue;
      edges.forEach(edge => {
        if (edge.from === curr) {
          const alt = distances[curr] + edge.weight;
          if (alt > distances[edge.to]) {
            distances[edge.to] = alt;
            previous[edge.to] = curr;
          }
        }
      });
    }

    if (!Number.isFinite(distances[endNode.id])) {
      alert("No existe un camino desde el nodo origen hasta el nodo destino.");
      return;
    }

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
      const edgeIndex = edges.findIndex(e => e.from === path[i] && e.to === path[i + 1]);
      if (edgeIndex !== -1) {
        pathEdgeIds.push(edgeIndex);
      }
    }

    setResultPathEdges(pathEdgeIds);
    setNodeDistances(distances);
    setCalcMode('max');
  };

  const minimizeShortestPath = () => {
    if (nodes.length === 0 || edges.length === 0) {
      alert("Se necesitan nodos y aristas para calcular el camino más corto.");
      return;
    }

    if (edges.some(e => e.weight < 0)) {
      alert("El algoritmo de Dijkstra no soporta pesos negativos. Edita las aristas para usar solo valores positivos.");
      return;
    }

    const startNodes = nodes.filter(n => !edges.some(e => e.to === n.id));
    if (startNodes.length === 0) {
      alert("No se encontró un nodo inicial (sin aristas entrantes).");
      return;
    }
    const startNode = startNodes[0];

    const endNodes = nodes.filter(n => !edges.some(e => e.from === n.id));
    if (endNodes.length === 0) {
      alert("No se encontró un nodo final (sin aristas salientes).");
      return;
    }
    const endNode = endNodes[0];

    const distances: Record<number, number> = {};
    const previous: Record<number, number | null> = {};
    const unvisited = new Set<number>();

    nodes.forEach(node => {
      distances[node.id] = node.id === startNode.id ? 0 : Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });

    while (unvisited.size > 0) {
      let current: number | null = null;
      let minDistance = Infinity;

      unvisited.forEach(nodeId => {
        if (distances[nodeId] < minDistance) {
          minDistance = distances[nodeId];
          current = nodeId;
        }
      });

      if (current === null || distances[current] === Infinity) break;
      if (current === endNode.id) break;

      unvisited.delete(current);

      edges.forEach(edge => {
        if (edge.from === current && unvisited.has(edge.to)) {
          const alt = distances[current!] + edge.weight;
          if (alt < distances[edge.to]) {
            distances[edge.to] = alt;
            previous[edge.to] = current;
          }
        }
      });
    }

    if (!Number.isFinite(distances[endNode.id])) {
      alert("No existe un camino desde el nodo origen hasta el nodo destino.");
      return;
    }

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
      const edgeIndex = edges.findIndex(e => e.from === path[i] && e.to === path[i + 1]);
      if (edgeIndex !== -1) {
        pathEdgeIds.push(edgeIndex);
      }
    }

    setResultPathEdges(pathEdgeIds);
    setNodeDistances(distances);
    setCalcMode('min');
  };

  const clearNetworkMetrics = () => {
    setCalcMode(null);
    setResultPathEdges([]);
    setNodeDistances(null);
  };

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

  
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (draggingNodeId === null || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();

      setNodes(prev =>
        prev.map(node =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              }
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

  useEffect(() => {
    const savedGraph = localStorage.getItem("grafo_dijkstra");

    if (savedGraph) {
      try {
        const parsed = JSON.parse(savedGraph);
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
      } catch (error) {
        console.error("Error loading graph:", error);
      }
    }
  }, []);

  useEffect(() => {
    const graphData = {
      nodes,
      edges
    };

    localStorage.setItem("grafo_dijkstra", JSON.stringify(graphData));
  }, [nodes, edges]);

  /* ---------- DETECTAR NODO BAJO CURSOR ---------- */
  const detectNodeAtPosition = (x: number, y: number): NodeType | null => {
    const nodeRadius = 24;
    for (const node of nodes) {
      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
      if (distance <= nodeRadius) {
        return node;
      }
    }
    return null;
  };

  /* ---------- CREAR NODO ---------- */
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (showMenu) {
      setShowMenu(false);
      setSelectedNode(null);
      setTempConnection(null);
      setWeightInput("1");
      return;
    }
    if (editingNode) {
      setEditingNode(null);
      setNodeNameInput("");
      return;
    }
    if (editingEdge) {
      setEditingEdge(null);
      setEdgeValueInput("");
      return;
    }

    const rect = containerRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedNode = detectNodeAtPosition(clickX, clickY);

    if (clickedNode) {
      handleNodeClick(clickedNode);
    } else {
      const newNode: NodeType = {
        id: nodes.length + 1,
        x: clickX,
        y: clickY,
        label: String.fromCharCode(65 + nodes.length),
      };
      setNodes(prev => [...prev, newNode]);
    }
  };

  /* ---------- CLICK EN NODO ---------- */
  const handleNodeClick = (node: NodeType) => {
    if (!selectedNode) {
      setSelectedNode(node);
    } else {
      if (selectedNode.id === node.id) {
        setSelectedNode(null);
        return;
      }

      // Store temporary connection and show weight input panel
      setTempConnection({ from: selectedNode, to: node });
      setMenuPosition({ x: node.x + 30, y: node.y });
      setShowMenu(true);
      setSelectedNode(null);
      clearNetworkMetrics();
    }
  };

  /* ---------- CLICK DERECHO EN NODO ---------- */
  const handleNodeRightClick = (e: React.MouseEvent, node: NodeType) => {
    e.preventDefault();
    setEditingNode(node);
    setNodeNameInput(node.label);
  };

  /* ---------- CLICK DERECHO EN ARISTA ---------- */
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

  /* ---------- CONFIRMAR NOMBRE NODO ---------- */
  const handleConfirmNodeName = () => {
    if (!editingNode || nodeNameInput.trim() === "") return;

    setNodes(prev =>
      prev.map(node =>
        node.id === editingNode.id
          ? { ...node, label: nodeNameInput.trim() }
          : node
      )
    );

    setEditingNode(null);
    setNodeNameInput("");
    clearNetworkMetrics();
  };

  /* ---------- CONFIRMAR VALOR ARISTA ---------- */
  const handleConfirmEdgeValue = () => {
    if (!editingEdge || edgeValueInput.trim() === "") return;

    const newWeight = Number(edgeValueInput.trim());
    if (isNaN(newWeight)) return;

    setEdges(prev =>
      prev.map(edge =>
        edge.from === editingEdge.from && edge.to === editingEdge.to
          ? { ...edge, weight: newWeight }
          : edge
      )
    );

    setEditingEdge(null);
    setEdgeValueInput("");
    clearNetworkMetrics();
  };

  /* ---------- ELIMINAR ARISTA ---------- */
  const deleteEdge = (index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
    clearNetworkMetrics();
  };

  /* ---------- LIMPIAR GRAFO ---------- */
  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowMenu(false);
    setTempConnection(null);

    localStorage.removeItem("grafo_dijkstra");
    clearNetworkMetrics();
  };

  /* ---------- CREAR ARISTA ---------- */
  const createEdge = () => {
    if (!tempConnection) return;
    if (tempConnection.from.id === tempConnection.to.id) {
        setShowMenu(false);
        setTempConnection(null);
        setWeightInput("1");
        return;
    }

    const finalWeight = weightInput === "" ? 1 : Number(weightInput);

    const newEdge: EdgeType = {
      from: tempConnection.from.id,
      to: tempConnection.to.id,
      type: "directed",
      weight: finalWeight,
    };

    setEdges(prev => [...prev, newEdge]);

    setShowMenu(false);
    setTempConnection(null);
    setWeightInput("1");
    clearNetworkMetrics();
  };

  /* ---------- EXPORTAR GRAFO ---------- */
  const handleExportGraph = () => {
    const fileName = prompt("Introduce el nombre del grafo:");
    if (!fileName || fileName.trim() === "") return;

    const graphData = {
      nodes: nodes,
      edges: edges
    };

    const dataStr = JSON.stringify(graphData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName + ".json";

    a.click();

    URL.revokeObjectURL(url);
  };

  /* ---------- IMPORTAR GRAFO ---------- */
  const handleImportGraph = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const graphData = JSON.parse(e.target?.result as string);
        if (graphData.nodes && graphData.edges) {
          setNodes(graphData.nodes);
          setEdges(graphData.edges);
        }
      } catch (error) {
        console.error("Error al importar el grafo:", error);
      }
    };

    reader.readAsText(file);
  };

  
  const deleteNode = (nodeId: number) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
    clearNetworkMetrics();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
        {/* HEADER PROFESIONAL */}
        <div className="w-full bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Algoritmo de Dijkstra</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Upload size={16} />
                <span>Importar</span>
              </button>
              <button
                onClick={handleExportGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Download size={16} />
                <span>Exportar</span>
              </button>
              <button
                onClick={clearGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-transparent rounded-md transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex gap-8">

          {/* PANEL */}
          <aside className="w-64 space-y-4">
            {/* ESTADÍSTICAS */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Estadísticas</h2>
              <div className="space-y-2 text-gray-300 text-sm">
                <div className="flex justify-between">
                  <span>Nodos</span>
                  <span className="font-semibold text-white">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aristas</span>
                  <span className="font-semibold text-white">{edges.length}</span>
                </div>
              </div>
            </div>

            {/* ACCIONES DEL ALGORITMO */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Acciones del Algoritmo</h2>
              <div className="space-y-3">
                <button
                  onClick={minimizeShortestPath}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-all duration-200"
                >
                  <TrendingDown size={18} />
                  <span>Minimizar</span>
                </button>
                <button
                  onClick={maximizeLongestPath}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg shadow-sm transition-all duration-200"
                >
                  <TrendingUp size={18} />
                  <span>Maximizar</span>
                </button>
              </div>
            </div>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImportGraph}
            />

            <div className="text-sm text-slate-400 leading-relaxed p-2">
              <b>Instrucciones:</b><br/>
              • Click en el panel → crear un nodo<br/>
              • Click en un nodo y en otro → crear conexión<br/>
              • Click derecho en un nodo → editar nombre<br/>
              • Click derecho en una arista → editar valor<br/>
              • Los cambios se guardan automáticamente
            </div>
          </aside>

          {/* CANVAS */}
          <div className="flex-1 flex flex-col gap-8">
            <div
              ref={containerRef}
              onClick={handleCanvasClick}
              className="relative rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
              style={{
                height: "600px",
                background:
                  "radial-gradient(circle at center, #0f172a 0%, #020617 100%)",
              }}
            >

              {/* GRID */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              {/* SVG */}
              <svg
                width={canvasSize.width}
                height={canvasSize.height}
                className="absolute top-0 left-0"
                style={{ pointerEvents: "none" }}
              >
                <defs>
                  <marker
                    id="arrow-small"
                    markerWidth="6"
                    markerHeight="6"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L5,3 z" fill="#ffffff" />
                  </marker>
                  <marker
                    id="arrow-normal"
                    markerWidth="10"
                    markerHeight="10"
                    refX="10"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="#ffffff" />
                  </marker>
                  <marker
                    id="arrow-hover"
                    markerWidth="10"
                    markerHeight="10"
                    refX="10"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="#a7f3d0" />
                  </marker>
                </defs>

                {edges.map((edge, index) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  const isPathEdge = resultPathEdges.includes(index);

                  // Estilo visual según el modo
                  let strokeColor = "#94a3b8"; 
                  let strokeWidth = 3;
                  let opacity = 1;

                  if (calcMode === 'max' && isPathEdge) {
                    strokeColor = "#ef4444"; 
                    strokeWidth = 4;
                  } else if (calcMode === 'min') {
                    if (isPathEdge) {
                      strokeColor = "#10b981"; 
                      strokeWidth = 5;
                    } else {
                      opacity = 0.3; 
                    }
                  } else if (calcMode === 'max' && !isPathEdge) {
                    opacity = 0.3; 
                  }

                  
                  if (edge.from === edge.to) {
                    const nodeRadius = 24;
                    const loopHeight = 60;
                    const loopWidth = 50;

                    const startX = from.x - 6;
                    const startY = from.y - nodeRadius;

                    const control1X = from.x - loopWidth;
                    const control1Y = from.y - loopHeight;

                    const control2X = from.x + loopWidth;
                    const control2Y = from.y - loopHeight;

                    const endX = from.x + 6;
                    const endY = from.y - nodeRadius;

                    const loopPathD = `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;

                    return (
                      <g
                        key={index}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleEdgeRightClick(e, edge);
                        }}
                        onMouseEnter={() => setHoveredEdgeIndex(index)}
                        onMouseLeave={() => setHoveredEdgeIndex(null)}
                        style={{
                          pointerEvents: "auto",
                          cursor: "pointer",
                          opacity: hoveredEdgeIndex !== null && hoveredEdgeIndex !== index ? 0.2 : opacity
                        }}
                      >
                        <path
                          d={loopPathD}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={20}
                          strokeOpacity={0.001}
                        />
                        <path
                          d={loopPathD}
                          fill="none"
                          stroke={hoveredEdgeIndex === index ? "#a7f3d0" : strokeColor}
                          strokeWidth={hoveredEdgeIndex === index ? 5 : strokeWidth}
                          markerEnd="url(#arrow-small)"
                          style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                        <text
                          x={from.x}
                          y={from.y - loopHeight - 8}
                          fill={hoveredEdgeIndex === index ? "#a7f3d0" : "#f8fafc"}
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          onContextMenu={(e) => handleEdgeRightClick(e, edge)}
                          style={{ 
                            pointerEvents: "auto", 
                            cursor: "pointer",
                            transition: 'all 0.3s ease-in-out'
                          }}
                        >
                          {edge.weight}
                        </text>
                      </g>
                    );
                  }

                  const oppositeExists = edges.some(
                    e => e.from === edge.to && e.to === edge.from
                  );

                  const midX = (from.x + to.x) / 2;
                  const midY = (from.y + to.y) / 2;

                  let path;
                  let textX = midX;
                  let textY = midY - 10;

                  if (oppositeExists) {
                    const curveOffset = 40;
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;

                    const normalX = -dy;
                    const normalY = dx;
                    const length = Math.sqrt(normalX ** 2 + normalY ** 2);

                    const offsetX = (normalX / length) * curveOffset;
                    const offsetY = (normalY / length) * curveOffset;

                    path = `M ${from.x} ${from.y}
                            Q ${midX + offsetX} ${midY + offsetY}
                              ${to.x} ${to.y}`;

                    textX = midX + offsetX;
                    textY = midY + offsetY;
                  } else {
                    path = `M ${from.x} ${from.y}
                            L ${to.x} ${to.y}`;
                  }

                  return (
                    <g
                      key={index}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleEdgeRightClick(e, edge);
                      }}
                      onMouseEnter={() => setHoveredEdgeIndex(index)}
                      onMouseLeave={() => setHoveredEdgeIndex(null)}
                      style={{
                        pointerEvents: "auto",
                        cursor: "pointer",
                        opacity: hoveredEdgeIndex !== null && hoveredEdgeIndex !== index ? 0.2 : opacity
                      }}
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={20}
                        strokeOpacity={0.001}
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={hoveredEdgeIndex === index ? "#a7f3d0" : strokeColor}
                        strokeWidth={hoveredEdgeIndex === index ? 5 : strokeWidth}
                        markerEnd={hoveredEdgeIndex === index ? "url(#arrow-hover)" : "url(#arrow-normal)"}
                        style={{ transition: 'all 0.3s ease-in-out' }}
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill={hoveredEdgeIndex === index ? "#a7f3d0" : "#f8fafc"}
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        onContextMenu={(e) => handleEdgeRightClick(e, edge)}
                        style={{ 
                          pointerEvents: "auto", 
                          cursor: "pointer",
                          transition: 'all 0.3s ease-in-out'
                        }}
                      >
                        {edge.weight}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* MENU */}
              {showMenu && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: menuPosition.x, top: menuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm mb-2 text-gray-300">Peso</p>
                  <input
                    type="text"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createEdge}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setSelectedNode(null);
                        setTempConnection(null);
                        setWeightInput("1");
                      }}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* NODOS */}
              {nodes.map(node => {
                return (
                  <div key={node.id}>
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingNodeId(node.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node);
                      }}
                      onContextMenu={(e) => handleNodeRightClick(e, node)}
                      onDoubleClick={() => {
                        handleNodeClick(node);
                      }}
                      className="absolute w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer transition-all duration-300 shadow-2xl hover:scale-110"
                      style={{
                        left: node.x - 24,
                        top: node.y - 24,
                        background:
                          "linear-gradient(135deg,#6366f1,#06b6d4)",
                        boxShadow:
                          "0 0 20px rgba(99,102,241,0.6)",
                        color: "white",
                      }}
                    >
                      {node.label}
                    </div>
                    
                    {/* Mostrar costo acumulado por nodo en resultados */}
                    {calcMode && nodeDistances && Number.isFinite(nodeDistances[node.id]) && (
                      <div
                        className="absolute text-xs bg-black/80 text-white px-1 py-0.5 rounded whitespace-nowrap"
                        style={{
                          left: node.x - 28,
                          top: node.y - 35,
                        }}
                      >
                        <div>
                          {calcMode === "min" ? "Min" : "Max"}: {nodeDistances[node.id]}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* PANEL PARA EDITAR NODO */}
              {editingNode && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: editingNode.x + 30, top: editingNode.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold mb-4 text-gray-300">
                    Editar nombre del nodo
                  </p>
                  <input
                    type="text"
                    value={nodeNameInput}
                    onChange={(e) => setNodeNameInput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4"
                  />
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmNodeName}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => {
                          setEditingNode(null);
                          setNodeNameInput("");
                        }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (editingNode) {
                          deleteNode(editingNode.id);
                          setEditingNode(null);
                          setNodeNameInput("");
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
                    >
                      Eliminar nodo
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL PARA EDITAR ARISTA */}
              {editingEdge && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: edgeMenuPosition.x, top: edgeMenuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold mb-4 text-gray-300">
                    Editar valor de arista
                  </p>
                  <input
                    type="number"
                    value={edgeValueInput}
                    onChange={(e) => setEdgeValueInput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4"
                  />
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmEdgeValue}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => {
                          setEditingEdge(null);
                          setEdgeValueInput("");
                        }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        deleteEdge(edges.findIndex(e => e.from === editingEdge.from && e.to === editingEdge.to));
                        setEditingEdge(null);
                        setEdgeValueInput("");
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
                    >
                      Eliminar arista
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* PANEL DE RESULTADOS - DENTRO DEL FLEX-1 */}
            {calcMode && (
              <div 
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
                style={{
                  background: "hsl(0 0% 100% / 0.08)",
                  borderColor: "hsl(0 0% 100% / 0.14)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {calcMode === 'min' ? (
                  <div>
                    <h2 className="text-2xl font-bold text-emerald-400 mb-6 text-center">Camino más corto</h2>
                    {resultPathEdges.length > 0 ? (
                      (() => {
                        const pathNodes: string[] = [];
                        resultPathEdges.forEach((edgeIndex) => {
                          const edge = edges[edgeIndex];
                          if (!edge) return;
                          const fromNode = nodes.find(n => n.id === edge.from);
                          const toNode = nodes.find(n => n.id === edge.to);
                          if (fromNode && toNode) {
                            if (pathNodes.length === 0) pathNodes.push(fromNode.label);
                            pathNodes.push(toNode.label);
                          }
                        });
                        return (
                          <>
                            <div className="text-center mb-6">
                              <div className="flex flex-wrap items-center justify-center gap-3 text-3xl font-bold">
                                {pathNodes.map((node, index) => (
                                  <div key={index} className="flex items-center">
                                    {index > 0 && <span className="text-emerald-400 mx-2">→</span>}
                                    <span className="bg-emerald-900/30 px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-300">{node}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-center mb-8">
                              <div className="inline-block bg-emerald-500/20 px-6 py-3 rounded-full border border-emerald-500/30">
                                <span className="text-emerald-400 font-bold text-2xl">
                                  Peso Total: {resultPathEdges.reduce((total, edgeIndex) => total + (edges[edgeIndex]?.weight || 0), 0)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-emerald-400 mb-4">Desglose de la ruta:</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {resultPathEdges.map((edgeIndex, i) => {
                                  const edge = edges[edgeIndex];
                                  if (!edge) return null;
                                  const fromNode = nodes.find(n => n.id === edge.from);
                                  const toNode = nodes.find(n => n.id === edge.to);
                                  if (!fromNode || !toNode) return null;
                                  return (
                                    <div key={i} className="bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-300 text-sm font-medium">
                                      {fromNode.label} → {toNode.label} ({edge.weight})
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <p className="text-gray-400 text-center text-lg">No se encontró un camino válido</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-bold text-rose-400 mb-6 text-center">Camino más largo</h2>
                    {resultPathEdges.length > 0 ? (
                      (() => {
                        const longestEdges = resultPathEdges
                          .map((edgeIndex) => edges[edgeIndex])
                          .filter((edge): edge is EdgeType => Boolean(edge));

                        const pathNodes: string[] = [];
                        longestEdges.forEach(edge => {
                          const fromNode = nodes.find(n => n.id === edge.from);
                          const toNode = nodes.find(n => n.id === edge.to);
                          if (fromNode && toNode) {
                            if (pathNodes.length === 0) pathNodes.push(fromNode.label);
                            pathNodes.push(toNode.label);
                          }
                        });
                        return (
                          <>
                            <div className="text-center mb-6">
                              <div className="flex flex-wrap items-center justify-center gap-3 text-3xl font-bold">
                                {pathNodes.map((node, index) => (
                                  <div key={index} className="flex items-center">
                                    {index > 0 && <span className="text-rose-400 mx-2">→</span>}
                                    <span className="bg-rose-900/30 px-4 py-2 rounded-full border border-rose-500/30 text-rose-300">{node}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-center mb-8">
                              <div className="inline-block bg-rose-500/20 px-6 py-3 rounded-full border border-rose-500/30">
                                <span className="text-rose-400 font-bold text-2xl">
                                  Peso Total: {longestEdges.reduce((total, edge) => total + edge.weight, 0)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-rose-400 mb-4">Desglose de la ruta:</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {longestEdges.map((edge, index) => {
                                  const fromNode = nodes.find(n => n.id === edge.from);
                                  const toNode = nodes.find(n => n.id === edge.to);
                                  if (!fromNode || !toNode) return null;
                                  return (
                                    <div key={index} className="bg-rose-900/20 px-3 py-2 rounded-lg border border-rose-500/20 text-rose-300 text-sm font-medium">
                                      {fromNode.label} → {toNode.label} ({edge.weight})
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <p className="text-gray-400 text-center text-lg">Calculando el camino más largo...</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTÓN FLOTANTE DE AYUDA */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => setShowHelp(true)} 
          className="w-12 h-12 rounded-full border-2 border-slate-400 text-slate-400 flex items-center justify-center bg-transparent backdrop-blur-sm transition-all duration-200 hover:bg-slate-400 hover:text-slate-900 shadow-lg hover:shadow-xl focus:outline-none" 
          title="Ver guía de uso"
        >
          <HelpCircle size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* MODAL DE AYUDA */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              &times;
            </button>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <HelpCircle size={20} className="text-slate-300" />
              Guía: Algoritmo de Dijkstra
            </h2>
            <div className="text-slate-300 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-4 text-slate-300">
                <p>El <strong>Algoritmo de Dijkstra</strong> es un método utilizado en teoría de grafos para encontrar el camino más óptimo desde un nodo origen hacia un nodo destino.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Preparación:</strong> Asegúrate de que tu grafo tenga pesos asignados a cada arista (representando tiempo, costo o distancia).</li>
                  <li><strong className="text-emerald-400">Minimizar:</strong> Encuentra el camino más corto entre los nodos seleccionados, optando por el costo mínimo.</li>
                  <li><strong className="text-violet-400">Maximizar:</strong> Encuentra el camino más largo entre los nodos seleccionados, optando por el costo máximo.</li>
                </ul>
                <h3 className="text-lg font-semibold text-slate-400 mt-4">¿Cómo funciona?</h3>
                <p className="text-slate-300">
                  El algoritmo asigna un costo acumulado a cada nodo, comenzando desde el nodo origen con un costo de cero. Luego, explora los nodos vecinos, actualizando sus costos acumulados 
                  si se encuentra una ruta más eficiente. Este proceso se repite hasta alcanzar el nodo destino o explorar todos los nodos alcanzables.
                </p>
                <p className="text-amber-200/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 mt-4">
                  💡 <em>Tip: Los resultados se resaltarán en el lienzo para que puedas visualizar visualmente la ruta exacta.</em>
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowHelp(false)} className="px-5 py-2 bg-slate-200 hover:bg-white text-slate-900 font-medium rounded-lg transition-colors">
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