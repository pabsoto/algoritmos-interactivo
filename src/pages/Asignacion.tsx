import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { MousePointer2, Upload, Download, Trash2, TrendingDown, TrendingUp } from "lucide-react";

type NodeType = {
  id: number;
  x: number;
  y: number;
  label: string;
  type: "agent" | "task";
};

type EdgeType = {
  from: number;
  to: number;
  type: "directed" | "undirected";
  weight: number;
};

const Asignacion = () => {
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

  // Estado para panel de selección de tipo de nodo
  const [showNodeTypeMenu, setShowNodeTypeMenu] = useState(false);
  const [nodeTypePosition, setNodeTypePosition] = useState({ x: 0, y: 0 });

  // Contadores separados para numeración independiente
  const [agentCount, setAgentCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  // Estado para panel de peso de asignación
  const [showWeightMenu, setShowWeightMenu] = useState(false);
  const [weightMenuPosition, setWeightMenuPosition] = useState({ x: 0, y: 0 });
  const [assignmentWeight, setAssignmentWeight] = useState<string>("1");
  const [pendingConnection, setPendingConnection] = useState<{ from: NodeType; to: NodeType } | null>(null);

  // Estado para algoritmo húngaro
  const [hungarianSteps, setHungarianSteps] = useState<number[][][]>([]);
  const [finalAssignment, setFinalAssignment] = useState<{row: number, col: number}[]>([]);
  const [minCost, setMinCost] = useState<number | null>(null);
  const [maxValue, setMaxValue] = useState<number | null>(null);

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


  // Cargar grafo desde localStorage al montar el componente
  useEffect(() => {
    const savedGraph = localStorage.getItem("asignacion_guardado");

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

    localStorage.setItem("asignacion_guardado", JSON.stringify(graphData));
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
    if (showMenu || editingNode || editingEdge || showNodeTypeMenu) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Detectar si hay un nodo en la posición del click
    const clickedNode = detectNodeAtPosition(clickX, clickY);

    if (clickedNode) {
      // Click sobre nodo: abrir panel de conexión
      handleNodeClick(clickedNode);
    } else {
      // Click en espacio vacío: mostrar panel de selección de tipo de nodo
      setNodeTypePosition({ x: clickX, y: clickY });
      setShowNodeTypeMenu(true);
    }
  };

  /* ---------- CREAR NODO CON TIPO ---------- */
  const createNodeWithType = (type: "agent" | "task") => {
    // Calcular contadores basados en nodos existentes
    const existingAgents = nodes.filter(n => n.type === "agent").length;
    const existingTasks = nodes.filter(n => n.type === "task").length;
    
    let newLabel: string;
    let newId: number;
    
    if (type === "agent") {
      newLabel = `Origen ${existingAgents + 1}`;
      newId = existingAgents + 1;
    } else {
      newLabel = `Destino ${existingTasks + 1}`;
      newId = existingTasks + 1000; // Usar IDs altos para tareas para evitar conflictos
    }
    
    const newNode: NodeType = {
      id: newId,
      x: nodeTypePosition.x,
      y: nodeTypePosition.y,
      label: newLabel,
      type,
    };
    setNodes(prev => [...prev, newNode]);
    setShowNodeTypeMenu(false);
  };

  /* ---------- CLICK EN NODO ---------- */
  const handleNodeClick = (node: NodeType) => {
    if (!selectedNode) {
      setSelectedNode(node);
    } else {
      // Validar que solo se permita Agente → Tarea
      if (selectedNode.type === "agent" && node.type === "task") {
        // Conexión válida: usar el mismo mecanismo que Grafos.tsx
        setTempConnection({ from: selectedNode, to: node });
        setMenuPosition({ x: node.x + 30, y: node.y });
        setShowMenu(true);
        setSelectedNode(null);
      } else {
        // Conexión inválida: cancelar silenciosamente
        setSelectedNode(null);
      }
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

  /* ---------- CREAR ARISTA DE ASIGNACIÓN ---------- */
  const createAssignmentEdge = () => {
    if (!pendingConnection) return;

    const finalWeight = assignmentWeight === "" ? 1 : Number(assignmentWeight);

    const newEdge: EdgeType = {
      from: pendingConnection.from.id,
      to: pendingConnection.to.id,
      type: "directed", // Siempre dirigida para asignación
      weight: finalWeight,
    };

    setEdges(prev => [...prev, newEdge]);

    // Limpiar estados
    setShowWeightMenu(false);
    setPendingConnection(null);
    setAssignmentWeight("1");
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
    setAgentCount(0);
    setTaskCount(0);
    setShowWeightMenu(false);
    setPendingConnection(null);

    localStorage.removeItem("asignacion_guardado");
  };

  /* ---------- GENERAR MATRIZ DE ASIGNACIÓN ---------- */
  const generateAssignmentMatrix = (mode: "minimize" | "maximize") => {
    const agents = nodes.filter(n => n.type === "agent");
    const tasks = nodes.filter(n => n.type === "task");
    
    // Validación: número de agentes debe ser igual al número de tareas
    if (agents.length !== tasks.length) {
      alert("El número de agentes y tareas debe ser igual para generar la matriz de asignación.");
      return;
    }
    
    if (agents.length === 0) {
      alert("Debe haber al menos un agente y una tarea para generar la matriz.");
      return;
    }
    
    // Crear matriz bipartita: agentes.length x tareas.length
    const newMatrix: number[][] = agents.map(agente =>
      tasks.map(tarea => {
        const edge = edges.find(
          e => e.from === agente.id && e.to === tarea.id
        );
        return edge ? edge.weight : 0;
      })
    );

    setMatrix(newMatrix);
    
    // Si es modo minimizar, ejecutar algoritmo húngaro directamente
    if (mode === "minimize") {
      runHungarianAlgorithm(newMatrix);
    } else if (mode === "maximize") {
      // Para maximización: transformar matriz de beneficios a matriz de costos
      const maxValue = Math.max(...newMatrix.flat());
      const transformedMatrix = newMatrix.map(row =>
        row.map(value => maxValue - value)
      );
      
      // Ejecutar algoritmo húngaro en matriz transformada
      runHungarianAlgorithm(transformedMatrix, newMatrix, true); // true = maximization mode
    }
  };

  /* ---------- FUNCIONES AUXILIARES ALGORITMO HÚNGARO ---------- */
  function cloneMatrix(matrix: number[][]) {
    return matrix.map(row => [...row]);
  }

  /* ---------- ALGORITMO HÚNGARO ---------- */
  function runHungarianAlgorithm(matrix: number[][], originalMatrix?: number[][], isMaximization: boolean = false) {
    const steps: number[][][] = [];
    let currentMatrix = cloneMatrix(matrix);
    const matrixSize = matrix.length;
    
    // STEP 0 - Store original matrix (transformed matrix for maximization)
    steps.push(cloneMatrix(currentMatrix));
    
    // STEP 1 - Row reduction
    let rowReduced = currentMatrix.map(row => {
      const min = Math.min(...row);
      return row.map(v => v - min);
    });
    steps.push(cloneMatrix(rowReduced));
    
    // STEP 2 - Column reduction
    let colReduced = cloneMatrix(rowReduced);
    for (let j = 0; j < colReduced[0].length; j++) {
      let column = colReduced.map(r => r[j]);
      let min = Math.min(...column);
      
      for (let i = 0; i < colReduced.length; i++) {
        colReduced[i][j] -= min;
      }
    }
    steps.push(cloneMatrix(colReduced));
    
    // MAIN LOOP - Continue until optimal condition is satisfied
    currentMatrix = colReduced;
    
    while (true) {
      const { count, coveredRows, coveredCols } = coverZeros(currentMatrix);
      
      // Stop condition: number of covering lines equals matrix size
      if (count === matrixSize) {
        break;
      }
      
      // Find smallest uncovered value
      const minUncovered = findSmallestUncovered(currentMatrix, { coveredRows, coveredCols });
      
      // Adjust matrix
      currentMatrix = adjustMatrix(currentMatrix, { coveredRows, coveredCols }, minUncovered);
      
      // Store new matrix as an iteration
      steps.push(cloneMatrix(currentMatrix));
    }
    
    // FINAL STEP - Assignment
    const assignment = findAssignment(currentMatrix);
    
    // Calculate cost/value using appropriate matrix
    let totalValue = 0;
    if (isMaximization && originalMatrix) {
      // For maximization: use original matrix to calculate total benefit
      assignment.forEach(a => {
        totalValue += originalMatrix[a.row][a.col];
      });
    } else {
      // For minimization: use provided matrix
      assignment.forEach(a => {
        totalValue += matrix[a.row][a.col];
      });
    }
    
    setHungarianSteps(steps);
    setFinalAssignment(assignment);
    setMinCost(isMaximization ? null : totalValue);
    setMaxValue(isMaximization ? totalValue : null);
  }
  
  function coverZeros(matrix: number[][]) {
    const n = matrix.length;
    const coveredRows = new Set<number>();
    const coveredCols = new Set<number>();
    
    // Find minimum number of lines to cover all zeros
    // Simple implementation: try to cover zeros efficiently
    const zeros: {row: number, col: number}[] = [];
    
    // Collect all zero positions
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i][j] === 0) {
          zeros.push({ row: i, col: j });
        }
      }
    }
    
    // Greedy approach: cover rows/columns with most zeros
    while (zeros.length > 0) {
      // Count zeros per row and column
      const rowCount = new Array(n).fill(0);
      const colCount = new Array(n).fill(0);
      
      zeros.forEach(zero => {
        if (!coveredRows.has(zero.row) && !coveredCols.has(zero.col)) {
          rowCount[zero.row]++;
          colCount[zero.col]++;
        }
      });
      
      // Find row or column with most uncovered zeros
      let maxCount = 0;
      let bestRow = -1;
      let bestCol = -1;
      let isRow = true;
      
      for (let i = 0; i < n; i++) {
        if (!coveredRows.has(i) && rowCount[i] > maxCount) {
          maxCount = rowCount[i];
          bestRow = i;
          isRow = true;
        }
      }
      
      for (let j = 0; j < n; j++) {
        if (!coveredCols.has(j) && colCount[j] > maxCount) {
          maxCount = colCount[j];
          bestCol = j;
          isRow = false;
        }
      }
      
      // Cover the best line
      if (isRow && bestRow !== -1) {
        coveredRows.add(bestRow);
      } else if (!isRow && bestCol !== -1) {
        coveredCols.add(bestCol);
      } else {
        // No more zeros to cover efficiently
        break;
      }
    }
    
    const count = coveredRows.size + coveredCols.size;
    
    return { count, coveredRows, coveredCols };
  }
  
  function findSmallestUncovered(matrix: number[][], covering: { coveredRows: Set<number>, coveredCols: Set<number> }) {
    const n = matrix.length;
    let minUncovered = Infinity;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!covering.coveredRows.has(i) && !covering.coveredCols.has(j)) {
          minUncovered = Math.min(minUncovered, matrix[i][j]);
        }
      }
    }
    
    return minUncovered;
  }
  
  function adjustMatrix(matrix: number[][], covering: { coveredRows: Set<number>, coveredCols: Set<number> }, minUncovered: number) {
    const n = matrix.length;
    const adjustedMatrix = cloneMatrix(matrix);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!covering.coveredRows.has(i) && !covering.coveredCols.has(j)) {
          // Uncovered element: subtract minUncovered
          adjustedMatrix[i][j] -= minUncovered;
        } else if (covering.coveredRows.has(i) && covering.coveredCols.has(j)) {
          // Intersection of covering lines: add minUncovered
          adjustedMatrix[i][j] += minUncovered;
        }
        // Covered elements (not at intersection): unchanged
      }
    }
    
    return adjustedMatrix;
  }
  
  function findAssignment(matrix: number[][]) {
    const n = matrix.length;
    const result: {row: number, col: number}[] = [];
    const usedCols = new Set<number>();

    function backtrack(row: number): boolean {
      if (row === n) {
        return true; // All rows assigned successfully
      }

      for (let col = 0; col < n; col++) {
        if (matrix[row][col] === 0 && !usedCols.has(col)) {
          // Try this assignment
          usedCols.add(col);
          result.push({ row, col });

          // Recurse to next row
          if (backtrack(row + 1)) {
            return true;
          }

          // Backtrack if this choice doesn't lead to solution
          usedCols.delete(col);
          result.pop();
        }
      }

      return false; // No valid assignment found for this row
    }

    backtrack(0);
    return result;
  }

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

  const tableContainerStyle: React.CSSProperties = {
    marginTop: "30px",
    padding: "30px",
    borderRadius: "22px",
    background: "linear-gradient(145deg,#0f172a,#1e293b)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
    overflowX: "auto",
    border: "1px solid #334155"
  };

  const matrixCellBase: React.CSSProperties = {
    border: "1px solid #334155",
    padding: "10px",
    textAlign: "center",
    minWidth: dynamicCellWidth + "px",
    height: "45px",
    whiteSpace: "nowrap"
  };

  const tableStyle: React.CSSProperties = {
    borderCollapse: "collapse",
    width: "100%",
    textAlign: "center",
    color: "#f1f5f9",
    fontSize: "15px"
  };

  const headerCellStyle: React.CSSProperties = {
    ...matrixCellBase,
    backgroundColor: "#334155",
    fontWeight: "bold"
  };

  const normalCellStyle: React.CSSProperties = {
    ...matrixCellBase,
    backgroundColor: "#0f172a"
  };

  const activeCellStyle: React.CSSProperties = {
    ...matrixCellBase,
    backgroundColor: "#2563eb",
    fontWeight: "bold",
    color: "#ffffff"
  };

  const sumCellStyle: React.CSSProperties = {
    ...matrixCellBase,
    backgroundColor: "#0ea5e9",
    fontWeight: "bold"
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
        {/* HEADER PROFESIONAL */}
        <div className="w-full bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Algoritmo de Asignación</h1>
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
                <span>Limpiar Todo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex gap-8">

          {/* PANEL */}
          <aside className="w-64 space-y-4">
            {/* TARJETA SUPERIOR - ESTADÍSTICAS */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Estadísticas</h2>
              <div className="space-y-2 text-gray-300 text-sm">
                <div className="flex justify-between">
                  <span>Agentes</span>
                  <span className="font-semibold text-white">{nodes.filter(n => n.type === "agent").length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tareas</span>
                  <span className="font-semibold text-white">{nodes.filter(n => n.type === "task").length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aristas</span>
                  <span className="font-semibold text-white">{edges.length}</span>
                </div>
              </div>
            </div>

            {/* TARJETA INFERIOR - ACCIONES DEL ALGORITMO */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Acciones del Algoritmo</h2>
              <div className="space-y-3">
                <button
                  onClick={() => generateAssignmentMatrix("minimize")}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-all duration-200"
                >
                  <TrendingDown size={18} />
                  <span>Minimizar</span>
                </button>
                <button
                  onClick={() => generateAssignmentMatrix("maximize")}
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

            <div style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "white",
              lineHeight: "1.5"
            }}>
              <b>Cómo usar el panel de asignación:</b><br/>
              • Click en el panel → elegir tipo de nodo<br/>
              • Click en un nodo y luego en otro → crear conexión<br/>
              • Click derecho en un nodo → editar nombre<br/>
              • Click derecho en una arista → editar valor<br/>
              • Los cambios se guardan automáticamente
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
                  <marker
                    id="arrow-optimal"
                    markerWidth="10"
                    markerHeight="10"
                    refX="10"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
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

                {(() => {
                  const agents = nodes.filter(n => n.type === 'agent');
                  const tasks = nodes.filter(n => n.type === 'task');
                  
                  return edges.map((edge, index) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  // Verificar si esta arista forma parte de la asignación óptima
                  const isOptimal = finalAssignment.some(assign => 
                    edge.from === agents[assign.row]?.id && 
                    edge.to === tasks[assign.col]?.id
                  );

                  
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
                          opacity: hoveredEdgeIndex !== null && hoveredEdgeIndex !== index ? 0.2 : 1
                        }}
                      >
                        <path
                          d={`M ${startX} ${startY}
                              C ${control1X} ${control1Y},
                                ${control2X} ${control2Y},
                                ${endX} ${endY}`}
                          fill="none"
                          stroke={hoveredEdgeIndex === index ? "#a7f3d0" : (isOptimal ? "#22c55e" : "#94a3b8")}
                          strokeWidth={hoveredEdgeIndex === index ? 5 : (isOptimal ? 4 : 3)}
                          markerEnd={
                            edge.type === "directed"
                              ? hoveredEdgeIndex === index ? "url(#arrow-hover)" : (isOptimal ? "url(#arrow-optimal)" : "url(#arrow-small)")
                              : undefined
                          }
                          style={{ transition: 'all 0.3s ease-in-out' }}
                        />
                        <text
                          x={from.x}
                          y={from.y - loopHeight - 8}
                          fill={hoveredEdgeIndex === index ? "#a7f3d0" : (isOptimal ? "#22c55e" : "#f8fafc")}
                          fontSize="14"
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
                        opacity: hoveredEdgeIndex !== null && hoveredEdgeIndex !== index ? 0.2 : 1
                      }}
                    >
                      <path
                        d={path}
                        fill="none"
                        stroke={hoveredEdgeIndex === index ? "#a7f3d0" : (isOptimal ? "#22c55e" : "#94a3b8")}
                        strokeWidth={hoveredEdgeIndex === index ? 5 : (isOptimal ? 4 : 3)}
                        markerEnd={
                          edge.type === "directed"
                            ? hoveredEdgeIndex === index ? "url(#arrow-hover)" : (isOptimal ? "url(#arrow-optimal)" : "url(#arrow-normal)")
                            : undefined
                        }
                        style={{ transition: 'all 0.3s ease-in-out' }}
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill={hoveredEdgeIndex === index ? "#a7f3d0" : (isOptimal ? "#22c55e" : "#f8fafc")}
                        fontSize="14"
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
                });
                })()}
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
                    // Double-click should only open connection panel
                    // No automatic loop creation
                    handleNodeClick(node);
                  }}
                  className="absolute h-14 rounded-full flex items-center justify-center text-center text-sm font-bold cursor-pointer transition-all duration-300 shadow-2xl hover:scale-110 min-w-[3.5rem] px-3 whitespace-nowrap"
                  style={{
                    left: node.x - 28, // Ajustado para centrar mejor
                    top: node.y - 28,  // Ajustado para centrar mejor
                    background:
                      node.type === "agent"
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,#3b82f6,#2563eb)",
                    boxShadow:
                      node.type === "agent"
                        ? "0 0 20px rgba(16,185,129,0.6)"
                        : "0 0 20px rgba(59,130,246,0.6)",
                    color: "white",
                  }}
                >
                  {node.label}
                </div>
              ))}

              {/* MENU DE CONEXIÓN - ASIGNACIÓN */}
              {showMenu && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: menuPosition.x, top: menuPosition.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold mb-4 text-gray-300">
                    Peso de la asignación
                  </p>
                  <p className="text-sm mb-2 text-gray-400">
                    {tempConnection && `${tempConnection.from.label} -&gt; ${tempConnection.to.label}`}
                  </p>
                  <input
                    type="text"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4"
                    placeholder="Peso"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (tempConnection) {
                          const finalWeight = weightInput === "" ? 1 : Number(weightInput);
                          const newEdge: EdgeType = {
                            from: tempConnection.from.id,
                            to: tempConnection.to.id,
                            type: "directed", // Siempre dirigida para asignación
                            weight: finalWeight,
                          };
                          setEdges(prev => [...prev, newEdge]);
                        }
                        setShowMenu(false);
                        setSelectedNode(null);
                        setTempConnection(null);
                        setWeightInput("1");
                      }}
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

              {/* PANEL DE SELECCIÓN DE TIPO DE NODO */}
              {showNodeTypeMenu && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/10"
                  style={{ left: nodeTypePosition.x - 120, top: nodeTypePosition.y - 100 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold mb-4 text-gray-300">
                    Crear nodo
                  </p>
                  <p className="text-sm mb-4 text-gray-400">
                    Tipo de nodo:
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => createNodeWithType("agent")}
                      className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-xl transition"
                    >
                      Origen
                    </button>
                    <button
                      onClick={() => createNodeWithType("task")}
                      className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition"
                    >
                      Destino
                    </button>
                    <button
                      onClick={() => setShowNodeTypeMenu(false)}
                      className="w-full mt-3 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

            </div>

            {matrix.length > 0 && (
              <div style={tableContainerStyle}>
                <h2 className="text-xl font-bold text-white mb-4">
                  Matriz de Asignación
                </h2>
                <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
                  <div>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={headerCellStyle}></th>
                      {nodes.filter(n => n.type === "task").map(task => (
                        <th key={task.id} style={headerCellStyle}>{task.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => {
                      const agents = nodes.filter(n => n.type === "agent");
                      const currentAgent = agents[i];
                      return (
                        <tr key={i}>
                          <td style={headerCellStyle}>{currentAgent?.label}</td>

                          {row.map((cell, j) => (
                            <td
                              key={j}
                              style={cell !== 0 ? activeCellStyle : normalCellStyle}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN ALGORITMO HÚNGARO */}
            {hungarianSteps.length > 0 && (
              <div style={tableContainerStyle}>
                <h2 className="text-xl font-bold text-white mb-4">
                  Iteraciones del Algoritmo Húngaro
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {hungarianSteps.map((step, index) => {
                    const isLastIteration = index === hungarianSteps.length - 1;
                    return (
                      <div key={index}>
                        <h3 className="text-lg font-semibold text-white mb-2">
                          Iteración {index === 0 ? "Matriz Original" : 
                                    index === 1 ? "Reducción por Filas" :
                                    index === 2 ? "Reducción por Columnas" :
                                    `Ajuste de Matriz ${index - 2}`}
                        </h3>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={headerCellStyle}></th>
                              {nodes.filter(n => n.type === "task").map(task => (
                                <th key={task.id} style={headerCellStyle}>{task.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {step.map((row, i) => {
                              const agents = nodes.filter(n => n.type === "agent");
                              const currentAgent = agents[i];
                              return (
                                <tr key={i}>
                                  <td style={headerCellStyle}>{currentAgent?.label}</td>
                                  {row.map((cell, j) => {
                                    // Check if this cell is part of the final assignment (only in last iteration)
                                    const isAssignmentCell = isLastIteration && 
                                      finalAssignment.some(a => a.row === i && a.col === j);
                                    
                                    let cellStyle;
                                    if (isAssignmentCell) {
                                      cellStyle = {
                                        backgroundColor: "#22c55e",
                                        color: "white",
                                        fontWeight: "bold"
                                      };
                                    } else {
                                      cellStyle = cell !== 0 ? activeCellStyle : normalCellStyle;
                                    }
                                    
                                    return (
                                      <td
                                        key={j}
                                        style={cellStyle}
                                      >
                                        {cell}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RESULTADO FINAL */}
            {finalAssignment.length > 0 && (
              <div style={tableContainerStyle}>
                <h2 className="text-xl font-bold text-white mb-4">
                  Asignación Óptima
                </h2>
                <div className="space-y-2 text-white">
                  {finalAssignment.map((assignment, index) => {
                    const agents = nodes.filter(n => n.type === "agent");
                    const tasks = nodes.filter(n => n.type === "task");
                    const agent = agents[assignment.row];
                    const task = tasks[assignment.col];
                    return (
                      <div key={index} className="flex justify-between">
                        <span>{agent?.label} → {task?.label}</span>
                        <span className="font-semibold">
                          {minCost !== null ? `Costo: ${matrix[assignment.row][assignment.col]}` : `Valor: ${matrix[assignment.row][assignment.col]}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-white">
                  {minCost !== null ? (
                    <h3 className="text-lg font-semibold mb-2">Costo Total Mínimo: {minCost}</h3>
                  ) : (
                    <h3 className="text-lg font-semibold mb-2">Valor Total Máximo: {maxValue}</h3>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Asignacion;
