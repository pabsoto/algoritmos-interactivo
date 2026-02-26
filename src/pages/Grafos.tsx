import { useState, useRef, useEffect } from "react";
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
  type: "directed" | "undirected";
  weight: number;
};

const Grafos = () => {
  const [connectMode, setConnectMode] = useState(false);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);

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

  /* ---------- CREAR NODO ---------- */
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (connectMode) return;

    const rect = containerRef.current!.getBoundingClientRect();

    const newNode: NodeType = {
      id: nodes.length + 1,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label: String.fromCharCode(65 + nodes.length),
    };

    setNodes(prev => [...prev, newNode]);
  };

  /* ---------- CLICK EN NODO ---------- */
  const handleNodeClick = (node: NodeType) => {
    if (!connectMode) return;

    if (!selectedNode) {
      setSelectedNode(node);
    } else {
      setTempConnection({ from: selectedNode, to: node });
      setMenuPosition({ x: node.x + 30, y: node.y });
      setShowMenu(true);
      setSelectedNode(null);
    }
  };

  /* ---------- CREAR ARISTA ---------- */
  const createEdge = () => {
    if (!tempConnection || !edgeType) return;

    const newEdge: EdgeType = {
      from: tempConnection.from.id,
      to: tempConnection.to.id,
      type: edgeType,
      weight,
    };

    setEdges(prev => [...prev, newEdge]);

    setShowMenu(false);
    setEdgeType(null);
    setTempConnection(null);
    setWeight(1);
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

  const rowCounts = matrix.map(row => row.length);
  const colCounts = matrix[0]?.map((_, j) => matrix.length) || [];

  const rowMaxs = matrix.map(row =>
    row.length > 0 ? Math.max(...row) : 0
  );
  const colMaxs =
    matrix[0]?.map((_, j) =>
      Math.max(0, ...matrix.map(row => row[j]))
    ) || [];

  const maxRowSum = rowSums.length > 0 ? Math.max(...rowSums) : 0;
  const maxColSum = colSums.length > 0 ? Math.max(...colSums) : 0;

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
              onClick={() => setConnectMode(v => !v)}
              className={`w-full py-3 rounded-2xl font-semibold transition-all duration-300 shadow-lg ${
                connectMode
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {connectMode ? "Modo conexión activo" : "Activar conexión"}
            </button>

            <button
              onClick={clearGraph}
              className="w-full py-3 rounded-2xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg transition"
            >
              Limpiar todo
            </button>

            <button
              onClick={generateAdjacencyMatrix}
              className="w-full py-3 rounded-2xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition"
            >
              Generar matriz de adyacencia
            </button>
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
                    id="arrow"
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
                          deleteEdge(index);
                        }}
                        style={{ pointerEvents: "auto", cursor: "pointer" }}
                      >
                        <path
                          d={`M ${startX} ${startY}
                              C ${control1X} ${control1Y},
                                ${control2X} ${control2Y},
                                ${endX} ${endY}`}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="3"
                          markerEnd={
                            edge.type === "directed"
                              ? "url(#arrow)"
                              : undefined
                          }
                        />
                        <text
                          x={from.x}
                          y={from.y - loopHeight - 8}
                          fill="#f8fafc"
                          fontSize="14"
                          fontWeight="bold"
                          textAnchor="middle"
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
                        deleteEdge(index);
                      }}
                      style={{ pointerEvents: "auto", cursor: "pointer" }}
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="3"
                        markerEnd={
                          edge.type === "directed"
                            ? "url(#arrow)"
                            : undefined
                        }
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill="#f8fafc"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    deleteNode(node.id);
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
                    </>
                  )}

                  {edgeType && (
                    <>
                      <p className="text-sm mb-2 text-gray-300">Peso</p>
                      <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4"
                      />
                      <button
                        onClick={createEdge}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition"
                      >
                        Confirmar
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>

            {matrix.length > 0 && (
              <div className="mt-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl overflow-auto">
                <h2 className="text-xl font-bold text-white mb-4">
                  Matriz de Adyacencia
                </h2>
                <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
                  <div>
                <table className="text-white border-collapse">
                  <thead>
                    <tr>
                      <th></th>
                      {nodes.map(node => (
                        <th key={node.id}>{node.label}</th>
                      ))}
                      <th>Σ</th>
                      <th>Count</th>
                      <th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => (
                      <tr key={i}>
                        <td>{nodes[i]?.label}</td>

                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="border border-white/20 px-4 py-2 text-center"
                          >
                            {cell}
                          </td>
                        ))}

                        <td className="border border-white/20 px-4 py-2 text-center">
                          {rowSums[i]}
                        </td>
                        <td className="border border-white/20 px-4 py-2 text-center">
                          {rowCounts[i]}
                        </td>
                        <td className="border border-white/20 px-4 py-2 text-center">
                          {rowMaxs[i]}
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td>Σ</td>
                      {colSums.map((sum, index) => (
                        <td
                          key={index}
                          className="border border-white/20 px-4 py-2 text-center"
                        >
                          {sum}
                        </td>
                      ))}
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                    </tr>

                    <tr>
                      <td>Count</td>
                      {colCounts.map((count, index) => (
                        <td
                          key={index}
                          className="border border-white/20 px-4 py-2 text-center"
                        >
                          {count}
                        </td>
                      ))}
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                    </tr>

                    <tr>
                      <td>Max</td>
                      {colMaxs.map((maxVal, index) => (
                        <td
                          key={index}
                          className="border border-white/20 px-4 py-2 text-center"
                        >
                          {maxVal}
                        </td>
                      ))}
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                      <td className="border border-white/20 px-4 py-2 text-center"></td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: "10px" }}>
                  <p>
                    <strong>Máximo suma por filas:</strong> {maxRowSum}
                  </p>
                  <p>
                    <strong>Máximo suma por columnas:</strong> {maxColSum}
                  </p>
                </div>
                  </div>
                  <div>
                <div style={{ marginTop: "10px" }}>
                  <p>
                    El valor más grande de la suma de las filas es:
                    <strong> {maxRowSum} </strong>
                  </p>
                  <p>
                    El valor más grande de la suma de las columnas es:
                    <strong> {maxColSum} </strong>
                  </p>
                </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Grafos;
