import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  TreePine,
  Plus,
  Shuffle,
  Trash2,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
} from "lucide-react";

interface BSTNode {
  id: string;
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
}

interface NodePosition {
  id: string;
  value: number;
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
}

const Arboles = () => {
  const [mode, setMode] = useState<"visualize" | "reconstruct">("visualize");
  const [root, setRoot] = useState<BSTNode | null>(null);
  const [inputValue, setInputValue] = useState<string>("");

  // Edit state
  const [editingNode, setEditingNode] = useState<NodePosition | null>(null);
  const [editValueInput, setEditValueInput] = useState<string>("");

  // Reconstruct state
  const [preOrderInput, setPreOrderInput] = useState<string>("");
  const [inOrderInput, setInOrderInput] = useState<string>("");
  const [postOrderInput, setPostOrderInput] = useState<string>("");
  const [reconstructType, setReconstructType] = useState<"pre-in" | "post-in">(
    "pre-in",
  );

  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 600 });

  // Pan & Zoom state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [mouseStart, setMouseStart] = useState({ x: 0, y: 0 });
  const [treeOriginX, setTreeOriginX] = useState<number>(0);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setCanvasSize({
          width,
          height: 600,
        });
        if (treeOriginX === 0) setTreeOriginX(width / 2);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [treeOriginX]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingNode) return;
    setIsPanning(true);
    setMouseStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - mouseStart.x,
      y: e.clientY - mouseStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const insertNode = (value: number, node: BSTNode | null): BSTNode => {
    if (!node) {
      return {
        id: Math.random().toString(36).slice(2, 11),
        value,
        left: null,
        right: null,
      };
    }
    if (value < node.value) {
      return { ...node, left: insertNode(value, node.left) };
    } else if (value > node.value) {
      return { ...node, right: insertNode(value, node.right) };
    }
    return node;
  };

  const handleAddNode = () => {
    const val = parseInt(inputValue);
    if (isNaN(val)) return;
    if (!root) {
      setTreeOriginX(canvasSize.width / 2 - panOffset.x);
    }
    const newRoot = insertNode(val, root ? { ...root } : null);
    setRoot(newRoot);
    setInputValue("");
  };

  const handleAddRandomNode = () => {
    const val = Math.floor(Math.random() * 100) + 1;
    if (!root) {
      setTreeOriginX(canvasSize.width / 2 - panOffset.x);
    }
    const newRoot = insertNode(val, root ? { ...root } : null);
    setRoot(newRoot);
  };

  const handleClearTree = () => {
    setRoot(null);
    setNodePositions([]);
    setPreOrderInput("");
    setInOrderInput("");
    setPostOrderInput("");
  };

  const updateRecursive = (
    node: BSTNode | null,
    id: string,
    newValue: number,
  ): BSTNode | null => {
    if (!node) return null;
    if (node.id === id) {
      return { ...node, value: newValue };
    }
    return {
      ...node,
      left: updateRecursive(node.left, id, newValue),
      right: updateRecursive(node.right, id, newValue),
    };
  };

  const deleteRecursive = (
    node: BSTNode | null,
    id: string,
  ): BSTNode | null => {
    if (!node) return null;
    if (node.id === id) return null; // Simple delete (doesn't handle BST restructuring)
    return {
      ...node,
      left: deleteRecursive(node.left, id),
      right: deleteRecursive(node.right, id),
    };
  };

  const handleConfirmEdit = () => {
    if (!editingNode || !root) return;
    const newVal = parseInt(editValueInput);
    if (isNaN(newVal)) return;
    const newRoot = updateRecursive(root, editingNode.id, newVal);
    setRoot(newRoot);
    setEditingNode(null);
  };

  const handleDeleteNode = () => {
    if (!editingNode || !root) return;
    const newRoot = deleteRecursive(root, editingNode.id);
    setRoot(newRoot);
    setEditingNode(null);
  };

  const handleSetAsRoot = () => {
    if (!editingNode || !root) return;

    // Get all values currently in the tree
    const allValues = getInOrder(root);
    const newRootValue = editingNode.value;

    // Filter out the value that will be the new root
    // (assuming values are unique for simplicity in BST)
    const otherValues = allValues.filter((v) => v !== newRootValue);

    // Create new root
    let newTree: BSTNode = {
      id: Math.random().toString(36).slice(2, 11),
      value: newRootValue,
      left: null,
      right: null,
    };

    // Re-insert all other values
    otherValues.forEach((val) => {
      newTree = insertNode(val, newTree);
    });

    setRoot(newTree);
    setEditingNode(null);
  };

  const handleExportTree = () => {
    if (!root) return;
    const fileName = prompt(
      "Introduce el nombre del archivo:",
      "arbol-binario",
    );
    if (!fileName) return;

    const dataStr = JSON.stringify(root, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTree = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const treeData = JSON.parse(e.target?.result as string);
        setTreeOriginX(canvasSize.width / 2 - panOffset.x);
        setRoot(treeData);
      } catch (error) {
        alert("Error al importar el árbol. El archivo no es un JSON válido.");
      }
    };
    reader.readAsText(file);
  };

  const buildTreeFromPreIn = (
    pre: number[],
    inorder: number[],
  ): BSTNode | null => {
    if (pre.length === 0 || inorder.length === 0) return null;

    const rootVal = pre[0];
    const rootNode: BSTNode = {
      id: Math.random().toString(36).slice(2, 11),
      value: rootVal,
      left: null,
      right: null,
    };

    const mid = inorder.indexOf(rootVal);
    if (mid === -1) return null;

    rootNode.left = buildTreeFromPreIn(
      pre.slice(1, mid + 1),
      inorder.slice(0, mid),
    );
    rootNode.right = buildTreeFromPreIn(
      pre.slice(mid + 1),
      inorder.slice(mid + 1),
    );

    return rootNode;
  };

  const buildTreeFromPostIn = (
    post: number[],
    inorder: number[],
  ): BSTNode | null => {
    if (post.length === 0 || inorder.length === 0) return null;

    const rootVal = post[post.length - 1];
    const rootNode: BSTNode = {
      id: Math.random().toString(36).slice(2, 11),
      value: rootVal,
      left: null,
      right: null,
    };

    const mid = inorder.indexOf(rootVal);
    if (mid === -1) return null;

    rootNode.left = buildTreeFromPostIn(
      post.slice(0, mid),
      inorder.slice(0, mid),
    );
    rootNode.right = buildTreeFromPostIn(
      post.slice(mid, post.length - 1),
      inorder.slice(mid + 1),
    );

    return rootNode;
  };

  const handleReconstruct = () => {
    try {
      const inNodes = inOrderInput
        .split(/[, ]+/)
        .filter((x) => x)
        .map(Number);

      // Basic validation
      if (inNodes.some(isNaN)) {
        alert("Los datos contienen valores no numéricos.");
        return;
      }

      if (new Set(inNodes).size !== inNodes.length) {
        alert("La reconstrucción requiere valores únicos en los recorridos.");
        return;
      }

      let reconstructed: BSTNode | null = null;
      setTreeOriginX(canvasSize.width / 2 - panOffset.x);

      if (reconstructType === "pre-in") {
        const preNodes = preOrderInput
          .split(/[, ]+/)
          .filter((x) => x)
          .map(Number);
        if (preNodes.length !== inNodes.length) {
          alert(
            "Los recorridos Pre-order e In-order deben tener el mismo tamaño.",
          );
          return;
        }
        // Check if they contain the same elements
        const preSet = new Set(preNodes);
        if (!inNodes.every((val) => preSet.has(val))) {
          alert(
            "Error: Los recorridos Pre-order e In-order no contienen los mismos elementos.",
          );
          return;
        }
        reconstructed = buildTreeFromPreIn(preNodes, inNodes);
      } else {
        const postNodes = postOrderInput
          .split(/[, ]+/)
          .filter((x) => x)
          .map(Number);
        if (postNodes.length !== inNodes.length) {
          alert(
            "Los recorridos Post-order e In-order deben tener el mismo tamaño.",
          );
          return;
        }
        // Check if they contain the same elements
        const postSet = new Set(postNodes);
        if (!inNodes.every((val) => postSet.has(val))) {
          alert(
            "Error: Los recorridos Post-order e In-order no contienen los mismos elementos.",
          );
          return;
        }
        reconstructed = buildTreeFromPostIn(postNodes, inNodes);
      }

      if (reconstructed) {
        setRoot(reconstructed);
        setMode("visualize");
        setPreOrderInput("");
        setInOrderInput("");
        setPostOrderInput("");
      } else {
        alert(
          "No se pudo reconstruir el árbol. Verifica que el orden de los elementos sea consistente.",
        );
      }
    } catch (e) {
      alert(
        "Error crítico al procesar los datos. Verifica el formato de entrada.",
      );
    }
  };

  useEffect(() => {
    if (!root) {
      setNodePositions([]);
      return;
    }

    const positions: NodePosition[] = [];
    const levelHeight = 100; // Increased spacing
    const initialSpread = canvasSize.width / 3.5; // Increased initial spread

    const calculatePositions = (
      node: BSTNode,
      x: number,
      y: number,
      spread: number,
      parentX: number | null,
      parentY: number | null,
    ) => {
      positions.push({
        id: node.id,
        value: node.value,
        x,
        y,
        parentX,
        parentY,
      });

      if (node.left) {
        calculatePositions(
          node.left,
          x - spread,
          y + levelHeight,
          spread / 1.6, // Less aggressive reduction
          x,
          y,
        );
      }
      if (node.right) {
        calculatePositions(
          node.right,
          x + spread,
          y + levelHeight,
          spread / 1.6, // Less aggressive reduction
          x,
          y,
        );
      }
    };

    calculatePositions(root, treeOriginX, 60, initialSpread, null, null);
    setNodePositions(positions);
  }, [root, canvasSize.width, treeOriginX]);

  const getPreOrder = (
    node: BSTNode | null,
    result: number[] = [],
  ): number[] => {
    if (!node) return result;
    result.push(node.value);
    getPreOrder(node.left, result);
    getPreOrder(node.right, result);
    return result;
  };

  const getInOrder = (
    node: BSTNode | null,
    result: number[] = [],
  ): number[] => {
    if (!node) return result;
    getInOrder(node.left, result);
    result.push(node.value);
    getInOrder(node.right, result);
    return result;
  };

  const getPostOrder = (
    node: BSTNode | null,
    result: number[] = [],
  ): number[] => {
    if (!node) return result;
    getPostOrder(node.left, result);
    getPostOrder(node.right, result);
    result.push(node.value);
    return result;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
        {/* HEADER PROFESIONAL */}
        <div className="w-full flex justify-between items-center px-6 py-4 bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <TreePine className="text-emerald-500" /> Árboles Binarios
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-800 rounded-lg p-1 mr-4">
                <button
                  onClick={() => setMode("visualize")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "visualize" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  Visualizar
                </button>
                <button
                  onClick={() => setMode("reconstruct")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "reconstruct" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  Reconstruir
                </button>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Upload size={16} />
                <span>Importar</span>
              </button>

              <button
                onClick={handleExportTree}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent rounded-md transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                <Download size={16} />
                <span>Exportar</span>
              </button>

              <button
                onClick={handleClearTree}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-transparent rounded-md transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={handleImportTree}
        />

        <div className="max-w-7xl mx-auto flex gap-8">
          {/* PANEL */}
          <aside className="w-64 space-y-4">
            {/* PANEL DE EDICIÓN - Ahora en el sidebar */}
            {editingNode && (
              <div className="bg-emerald-600/10 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-4 shadow-2xl animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Editando: {editingNode.value}
                  </h2>
                  <button
                    onClick={() => setEditingNode(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus size={16} className="rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Nuevo Valor
                    </label>
                    <input
                      type="number"
                      value={editValueInput}
                      onChange={(e) => setEditValueInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleConfirmEdit}
                      className="bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition-all font-bold text-[10px] text-white shadow-lg shadow-emerald-900/20"
                    >
                      GUARDAR
                    </button>
                    <button
                      onClick={() => setEditingNode(null)}
                      className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl transition-all font-bold text-[10px] text-white border border-white/5"
                    >
                      CANCELAR
                    </button>
                  </div>

                  <div className="h-px bg-white/5 my-2" />

                  <button
                    onClick={handleSetAsRoot}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition-all font-bold text-[10px] text-white flex items-center justify-center gap-2"
                  >
                    <TreePine size={12} /> CONVERTIR EN RAÍZ
                  </button>

                  <button
                    onClick={handleDeleteNode}
                    className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-xl transition-all font-bold text-[10px] border border-red-500/30"
                  >
                    ELIMINAR NODO
                  </button>
                </div>
              </div>
            )}

            {mode === "visualize" ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
                <h2 className="text-lg font-bold text-white mb-4">
                  Control de Nodos
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">
                      Nuevo Nodo
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Valor"
                        className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleAddNode}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleAddRandomNode}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm"
                  >
                    <Shuffle size={16} /> Nodo Aleatorio
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
                <h2 className="text-lg font-bold text-white mb-2">
                  Reconstrucción
                </h2>
                <p className="text-[10px] text-slate-400 mb-4 italic leading-tight">
                  Combina el In-order con otro recorrido para recuperar la
                  estructura original.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">
                      1. Método
                    </label>
                    <select
                      value={reconstructType}
                      onChange={(e) =>
                        setReconstructType(e.target.value as any)
                      }
                      className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="pre-in">
                        Pre-order (Raíz primero) + In-order
                      </option>
                      <option value="post-in">
                        Post-order (Raíz al final) + In-order
                      </option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">
                      2. In-order (Izq-Raíz-Der)
                    </label>
                    <input
                      type="text"
                      value={inOrderInput}
                      onChange={(e) => setInOrderInput(e.target.value)}
                      placeholder="Ej: 4, 2, 5, 1, 3"
                      className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {reconstructType === "pre-in" ? (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">
                        3. Pre-order (Raíz-Izq-Der)
                      </label>
                      <input
                        type="text"
                        value={preOrderInput}
                        onChange={(e) => setPreOrderInput(e.target.value)}
                        placeholder="Ej: 1, 2, 4, 5, 3"
                        className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">
                        3. Post-order (Izq-Der-Raíz)
                      </label>
                      <input
                        type="text"
                        value={postOrderInput}
                        onChange={(e) => setPostOrderInput(e.target.value)}
                        placeholder="Ej: 4, 5, 2, 3, 1"
                        className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleReconstruct}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm"
                  >
                    Generar Árbol
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">
                Estadísticas
              </h2>
              <div className="space-y-4 text-slate-300 text-sm">
                <div className="flex justify-between">
                  <span>Total Nodos</span>
                  <span className="font-semibold text-white">
                    {nodePositions.length}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">
                      Pre-orden
                    </span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getPreOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase font-bold">
                      In-orden
                    </span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getInOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-purple-400 uppercase font-bold">
                      Post-orden
                    </span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getPostOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* GUÍA DE USO REUBICADA Y MEJORADA */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-2xl mt-4">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Settings size={12} className="text-emerald-500" /> Guía de Uso
              </h2>

              <div className="space-y-4">
                {mode === "visualize" ? (
                  <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      Modo Visualizar
                    </h3>
                    <ul className="text-[11px] text-slate-400 space-y-2">
                      <li className="flex gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>
                          Inserta el{" "}
                          <span className="text-white">valor deseado</span> o
                          usa <span className="text-white">Nodo Aleatorio</span>
                          .
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>
                          Haz <span className="text-white">Click</span> en
                          cualquier nodo para abrir el panel de edición.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>
                          Usa la <span className="text-white">Pizarra</span>:
                          Arrastra para moverte y usa el Zoom para navegar.
                        </span>
                      </li>
                    </ul>
                  </section>
                ) : (
                  <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      Modo Reconstruir
                    </h3>
                    <ul className="text-[11px] text-slate-400 space-y-2">
                      <li className="flex gap-2">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>
                          Ingresa los recorridos separados por{" "}
                          <span className="text-white">comas o espacios</span>.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>
                          Es vital que ambas listas tengan los{" "}
                          <span className="text-white">mismos elementos</span>{" "}
                          sin duplicados.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>
                          El <span className="text-white">In-order</span> define
                          la posición relativa (izquierda/derecha).
                        </span>
                      </li>
                    </ul>
                  </section>
                )}

                <div className="pt-4 border-t border-white/5">
                  <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                    <p className="text-[10px] text-slate-500 leading-tight">
                      <span className="text-emerald-400 font-bold uppercase mr-1">
                        Pro Tip:
                      </span>
                      Exporta tu trabajo en{" "}
                      <span className="text-slate-300">JSON</span> para
                      guardarlo o compartirlo con otros.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* CANVAS */}
          <div className="flex-1">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative rounded-3xl border border-white/10 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${isPanning ? "bg-slate-900/50" : ""}`}
              style={{
                height: "600px",
                background:
                  "radial-gradient(circle at center, #0f172a 0%, #020617 100%)",
              }}
            >
              {/* DRAGGABLE WRAPPER */}
              <div
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                  transition: isPanning ? "none" : "transform 0.2s ease-out",
                }}
              >
                {/* GRID - Extended to avoid edges during pan */}
                <div
                  className="absolute opacity-10"
                  style={{
                    width: "10000px",
                    height: "10000px",
                    top: "-5000px",
                    left: "-5000px",
                    backgroundImage:
                      "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    pointerEvents: "none",
                  }}
                />

                {/* SVG for connections - overflow visible fixes clipping */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ overflow: "visible", width: "1px", height: "1px" }}
                >
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient
                      id="line-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  {nodePositions.map(
                    (pos, idx) =>
                      pos.parentX !== null &&
                      pos.parentY !== null && (
                        <line
                          key={`line-${idx}`}
                          x1={pos.parentX}
                          y1={pos.parentY}
                          x2={pos.x}
                          y2={pos.y}
                          stroke="url(#line-gradient)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          style={{ filter: "url(#glow)", opacity: 0.6 }}
                        />
                      ),
                  )}
                </svg>

                {/* Nodes */}
                {nodePositions.map((pos, idx) => (
                  <div
                    key={`node-${idx}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode(pos);
                      setEditValueInput(pos.value.toString());
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingNode(pos);
                      setEditValueInput(pos.value.toString());
                    }}
                    className={`absolute animate-in zoom-in duration-500 flex items-center justify-center w-12 h-12 rounded-full text-white text-sm font-bold shadow-2xl transition-all hover:scale-110 cursor-pointer pointer-events-auto border-2 ${editingNode?.id === pos.id ? "border-emerald-400 scale-110 shadow-emerald-500/50" : "border-white/10"}`}
                    style={{
                      left: pos.x - 24,
                      top: pos.y - 24,
                      background:
                        editingNode?.id === pos.id
                          ? "linear-gradient(135deg, #059669, #2563eb)"
                          : "linear-gradient(135deg, #10b981, #3b82f6)",
                      boxShadow:
                        editingNode?.id === pos.id
                          ? "0 0 30px rgba(16, 185, 129, 0.6)"
                          : "0 0 20px rgba(16, 185, 129, 0.4)",
                      zIndex: editingNode?.id === pos.id ? 20 : 10,
                    }}
                  >
                    {pos.value}
                  </div>
                ))}
              </div>

              {nodePositions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 pointer-events-none">
                  <TreePine size={64} className="opacity-20" />
                  <p className="italic text-lg">
                    El lienzo está vacío. ¡Añade tu primer nodo!
                  </p>
                </div>
              )}

              {/* ZOOM CONTROLS */}
              <div
                className="absolute bottom-6 right-6 flex flex-col gap-2 z-30"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1">
                  <button
                    onClick={handleZoomIn}
                    className="p-2.5 rounded-xl hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-all"
                    title="Acercar"
                  >
                    <ZoomIn size={20} />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-2.5 rounded-xl hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-all"
                    title="Restablecer vista"
                  >
                    <Maximize size={20} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2.5 rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                    title="Alejar"
                  >
                    <ZoomOut size={20} />
                  </button>
                </div>
                <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 shadow-2xl text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest">
                  {Math.round(zoom * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Arboles;
