import { useState, useRef, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { MousePointer2 } from "lucide-react";

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

const Johnson = () => {
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [tempConnection, setTempConnection] =
    useState<{ from: NodeType; to: NodeType } | null>(null);

  const [weight, setWeight] = useState<number>(1);
  const [weightInput, setWeightInput] = useState<string>("1");

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para edición con click derecho
  const [editingNode, setEditingNode] = useState<NodeType | null>(null);
  const [nodeNameInput, setNodeNameInput] = useState("");
  const [editingEdge, setEditingEdge] = useState<EdgeType | null>(null);
  const [edgeValueInput, setEdgeValueInput] = useState("");

  // Estados para camino más corto
  const [showShortestPath, setShowShortestPath] = useState(false);
  const [shortestPathEdges, setShortestPathEdges] = useState<Set<string>>(new Set());

  // Estados para matrices
  const [adjacencyMatrix, setAdjacencyMatrix] = useState<number[][]>([]);
  const [distanceMatrix, setDistanceMatrix] = useState<number[][]>([]);

  // Función para calcular camino más corto (Dijkstra)
  const calculateShortestPath = () => {
    if (nodes.length === 0 || edges.length === 0) {
      alert("Se necesitan nodos y aristas para calcular el camino más corto.");
      return;
    }

    // Calcular matriz de distancias mínimas (Algoritmo de Johnson)
    calculateDistanceMatrix();

    // Encontrar nodo inicial (sin aristas entrantes)
    const startNodes = nodes.filter(n => !edges.some(e => e.to === n.id));
    if (startNodes.length === 0) {
      alert("No se encontró un nodo inicial (sin aristas entrantes).");
      return;
    }
    const startNode = startNodes[0];

    // Encontrar nodo final (sin aristas salientes)
    const endNodes = nodes.filter(n => !edges.some(e => e.from === n.id));
    if (endNodes.length === 0) {
      alert("No se encontró un nodo final (sin aristas salientes).");
      return;
    }
    const endNode = endNodes[0];

    // Implementar Dijkstra
    const distances: Record<number, number> = {};
    const previous: Record<number, number | null> = {};
    const unvisited = new Set<number>();

    // Inicializar distancias
    nodes.forEach(node => {
      distances[node.id] = node.id === startNode.id ? 0 : Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });

    while (unvisited.size > 0) {
      // Encontrar nodo con distancia mínima
      let current: number | null = null;
      let minDistance = Infinity;
      
      unvisited.forEach(nodeId => {
        if (distances[nodeId] < minDistance) {
          minDistance = distances[nodeId];
          current = nodeId;
        }
      });

      if (current === null || current === endNode.id) break;
      
      unvisited.delete(current);

      // Actualizar distancias de vecinos
      edges.forEach(edge => {
        if (edge.from === current) {
          const alt = distances[current] + edge.weight;
          if (alt < distances[edge.to]) {
            distances[edge.to] = alt;
            previous[edge.to] = current;
          }
        }
      });
    }

    // Reconstruir camino
    const path: number[] = [];
    let current: number | null = endNode.id;
    
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    // Encontrar IDs de aristas en el camino
    const pathEdgeIds = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      const edgeIndex = edges.findIndex(e => e.from === path[i] && e.to === path[i + 1]);
      if (edgeIndex !== -1) {
        pathEdgeIds.add(edgeIndex.toString());
      }
    }

    setShortestPathEdges(pathEdgeIds);
    setShowShortestPath(true);
  };

  // Función para limpiar resultados cuando el grafo cambia
  const clearNetworkMetrics = () => {
    setShowShortestPath(false);
    setShortestPathEdges(new Set());
  };

  // Función para generar matriz de adyacencia
  const generateAdjacencyMatrix = () => {
    const size = nodes.length;
    const newMatrix: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(Infinity)
    );

    // Inicializar diagonal con 0 (distancia de un nodo a sí mismo)
    for (let i = 0; i < size; i++) {
      newMatrix[i][i] = 0;
    }

    // Llenar con pesos de las aristas
    edges.forEach(edge => {
      const fromIndex = nodes.findIndex(n => n.id === edge.from);
      const toIndex = nodes.findIndex(n => n.id === edge.to);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        newMatrix[fromIndex][toIndex] = edge.weight;
      }
    });

    setAdjacencyMatrix(newMatrix);
  };

  // Función para calcular matriz de distancias mínimas (Algoritmo de Johnson)
  const calculateDistanceMatrix = () => {
    if (nodes.length === 0) {
      setDistanceMatrix([]);
      return;
    }

    const size = nodes.length;
    const distMatrix: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(Infinity)
    );

    // Inicializar con la matriz de adyacencia
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) {
          distMatrix[i][j] = 0;
        } else {
          const edge = edges.find(e => 
            nodes.findIndex(n => n.id === e.from) === i && 
            nodes.findIndex(n => n.id === e.to) === j
          );
          distMatrix[i][j] = edge ? edge.weight : Infinity;
        }
      }
    }

    // Algoritmo de Floyd-Warshall para calcular todas las distancias mínimas
    for (let k = 0; k < size; k++) {
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (distMatrix[i][k] !== Infinity && distMatrix[k][j] !== Infinity) {
            const newDistance = distMatrix[i][k] + distMatrix[k][j];
            if (newDistance < distMatrix[i][j]) {
              distMatrix[i][j] = newDistance;
            }
          }
        }
      }
    }

    setDistanceMatrix(distMatrix);
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

  // Auto-recalcular matrices cuando cambian nodos o aristas
  useEffect(() => {
    generateAdjacencyMatrix();
  }, [nodes, edges]);

  // Cargar grafo desde localStorage al montar el componente
  useEffect(() => {
    const savedGraph = localStorage.getItem("grafo_johnson");

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

  // Guardar automáticamente el grafo en localStorage
  useEffect(() => {
    const graphData = {
      nodes,
      edges
    };

    localStorage.setItem("grafo_johnson", JSON.stringify(graphData));
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
    // Si hay algún panel abierto, ignorar clicks
    if (showMenu || editingNode || editingEdge) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Detectar si hay un nodo en la posición del click
    const clickedNode = detectNodeAtPosition(clickX, clickY);

    if (clickedNode) {
      // Click sobre nodo: abrir panel de conexión
      handleNodeClick(clickedNode);
    } else {
      // Click en espacio vacío: crear nuevo nodo
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
      // Store temporary connection and show weight input panel
      setTempConnection({ from: selectedNode, to: node });
      setMenuPosition({ x: node.x + 30, y: node.y });
      setShowMenu(true);
      setSelectedNode(null);
      // Clear metrics when creating new edge
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
    // Clear metrics when node name is edited
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
    // Clear metrics when edge weight is edited
    clearNetworkMetrics();
  };

  /* ---------- ELIMINAR ARISTA ---------- */
  const deleteEdge = (index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
    // Clear metrics when edge is deleted
    clearNetworkMetrics();
  };

  /* ---------- LIMPIAR GRAFO ---------- */
  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowMenu(false);
    setTempConnection(null);

    localStorage.removeItem("grafo_johnson");
    // Clear metrics when graph is cleared
    clearNetworkMetrics();
  };

  /* ---------- CREAR ARISTA ---------- */
  const createEdge = () => {
    if (!tempConnection) return;

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
    setWeight(1);
    setWeightInput("1");
    // Clear metrics when edge is created
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
    // Clear metrics when node is deleted
    clearNetworkMetrics();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
        <div className="max-w-7xl mx-auto flex gap-8">

          {/* PANEL */}
          <aside className="w-80 space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">
                Estadísticas
              </h2>

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

            <button
              onClick={clearGraph}
              className="w-full py-3 rounded-2xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg transition"
            >
              Limpiar todo
            </button>

            <button
              onClick={handleExportGraph}
              className="w-full py-3 rounded-2xl font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg transition"
            >
              Exportar Grafo
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-2xl font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition"
            >
              Importar Grafo
            </button>

            <button
              onClick={calculateShortestPath}
              className="w-full py-3 rounded-2xl font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg transition"
            >
              Calcular Camino Más Corto
            </button>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImportGraph}
            />

            <div style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "white",
              lineHeight: "1.5"
            }}>
              <b>Cómo usar el panel de grafos:</b><br/>
              • Click en el panel → crear un nodo<br/>
              • Click en un nodo y luego en otro → crear conexión dirigida<br/>
              • Click derecho en un nodo → editar nombre<br/>
              • Click derecho en una arista → editar valor<br/>
              • Los cambios se reflejan automáticamente en la matriz de adyacencia
            </div>
          </aside>

          {/* CANVAS */}
          <div className="flex-1">
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
                </defs>

                {edges.map((edge, index) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  // Verificar si esta arista está en el camino más corto
                  const isShortestPath = shortestPathEdges.has(index.toString());

                  // Estilo visual
                  let strokeColor = "#94a3b8"; // Color normal por defecto
                  let strokeWidth = 3;
                  let opacity = 1;

                  if (showShortestPath) {
                    if (isShortestPath) {
                      strokeColor = "#10b981"; // Verde brillante para camino más corto
                      strokeWidth = 5;
                    } else {
                      opacity = 0.3; // Difuminar resto del grafo
                    }
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

                    return (
                      <g
                        key={index}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleEdgeRightClick(e, edge);
                        }}
                        style={{ pointerEvents: "auto", cursor: "pointer", opacity }}
                      >
                        <path
                          d={`M ${startX} ${startY}
                              C ${control1X} ${control1Y},
                                ${control2X} ${control2Y},
                                ${endX} ${endY}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          markerEnd="url(#arrow-small)"
                        />
                        <text
                          x={from.x}
                          y={from.y - loopHeight - 8}
                          fill="#f8fafc"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          onContextMenu={(e) => handleEdgeRightClick(e, edge)}
                          style={{ pointerEvents: "auto", cursor: "pointer" }}
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
                      style={{ pointerEvents: "auto", cursor: "pointer", opacity }}
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        markerEnd="url(#arrow-normal)"
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill="#f8fafc"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        onContextMenu={(e) => handleEdgeRightClick(e, edge)}
                        style={{ pointerEvents: "auto", cursor: "pointer" }}
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
                        setWeight(1);
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
                        // Double-click should only open connection panel
                        // No automatic loop creation
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
                  style={{ left: 100, top: 100 }}
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
                      onClick={() => deleteEdge(edges.findIndex(e => e.from === editingEdge.from && e.to === editingEdge.to))}
                      className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
                    >
                      Eliminar arista
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* MATRICES */}
            {adjacencyMatrix.length > 0 && (
              <div className="mt-8 space-y-8">
                {/* Matriz de Adyacencia */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                  <h2 className="text-xl font-bold text-white mb-4">
                    Matriz de Adyacencia
                  </h2>
                  <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
                    <div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-300 border border-white/20 bg-white/10"></th>
                              {nodes.map(node => (
                                <th key={node.id} className="px-4 py-2 text-center text-sm font-medium text-gray-300 border border-white/20 bg-white/10">
                                  {node.label}
                                </th>
                              ))}
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Σ</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Count</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adjacencyMatrix.map((row, i) => {
                              // Calcular sumatorias, conteos y máximos para esta fila
                              const rowSum = row.reduce((acc, val) => acc + (val !== Infinity && val !== 0 ? val : 0), 0);
                              const rowCount = row.reduce((acc, val) => acc + (val !== Infinity && val !== 0 ? 1 : 0), 0);
                              const rowMax = row.reduce((acc, val) => (val !== Infinity && val !== 0 && val > acc) ? val : acc, 0);
                              
                              return (
                                <tr key={i}>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-300 border border-white/20 bg-white/10">
                                    {nodes[i]?.label}
                                  </td>
                                  {row.map((cell, j) => (
                                    <td
                                      key={j}
                                      className={`px-4 py-2 text-center text-sm border border-white/20 ${
                                        cell === 0 
                                          ? 'bg-slate-800/50 text-gray-400' 
                                          : cell === Infinity 
                                          ? 'bg-slate-900/50 text-gray-500'
                                          : 'bg-blue-900/30 text-blue-300 font-medium'
                                      }`}
                                    >
                                      {cell === 0 ? '0' : cell === Infinity ? '∞' : cell}
                                    </td>
                                  ))}
                                  <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {rowSum}
                                  </td>
                                  <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {rowCount}
                                  </td>
                                  <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {rowMax || 0}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Filas de sumatorias de columnas */}
                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Σ</td>
                              {adjacencyMatrix[0]?.map((_, colIndex) => {
                                const colSum = adjacencyMatrix.reduce((acc, row) => acc + (row[colIndex] !== Infinity && row[colIndex] !== 0 ? row[colIndex] : 0), 0);
                                return (
                                  <td key={colIndex} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {colSum}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                            </tr>

                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Count</td>
                              {adjacencyMatrix[0]?.map((_, colIndex) => {
                                const colCount = adjacencyMatrix.reduce((acc, row) => acc + (row[colIndex] !== Infinity && row[colIndex] !== 0 ? 1 : 0), 0);
                                return (
                                  <td key={colIndex} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {colCount}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                            </tr>

                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Max</td>
                              {adjacencyMatrix[0]?.map((_, colIndex) => {
                                const colMax = adjacencyMatrix.reduce((acc, row) => {
                                  const val = row[colIndex];
                                  return (val !== Infinity && val !== 0 && val > acc) ? val : acc;
                                }, 0);
                                return (
                                  <td key={colIndex} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                    {colMax || 0}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                              <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <div style={{ marginTop: "10px" }}>
                        <p className="text-white">
                          El valor más grande de la suma de las filas es: <span className="text-cyan-300 font-bold">
                            {Math.max(...adjacencyMatrix.map(row => row.reduce((acc, val) => acc + (val !== Infinity && val !== 0 ? val : 0), 0)))}
                          </span>
                        </p>
                        <p className="text-white mt-2">
                          El valor más grande de la suma de las columnas es: <span className="text-cyan-300 font-bold">
                            {Math.max(...(adjacencyMatrix[0]?.map((_, colIndex) => 
                              adjacencyMatrix.reduce((acc, row) => acc + (row[colIndex] !== Infinity && row[colIndex] !== 0 ? row[colIndex] : 0), 0)
                            ) || []))}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matriz de Distancias Mínimas */}
                {distanceMatrix.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-4">
                      Matriz de Distancias Mínimas (Algoritmo de Johnson)
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-300 border border-white/20 bg-white/10"></th>
                            {nodes.map(node => (
                              <th key={node.id} className="px-4 py-2 text-center text-sm font-medium text-gray-300 border border-white/20 bg-white/10">
                                {node.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {distanceMatrix.map((row, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-300 border border-white/20 bg-white/10">
                                {nodes[i]?.label}
                              </td>
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className={`px-4 py-2 text-center text-sm border border-white/20 ${
                                    cell === 0 
                                      ? 'bg-green-900/30 text-green-300 font-medium'
                                      : cell === Infinity 
                                      ? 'bg-slate-900/50 text-gray-500'
                                      : 'bg-emerald-900/30 text-emerald-300 font-medium'
                                  }`}
                                >
                                  {cell === 0 ? '0' : cell === Infinity ? '∞' : cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                      <p>• Los valores en verde muestran las distancias mínimas entre todos los pares de nodos</p>
                      <p>• ∞ indica que no hay camino disponible entre esos nodos</p>
                      <p>• 0 en la diagonal representa la distancia de un nodo a sí mismo</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Johnson;
