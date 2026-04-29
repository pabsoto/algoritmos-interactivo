import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { TreePine, Plus, Shuffle, Trash2, Download, Upload } from "lucide-react";

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
  const [reconstructType, setReconstructType] = useState<"pre-in" | "post-in">("pre-in");

  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: 600,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const insertNode = (value: number, node: BSTNode | null): BSTNode => {
    if (!node) {
      return { id: Math.random().toString(36).substr(2, 9), value, left: null, right: null };
    }
    if (value < node.value) {
      node.left = insertNode(value, node.left);
    } else if (value > node.value) {
      node.right = insertNode(value, node.right);
    }
    return node;
  };

  const handleAddNode = () => {
    const val = parseInt(inputValue);
    if (isNaN(val)) return;
    const newRoot = insertNode(val, root ? { ...root } : null);
    setRoot(newRoot);
    setInputValue("");
  };

  const handleAddRandomNode = () => {
    const val = Math.floor(Math.random() * 100) + 1;
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

  const updateRecursive = (node: BSTNode | null, id: string, newValue: number): BSTNode | null => {
    if (!node) return null;
    if (node.id === id) {
      return { ...node, value: newValue };
    }
    return {
      ...node,
      left: updateRecursive(node.left, id, newValue),
      right: updateRecursive(node.right, id, newValue)
    };
  };

  const deleteRecursive = (node: BSTNode | null, id: string): BSTNode | null => {
    if (!node) return null;
    if (node.id === id) return null; // Simple delete (doesn't handle BST restructuring)
    return {
      ...node,
      left: deleteRecursive(node.left, id),
      right: deleteRecursive(node.right, id)
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

  const handleExportTree = () => {
    if (!root) return;
    const fileName = prompt("Introduce el nombre del archivo:", "arbol-binario");
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
        setRoot(treeData);
      } catch (error) {
        alert("Error al importar el árbol. El archivo no es un JSON válido.");
      }
    };
    reader.readAsText(file);
  };

  const buildTreeFromPreIn = (pre: number[], inorder: number[]): BSTNode | null => {
    if (pre.length === 0 || inorder.length === 0) return null;
    
    const rootVal = pre[0];
    const rootNode: BSTNode = { 
      id: Math.random().toString(36).substr(2, 9), 
      value: rootVal, 
      left: null, 
      right: null 
    };
    
    const mid = inorder.indexOf(rootVal);
    if (mid === -1) return null;
    
    rootNode.left = buildTreeFromPreIn(pre.slice(1, mid + 1), inorder.slice(0, mid));
    rootNode.right = buildTreeFromPreIn(pre.slice(mid + 1), inorder.slice(mid + 1));
    
    return rootNode;
  };

  const buildTreeFromPostIn = (post: number[], inorder: number[]): BSTNode | null => {
    if (post.length === 0 || inorder.length === 0) return null;
    
    const rootVal = post[post.length - 1];
    const rootNode: BSTNode = { 
      id: Math.random().toString(36).substr(2, 9), 
      value: rootVal, 
      left: null, 
      right: null 
    };
    
    const mid = inorder.indexOf(rootVal);
    if (mid === -1) return null;
    
    rootNode.left = buildTreeFromPostIn(post.slice(0, mid), inorder.slice(0, mid));
    rootNode.right = buildTreeFromPostIn(post.slice(mid, post.length - 1), inorder.slice(mid + 1));
    
    return rootNode;
  };

  const handleReconstruct = () => {
    try {
      const inNodes = inOrderInput.split(/[, ]+/).filter(x => x).map(Number);
      if (reconstructType === "pre-in") {
        const preNodes = preOrderInput.split(/[, ]+/).filter(x => x).map(Number);
        if (preNodes.length !== inNodes.length) {
          alert("Los recorridos deben tener el mismo número de elementos.");
          return;
        }
        setRoot(buildTreeFromPreIn(preNodes, inNodes));
      } else {
        const postNodes = postOrderInput.split(/[, ]+/).filter(x => x).map(Number);
        if (postNodes.length !== inNodes.length) {
          alert("Los recorridos deben tener el mismo número de elementos.");
          return;
        }
        setRoot(buildTreeFromPostIn(postNodes, inNodes));
      }
    } catch (e) {
      alert("Error al parsear los datos. Asegúrate de usar números separados por comas o espacios.");
    }
  };

  useEffect(() => {
    if (!root) {
      setNodePositions([]);
      return;
    }

    const positions: NodePosition[] = [];
    const levelHeight = 80;
    const initialSpread = canvasSize.width / 4;

    const calculatePositions = (
      node: BSTNode,
      x: number,
      y: number,
      spread: number,
      parentX: number | null,
      parentY: number | null
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
          spread / 1.8,
          x,
          y
        );
      }
      if (node.right) {
        calculatePositions(
          node.right,
          x + spread,
          y + levelHeight,
          spread / 1.8,
          x,
          y
        );
      }
    };

    calculatePositions(root, canvasSize.width / 2, 60, initialSpread, null, null);
    setNodePositions(positions);
  }, [root, canvasSize.width]);

  const getPreOrder = (node: BSTNode | null, result: number[] = []): number[] => {
    if (!node) return result;
    result.push(node.value);
    getPreOrder(node.left, result);
    getPreOrder(node.right, result);
    return result;
  };

  const getInOrder = (node: BSTNode | null, result: number[] = []): number[] => {
    if (!node) return result;
    getInOrder(node.left, result);
    result.push(node.value);
    getInOrder(node.right, result);
    return result;
  };

  const getPostOrder = (node: BSTNode | null, result: number[] = []): number[] => {
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
            {mode === "visualize" ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl">
                <h2 className="text-lg font-bold text-white mb-4">Control de Nodos</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">Nuevo Nodo</label>
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
                <h2 className="text-lg font-bold text-white mb-4">Reconstrucción</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">Tipo de Datos</label>
                    <select 
                      value={reconstructType}
                      onChange={(e) => setReconstructType(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="pre-in">Pre-order + In-order</option>
                      <option value="post-in">Post-order + In-order</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-semibold">In-order</label>
                    <input
                      type="text"
                      value={inOrderInput}
                      onChange={(e) => setInOrderInput(e.target.value)}
                      placeholder="1, 2, 3..."
                      className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {reconstructType === "pre-in" ? (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">Pre-order</label>
                      <input
                        type="text"
                        value={preOrderInput}
                        onChange={(e) => setPreOrderInput(e.target.value)}
                        placeholder="1, 2, 3..."
                        className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg w-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase font-semibold">Post-order</label>
                      <input
                        type="text"
                        value={postOrderInput}
                        onChange={(e) => setPostOrderInput(e.target.value)}
                        placeholder="1, 2, 3..."
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
              <h2 className="text-lg font-bold text-white mb-4">Estadísticas</h2>
              <div className="space-y-4 text-slate-300 text-sm">
                <div className="flex justify-between">
                  <span>Total Nodos</span>
                  <span className="font-semibold text-white">{nodePositions.length}</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Pre-orden</span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getPreOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase font-bold">In-orden</span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getInOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-purple-400 uppercase font-bold">Post-orden</span>
                    <p className="text-white font-mono break-all bg-black/30 p-2 rounded-lg text-xs">
                      {getPostOrder(root).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed p-2">
              <b>Instrucciones:</b><br/>
              {mode === "visualize" ? (
                <>
                  • Ingresa un valor y presiona "+" para insertarlo en el BST.<br/>
                  • El árbol se balanceará visualmente para mantener la estructura.
                </>
              ) : (
                <>
                  • Ingresa dos tipos de recorridos y presiona "Generar" para reconstruir el árbol.<br/>
                  • Usa números separados por comas.
                </>
              )}
            </div>
          </aside>

          {/* CANVAS */}
          <div className="flex-1">
            <div
              ref={containerRef}
              className="relative rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
              style={{
                height: "600px",
                background: "radial-gradient(circle at center, #0f172a 0%, #020617 100%)",
              }}
            >
              {/* GRID */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              {/* SVG for connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                   <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                {nodePositions.map((pos, idx) => (
                  pos.parentX !== null && pos.parentY !== null && (
                    <line
                      key={`line-${idx}`}
                      x1={pos.parentX}
                      y1={pos.parentY}
                      x2={pos.x}
                      y2={pos.y}
                      stroke="url(#line-gradient)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{ filter: 'url(#glow)', opacity: 0.6 }}
                    />
                  )
                ))}
              </svg>

              {/* Nodes */}
              {nodePositions.map((pos, idx) => (
                <div
                  key={`node-${idx}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEditingNode(pos);
                    setEditValueInput(pos.value.toString());
                  }}
                  className="absolute animate-in zoom-in duration-500 flex items-center justify-center w-12 h-12 rounded-full text-white text-sm font-bold shadow-2xl transition-all hover:scale-110 cursor-pointer"
                  style={{
                    left: pos.x - 24,
                    top: pos.y - 24,
                    background: "linear-gradient(135deg, #10b981, #3b82f6)",
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                    zIndex: 10,
                    border: "2px solid rgba(255, 255, 255, 0.1)"
                  }}
                >
                  {pos.value}
                </div>
              ))}
              
              {/* EDITING PANEL */}
              {editingNode && (
                <div
                  className="absolute bg-slate-900/95 backdrop-blur-xl text-white p-6 rounded-3xl shadow-2xl z-50 w-60 border border-white/20 animate-in fade-in zoom-in duration-200"
                  style={{ 
                    left: Math.min(editingNode.x + 30, canvasSize.width - 270), 
                    top: Math.min(editingNode.y, canvasSize.height - 200) 
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold mb-4 text-slate-300">Editar Nodo</p>
                  <input
                    type="number"
                    value={editValueInput}
                    onChange={(e) => setEditValueInput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-white/10 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmEdit}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl transition font-bold text-xs"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => setEditingNode(null)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-xl transition font-bold text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                    <button
                      onClick={handleDeleteNode}
                      className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl transition font-bold text-xs"
                    >
                      Eliminar Nodo
                    </button>
                  </div>
                </div>
              )}
              
              {nodePositions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <TreePine size={64} className="opacity-20" />
                  <p className="italic text-lg">El lienzo está vacío. ¡Añade tu primer nodo!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Arboles;
