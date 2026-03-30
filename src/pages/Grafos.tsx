import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { MousePointer2, Upload, Download, Trash2, HelpCircle } from "lucide-react";

type NodeType = {
  id: number;
  x: number;
  y: number;
  label: string;
};

type EdgeType = {
  from: number;
  to: number;
  type: "directed" | "undirected";
  weight: number;
};

const Grafos = () => {
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const [matrix, setMatrix] = useState<number[][]>([]);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [tempConnection, setTempConnection] =
    useState<{ from: NodeType; to: NodeType } | null>(null);

  const [edgeType, setEdgeType] =
    useState<"directed" | "undirected" | null>(null);
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

  // Estado para hover en aristas
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);

  // Estado para modal de ayuda
  const [showHelp, setShowHelp] = useState(false);

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

  // Auto-recalcular matriz cuando cambian nodos o aristas
  useEffect(() => {
    generateAdjacencyMatrix();
  }, [nodes, edges]);

  // Cargar grafo desde localStorage al montar el componente
  useEffect(() => {
    const savedGraph = localStorage.getItem("grafo_guardado");

    if (savedGraph) {
      try {
        const parsed = JSON.parse(savedGraph);
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
      } catch (error) {
        console.error("Error cargando grafo:", error);
      }
    }
  }, []);

  // Guardar automáticamente el grafo en localStorage
  useEffect(() => {
    const graphData = {
      nodes,
      edges
    };

    localStorage.setItem("grafo_guardado", JSON.stringify(graphData));
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
      setTempConnection({ from: selectedNode, to: node });
      setMenuPosition({ x: node.x + 30, y: node.y });
      setShowMenu(true);
      setSelectedNode(null);
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

  /* ---------- CONFIRMAR EDICIÓN NODO ---------- */
  const handleConfirmNodeName = () => {
    if (!editingNode) return;

    setNodes(nodes.map(node =>
      node.id === editingNode.id
        ? { ...node, label: nodeNameInput }
        : node
    ));

    setEditingNode(null);
    setNodeNameInput("");
  };

  /* ---------- CONFIRMAR EDICIÓN ARISTA ---------- */
  const handleConfirmEdgeValue = () => {
    if (!editingEdge) return;

    setEdges(edges.map(edge =>
      edge.from === editingEdge.from && edge.to === editingEdge.to
        ? { ...edge, weight: parseFloat(edgeValueInput) || 1 }
        : edge
    ));

    setEditingEdge(null);
    setEdgeValueInput("");
  };

  /* ---------- ELIMINAR ARISTA ---------- */
  const handleDeleteEdge = () => {
    if (!editingEdge) return;

    setEdges(prev =>
      prev.filter(edge =>
        !(edge.from === editingEdge.from && edge.to === editingEdge.to)
      )
    );

    setEditingEdge(null);
    setEdgeValueInput("");
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
    const file = event.target.files?.[0];
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

  /* ---------- CREAR ARISTA ---------- */
  const createEdge = () => {
    if (!tempConnection || !edgeType) return;

    const finalWeight = weightInput === "" ? 1 : Number(weightInput);

    const newEdge: EdgeType = {
      from: tempConnection.from.id,
      to: tempConnection.to.id,
      type: edgeType,
      weight: finalWeight,
    };

    setEdges(prev => [...prev, newEdge]);

    setShowMenu(false);
    setEdgeType(null);
    setTempConnection(null);
    setWeight(1);
    setWeightInput("1");
  };

  const deleteNode = (nodeId: number) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
  };

  const deleteEdge = (index: number) => {
    setEdges(prev => prev.filter((_, i) => i !== index));
  };

  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setShowMenu(false);
    setTempConnection(null);

    localStorage.removeItem("grafo_guardado");
  };

  const generateAdjacencyMatrix = () => {
    const size = nodes.length;
    const newMatrix: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(0)
    );

    edges.forEach(edge => {
      const fromIndex = edge.from - 1;
      const toIndex = edge.to - 1;

      newMatrix[fromIndex][toIndex] = edge.weight;

      if (edge.type === "undirected") {
        newMatrix[toIndex][fromIndex] = edge.weight;
      }
    });

    setMatrix(newMatrix);
  };

  const rowSums = matrix.map(row =>
    row.reduce((acc, val) => acc + val, 0)
  );

  const colSums = matrix[0]?.map((_, colIndex) =>
    matrix.reduce((acc, row) => acc + row[colIndex], 0)
  ) || [];

  // COUNT SOLO VALORES DISTINTOS DE 0
  const rowCounts = matrix.map(row =>
    row.reduce((acc, value) => acc + (value !== 0 ? 1 : 0), 0)
  );

  const colCounts = matrix.length > 0
    ? matrix[0].map((_, colIndex) =>
        matrix.reduce((acc, row) =>
          acc + (row[colIndex] !== 0 ? 1 : 0),
        0)
      )
    : [];

  const rowMaxs = matrix.map(row =>
    row.length > 0 ? Math.max(...row) : 0
  );
  const colMaxs =
    matrix[0]?.map((_, j) =>
      Math.max(0, ...matrix.map(row => row[j]))
    ) || [];

  const maxRowSum = rowSums.length > 0 ? Math.max(...rowSums) : 0;
  const maxColSum = colSums.length > 0 ? Math.max(...colSums) : 0;

  // Calcular el nombre más largo para adaptar la matriz
  const longestNodeNameLength = nodes.reduce(
    (max, node) => Math.max(max, node.label.length),
    1
  );
  
  const dynamicCellWidth = Math.max(60, longestNodeNameLength * 14);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
        {/* HEADER PROFESIONAL */}
        <div className="w-full flex justify-between items-center px-6 py-4 bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-4">
            <h1 className="text-xl font-bold text-white">Grafos</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Upload size={16} />
                <span>Importar Grafo</span>
              </button>
              <button
                onClick={handleExportGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Download size={16} />
                <span>Exportar Grafo</span>
              </button>
              <button
                onClick={clearGraph}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-transparent rounded-md transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} />
                <span>Limpiar Lienzo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex gap-8">

          {/* PANEL */}
          <aside className="w-64 space-y-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
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
              • Click en un nodo y luego en otro → crear conexión<br/>
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
                  <marker id="arrow-small" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L5,3 z" fill="#ffffff" style={{ transition: 'all 0.3s ease-in-out' }} />
                  </marker>
                  <marker id="arrow-normal" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#ffffff" style={{ transition: 'all 0.3s ease-in-out' }} />
                  </marker>
                  <marker id="arrow-hover" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#a7f3d0" style={{ transition: 'all 0.3s ease-in-out' }} />
                  </marker>
                </defs>

                {edges.map((edge, index) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  // Lógica centralizada para los estilos hover smooth
                  const isHovered = hoveredEdgeIndex === index;
                  const isOtherHovered = hoveredEdgeIndex !== null && hoveredEdgeIndex !== index;
                  const opacity = isOtherHovered ? 0.2 : 1;
                  const strokeColor = isHovered ? "#a7f3d0" : "#94a3b8";
                  const strokeW = isHovered ? 5 : 3;
                  const textColor = isHovered ? "#a7f3d0" : "#f8fafc";

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
                        onMouseEnter={() => setHoveredEdgeIndex(index)}
                        onMouseLeave={() => setHoveredEdgeIndex(null)}
                        style={{ 
                          pointerEvents: "auto", 
                          cursor: "pointer",
                          opacity: opacity,
                          transition: 'opacity 0.3s ease-in-out'
                        }}
                      >
                        <path
                          d={`M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                          style={{ transition: 'all 0.3s ease-in-out' }}
                          markerEnd={edge.type === "directed" ? (isHovered ? "url(#arrow-hover)" : "url(#arrow-small)") : undefined}
                        />
                        <text
                          x={from.x}
                          y={from.y - loopHeight - 8}
                          fill={textColor}
                          fontSize="14"
                          fontWeight="bold"
                          textAnchor="middle"
                          style={{ transition: 'fill 0.3s ease-in-out' }}
                        >
                          {edge.weight}
                        </text>
                      </g>
                    );
                  }

                  const oppositeExists = edges.some(e => e.from === edge.to && e.to === edge.from);
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

                    path = `M ${from.x} ${from.y} Q ${midX + offsetX} ${midY + offsetY} ${to.x} ${to.y}`;

                    textX = midX + offsetX;
                    textY = midY + offsetY;
                  } else {
                    path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
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
                        opacity: opacity,
                        transition: 'opacity 0.3s ease-in-out'
                      }}
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        style={{ transition: 'all 0.3s ease-in-out' }}
                        markerEnd={edge.type === "directed" ? (isHovered ? "url(#arrow-hover)" : "url(#arrow-normal)") : undefined}
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill={textColor}
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ transition: 'fill 0.3s ease-in-out' }}
                      >
                        {edge.weight}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* NODOS */}
              {nodes.map(node => (
                <div
                  key={node.id}
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
              ))}

              {/* MENU */}
              {showMenu && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: menuPosition.x, top: menuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!edgeType && (
                    <>
                      <p className="text-sm font-semibold mb-4 text-gray-300">
                        Tipo de arista
                      </p>
                      <button
                        onClick={() => setEdgeType("directed")}
                        className="w-full mb-3 bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition"
                      >
                        Dirigida →
                      </button>
                      <button
                        onClick={() => setEdgeType("undirected")}
                        className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-xl transition"
                      >
                        No dirigida
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setSelectedNode(null);
                          setTempConnection(null);
                          setEdgeType(null);
                          setWeight(1);
                          setWeightInput("1");
                        }}
                        className="w-full mt-3 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {edgeType && (
                    <>
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
                            setEdgeType(null);
                            setWeight(1);
                            setWeightInput("1");
                          }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

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
                      onClick={handleDeleteEdge}
                      className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
                    >
                      Eliminar arista
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* AQUI INICIA LA TABLA PERFECTAMENTE BALANCEADA */}
            {matrix.length > 0 && (
              <div className="mt-8 space-y-8">
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
                                <th key={node.id} className="px-4 py-2 text-center text-sm font-medium text-gray-300 border border-white/20 bg-white/10">{node.label}</th>
                              ))}
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Σ</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Count</th>
                              <th className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.map((row, i) => (
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
                                        : 'bg-blue-900/30 text-blue-300 font-medium'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                                <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {rowSums[i]}
                                </td>
                                <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {rowCounts[i]}
                                </td>
                                <td className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {rowMaxs[i]}
                                </td>
                              </tr>
                            ))}
                            
                            {/* FILA EXTRA: SUMA DE COLUMNAS */}
                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20 text-center">Σ</td>
                              {colSums.map((sum, j) => (
                                <td key={`colsum-${j}`} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {sum}
                                </td>
                              ))}
                              <td colSpan={3} className="border border-white/20 bg-cyan-900/20"></td>
                            </tr>

                            {/* FILA EXTRA: COUNT DE COLUMNAS */}
                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20 text-center">Count</td>
                              {colCounts.map((count, j) => (
                                <td key={`colcount-${j}`} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {count}
                                </td>
                              ))}
                              <td colSpan={3} className="border border-white/20 bg-cyan-900/20"></td>
                            </tr>

                            {/* FILA EXTRA: MAX DE COLUMNAS */}
                            <tr>
                              <td className="px-4 py-2 text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20 text-center">Max</td>
                              {colMaxs.map((max, j) => (
                                <td key={`colmax-${j}`} className="px-4 py-2 text-center text-sm font-medium text-cyan-300 border border-white/20 bg-cyan-900/20">
                                  {max}
                                </td>
                              ))}
                              <td colSpan={3} className="border border-white/20 bg-cyan-900/20"></td>
                            </tr>
                            
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
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
              Guía: Creación de Grafos
            </h2>
            <div className="text-slate-300 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-4 text-slate-300">
                <p>Bienvenido al <strong>Panel de Grafos</strong>. Aquí puedes diseñar la estructura base de tu red.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Crear Nodos:</strong> Selecciona la herramienta 'Agregar Nodo' y haz clic en cualquier parte del lienzo.</li>
                  <li><strong>Crear Aristas:</strong> Selecciona la herramienta de arista (Dirigida o No Dirigida). Haz clic en el nodo de origen y luego en el nodo de destino.</li>
                  <li><strong>Asignar Pesos:</strong> Al crear una arista, se te pedirá que ingreses un valor o costo. Este valor es crucial para los algoritmos.</li>
                  <li><strong>Importar/Exportar:</strong> Usa los botones superiores para guardar tu trabajo en tu computadora y cargarlo más tarde.</li>
                </ul>
                <p className="text-amber-200/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 mt-4">
                  💡 <em>Tip: Asegúrate de estructurar bien tu grafo aquí antes de pasar a las pestañas de algoritmos.</em>
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

export default Grafos;