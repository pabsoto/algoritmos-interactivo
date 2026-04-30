import Navbar from '@/components/Navbar';
import React, { useState, useRef, ChangeEvent } from 'react';

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
  state?: 'default' | 'evaluating' | 'included' | 'rejected';
}

type ToolMode = 'addNode' | 'addEdge' | 'edit' | 'delete';
type OptimizationMode = 'min' | 'max';

export default function KruskalSection() {
  // --- ESTADOS ---
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [mode, setMode] = useState<ToolMode>('addNode');
  const [optMode, setOptMode] = useState<OptimizationMode>('min');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const hasMoved = useRef(false);

  const [editingElement, setEditingElement] = useState(null); 
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [tempElement, setTempElement] = useState<NodeData | EdgeData | null>(null);
  // --- LÓGICA DE INTERACCIÓN ---

const handleSvgClick = (e: React.MouseEvent) => {
  console.log("Clic en SVG detectado, modo actual:", mode); 


  if (mode !== 'addNode' || isAnimating || !svgRef.current) return;


  const rect = svgRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 3. Crear el nuevo nodo
  const newNode: NodeData = {
    id: `node-${Date.now()}`,
    x: x,
    y: y,
    label: String.fromCharCode(65 + (nodes.length % 26)),
    color: '#3b82f6'
  };


  setTempElement(newNode);
  setEditingElement(newNode); 
  setIsPanelOpen(true);     
};

const handleNodeClick = (e: React.MouseEvent, node: NodeData) => {
  e.stopPropagation();
  
  if (isAnimating || hasMoved.current) {
    hasMoved.current = false;
    return;
  }

  if (mode === 'delete') {
    setNodes(nodes.filter(n => n.id !== node.id));
    setEdges(edges.filter(edge => edge.source !== node.id && edge.target !== node.id));
  } 
  else if (mode === 'edit') {
  
    setEditingElement(node);
    setIsPanelOpen(true);
  } 
  else if (mode === 'addEdge') {
    if (!selectedNodeId) {
      setSelectedNodeId(node.id);
    } else if (selectedNodeId !== node.id) {
      const exists = edges.some(edge => 
        (edge.source === selectedNodeId && edge.target === node.id) ||
        (edge.source === node.id && edge.target === selectedNodeId)
      );
      
      if (!exists) {
        const newEdge: EdgeData = {
          id: `edge-${Date.now()}`,
          source: selectedNodeId,
          target: node.id,
          weight: 0,
          state: 'default'
        };
      
        
        setTempElement(newEdge);
        setEditingElement(newEdge);
        setIsPanelOpen(true);
      }
      setSelectedNodeId(null);
    }
  }
};
  const handleEdgeClick = (e: React.MouseEvent, edge: EdgeData) => {
    e.stopPropagation();
    if (isAnimating) return;

    if (mode === 'delete') {
      setEdges(edges.filter(e => e.id !== edge.id));
    } else if (mode === 'edit') {
      const newWeightStr = prompt('Ingrese el nuevo peso:', edge.weight.toString());
      const newWeight = parseFloat(newWeightStr || '');
      if (!isNaN(newWeight)) {
        setEdges(edges.map(e => e.id === edge.id ? { ...e, weight: newWeight } : e));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();
    if (isAnimating) return;

    if (mode === 'edit' || mode === 'addNode' || mode === 'addEdge') {
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

        draggingNodeRef.current.setAttribute('transform', `translate(${x}, ${y})`);
        

    };

    const handleMouseUp = () => {
    if (draggingNodeId && draggingNodeRef.current) {
        
        const transform = draggingNodeRef.current.getAttribute('transform');
        const coords = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
        
        if (coords) {
        const newX = parseFloat(coords[1]);
        const newY = parseFloat(coords[2]);

        setNodes(prev => prev.map(n => 
            n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n
        ));
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
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
 
    const finalName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
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
          setEdges(json.edges.map((edge: any) => ({ ...edge, state: 'default' })));
        }
      } catch (err) {
        alert("Error al leer el archivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // --- ALGORITMO DE KRUSKAL ---
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

 const runKruskal = async () => {
  if (nodes.length === 0 || edges.length === 0) return;
  setIsAnimating(true);
  setSelectedNodeId(null);

  // 1. Inicializamos una copia local para manipular la visualización sin depender 
  // directamente del estado de React en cada micro-paso (evita cierres obsoletos)
  let localEdges: EdgeData[] = edges.map(e => ({ ...e, state: 'default' }));
  setEdges(localEdges);
  await sleep(500);

  // 2. Ordenar las aristas según el modo (Min o Max)
  const sortedEdges = [...localEdges].sort((a, b) => {
    const weightA = Number(a.weight);
    const weightB = Number(b.weight);
    return optMode === 'min' ? weightA - weightB : weightB - weightA;
  });

  // 3. Estructuras Union-Find
  const parent: Record<string, string> = {};
  nodes.forEach(n => parent[n.id] = n.id);

  const find = (i: string): string => {
    if (parent[i] === i) return i;
    return parent[i] = find(parent[i]); // Compresión de ruta
  };

  const union = (i: string, j: string) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  // 4. Bucle principal con actualización de estado segura
  let edgesIncluded = 0;

  for (const edge of sortedEdges) {
    // Si ya conectamos todos los nodos, rechazamos lo que sobra
    if (edgesIncluded >= nodes.length - 1) {
      localEdges = localEdges.map(e => e.id === edge.id ? { ...e, state: 'rejected' } : e);
      setEdges([...localEdges]);
      continue;
    }

    // Paso: Evaluando
    localEdges = localEdges.map(e => e.id === edge.id ? { ...e, state: 'evaluating' } : e);
    setEdges([...localEdges]);
    await sleep(600);

    const rootSource = find(edge.source);
    const rootTarget = find(edge.target);

    if (rootSource !== rootTarget) {
      union(rootSource, rootTarget);
      // Paso: Incluida
      localEdges = localEdges.map(e => e.id === edge.id ? { ...e, state: 'included' } : e);
      edgesIncluded++;
    } else {
      // Paso: Rechazada (forma ciclo)
      localEdges = localEdges.map(e => e.id === edge.id ? { ...e, state: 'rejected' } : e);
    }

    setEdges([...localEdges]);
    await sleep(400);
  }

  setIsAnimating(false);
};
  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
  };

  // --- HELPERS VISUALES ---
  const getNodeById = (id: string) => nodes.find(n => n.id === id);
  
  const getEdgeStyle = (state: EdgeData['state']) => {
    switch (state) {
      case 'evaluating': return { stroke: '#eab308', strokeWidth: 4, opacity: 1 }; // Yellow
      case 'included': return { stroke: '#22c55e', strokeWidth: 5, opacity: 1 }; // Green
      case 'rejected': return { stroke: '#ef4444', strokeWidth: 2, opacity: 0.2, strokeDasharray: '4' }; // Red dashed
      default: return { stroke: '#9ca3af', strokeWidth: 2, opacity: 1 }; // Gray
    }
  };
// --- Matriz de Adyacencia ---
const generateMatrix = () => {
  const size = nodes.length;
  
  interface MatrixCell {
    weight: number | string;
    isMst: boolean;
  }

  const matrix: MatrixCell[][] = Array(size).fill(null).map(() => 
    Array(size).fill(null).map(() => ({ weight: '∞', isMst: false }))
  );

  const nodeToIndex = new Map(nodes.map((n, i) => [n.id, i]));

  edges.forEach(edge => {
    const i = nodeToIndex.get(edge.source);
    const j = nodeToIndex.get(edge.target);
    
    if (i !== undefined && j !== undefined) {
    
      const isMst = edge.state === 'included';
      
      const weightValue = edge.weight ?? 0;

      matrix[i][j] = { weight: weightValue, isMst: isMst };
      matrix[j][i] = { weight: weightValue, isMst: isMst };
    }
  });

  for(let i = 0; i < size; i++) {
    matrix[i][i] = { weight: 0, isMst: false };
  }

  return matrix;
};

return (
  <div className="kruskal-wrapper">
    <style>{`
      /* --- PALETA DE COLORES PREMIUM (IMAGEN) --- */
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

      /* --- HEADER --- */
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

      /* --- LAYOUT --- */
      .kruskal-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 2rem;
        margin-left: 8%;
        margin-right: 4%;
      }

      /* --- PANELES LATERALES --- */
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

      /* --- BOTÓN RESOLVER (NEÓN VERDE) --- */
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

      /* --- CANVAS CON CUADRÍCULA --- */
      .canvas-viewport {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        position: relative;
        overflow: hidden;
        height: 650px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      }

      /* --- EFECTOS SVG --- */
      .node-neon { transition: all 0.3s; cursor: pointer; }
      .node-neon:hover { filter: url(#glow-cyan); }
      .edge-tube { transition: all 0.5s ease; stroke-linecap: round; }
    `}</style>

    <Navbar /> 

    <header className="kruskal-header">
    <div className="flex items-center gap-3">
        <div className="bg-emerald-500 p-2 rounded-lg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Algoritmo de Kruskal</h1>
    </div>
    
    <div className="nav-actions">

        <label className="btn-nav cursor-pointer flex items-center gap-2">
         ↓ Importar
        <input 
            type="file" 
            accept=".json" 
            onChange={handleImport} 
            className="hidden" 
        />
        </label>
        
        <button onClick={handleExport} className="btn-nav">Exportar</button>
        <button onClick={clearGraph} className="btn-nav text-red-400">↺ Limpiar</button>
    </div>
    </header>
    <header className="kruskal-header">
    <div className="flex items-center gap-3">
        <div className="bg-emerald-500 p-2 rounded-lg">
   
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Algoritmo de Kruskal</h1>
    </div>
    
    <div className="nav-actions">
        
        <label className="btn-nav cursor-pointer flex items-center gap-2">
         ↓ Importar
        <input 
            type="file" 
            accept=".json" 
            onChange={handleImport} 
            className="hidden" 
        />
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
            {['addNode', 'addEdge', 'edit', 'delete'].map((t) => (
              <button
                key={t}
                onClick={() => setMode(t as ToolMode)}
                className={`p-2 rounded-lg text-xs font-bold border transition-all ${
                  mode === t 
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' 
                  : 'bg-slate-800 border-transparent text-slate-400 hover:text-white'
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
                onClick={() => setOptMode('min')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                optMode === 'min' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                MÍNIMO (MST)
            </button>
            <button 
                onClick={() => setOptMode('max')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                optMode === 'max' 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                MÁXIMO (MaxST)
            </button>
            </div>

            {/* Botón de ejecución dinámico */}
            <button 
            onClick={runKruskal} 
            disabled={isAnimating} 
            className={`btn-solve-neon !transition-colors ${
                optMode === 'max' ? 'from-orange-500 to-red-600 shadow-orange-500/20' : 'from-emerald-500 to-teal-600'
            }`}
            >
            <span className="text-lg">{isAnimating ? '●' : '▷'}</span> 
            {isAnimating ? 'Procesando...' : `Resolver ${optMode === 'min' ? 'Mínimo' : 'Máximo'}`}
            </button>

            <button 
            onClick={() => setIsMatrixOpen(true)}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-[10px] font-bold transition-all mt-2 flex items-center justify-center gap-2"
            >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            VER MATRIZ
            </button>
        </div>
        </div>
        <div className="px-4 text-[11px] text-slate-500 leading-relaxed italic">
          Tip: Usa 'addEdge' para conectar nodos. El algoritmo visualizará el proceso paso a paso con efectos neón.
        </div>
      </aside>

      <main className="canvas-viewport">
        <svg 
            ref={svgRef} 
          
            onClick={handleSvgClick}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseMove={handleMouseMove} // Detecta el movimiento aquí
            onMouseUp={handleMouseUp}     // Suelta el nodo aquí
            onMouseLeave={handleMouseUp}
        >
          <defs>
            {/* PATRÓN DE CUADRÍCULA TÉCNICA */}
            <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05"/>
            </pattern>
            
            {/* EFECTOS DE RESPLANDOR */}
            <filter id="glow-cyan">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-green-line">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Degradado para el fondo del nodo */}
            {nodes.map(node => (
                <linearGradient key={`grad-${node.id}`} id={`grad-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={node.color || '#3b82f6'} />
               
                <stop offset="100%" stopColor="#a855f7" /> 
                </linearGradient>
            ))}

            {/* Filtro de brillo para el borde */}
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>


          {/* FONDO DE REJILLA */}
          <rect width="100%" height="100%" fill="url(#tech-grid)" />

          {/* CAPA: ARISTAS */}
          {edges.map(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            let color = "#ffffff"; 
            let width = 2;
            let filter = "";

            if (edge.state === 'evaluating') { color = "var(--accent-yellow)"; width = 4; }
            if (edge.state === 'included') { color = "var(--accent-green)"; width = 6; filter = "url(#glow-green-line)"; }
            if (edge.state === 'rejected') { color = "var(--accent-red)"; width = 2; }

            return (
              <g key={edge.id}>
                <line 
                  x1={source.x} y1={source.y} x2={target.x} y2={target.y} 
                  stroke={color} strokeWidth={width} filter={filter}
                  className="edge-tube" opacity={edge.state === 'default' ? 0.3 : 1}
                />
                {/* BURBUJA DE PESO */}
               
                <g 
                transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`}
                onClick={(e) => {
                e.stopPropagation();
                setEditingElement(edge); 
                setIsPanelOpen(true);    
                }}
                className="cursor-pointer">
                    {/* Fondo de la burbuja: Asegúrate de que esté aquí para que sea visible */}
                <rect 
                x="-14" y="-10" 
                width="28" height="20" 
                rx="6" 
                fill="var(--bg-main)" 
                stroke={color} 
                strokeWidth="1.5" 
                />
                {/* Texto del peso */}
                <text 
                dy="5" 
                textAnchor="middle" 
                fill="white" 
                fontSize="10" 
                fontWeight="bold"
                style={{ userSelect: 'none' }}
                >
                    {edge.weight}
                </text>
                </g>
              </g>
            );
          })}

          {/* CAPA: NODOS NEÓN */}
          {nodes.map(node => (
        <g 
        key={node.id} 
        transform={`translate(${node.x}, ${node.y})`}
        ref={draggingNodeId === node.id ? draggingNodeRef : null} 
        onClick={(e) => handleNodeClick(e, node)} 
        onMouseDown={(e) => handleMouseDown(e, node)}
        
        className="cursor-grab active:cursor-grabbing" 
        style={{ 
            
            transition: draggingNodeId === node.id ? 'none' : 'transform 0.1s ease-out',
            pointerEvents: 'all' 
        }}
        >
            {/* Anillo de brillo Neón exterior */}
            <circle 
            r="30" 
            fill="none" 
            stroke={`url(#grad-${node.id})`} // Referencia al ID dinámico
            strokeWidth="2" 
            opacity={selectedNodeId === node.id || draggingNodeId === node.id ? "1" : "0.4"}
            filter="url(#neonGlow)"
            />

            {/* Cuerpo principal del nodo */}
            <circle 
            r="22" 
            fill="#111827" 
            stroke={selectedNodeId === node.id || draggingNodeId === node.id ? "white" : `url(#grad-${node.id})`} 
            strokeWidth={selectedNodeId === node.id || draggingNodeId === node.id ? "3" : "2"} 
            />

            {/* Efecto de reflejo interno */}
            <circle 
            r="15" 
            cy="-2"
            fill="url(#nodeGradient)" 
            opacity="0.15"
            className="pointer-events-none"
            />


            {/* Texto del nodo */}
            <text 
            textAnchor="middle" 
            dy="5" 
            fill="white" 
            fontSize="12" 
            fontWeight="900"
            className="pointer-events-none select-none" 
            style={{ 
                textShadow: '0px 0px 4px rgba(0,0,0,0.8)',
                userSelect: 'none'
            }}
            >
            {node.label}
            </text>
        </g>
        ))}
        </svg>
     
        {isPanelOpen && editingElement && (
        <div className="absolute right-4 top-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-2xl z-[100] animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">
                {editingElement.source 
                ? (tempElement ? 'Nueva Arista' : 'Editar Arista') 
                : (tempElement ? 'Nuevo Nodo' : 'Editar Nodo')
                }
            </h3>
            <button 
                onClick={() => { setIsPanelOpen(false); setEditingElement(null); setTempElement(null); }} 
                className="text-slate-500 hover:text-white transition-colors"
            >
                ✕
            </button>
            </div>

            <div className="space-y-4">
            {editingElement.source ? (
                /* --- CONTROLES PARA ARISTA --- */
                <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Peso</label>
                <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-all"
                    value={editingElement.weight}
                    autoFocus
                    onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const newWeight = isNaN(val) ? 1 : Math.max(1, val);
                    
                    // 1. Actualiza el panel
                    setEditingElement({ ...editingElement, weight: newWeight });
                    
                    // 2. ¡CRÍTICO! Actualiza el peso en el estado global
                    setEdges(prevEdges => prevEdges.map(edge => 
                        edge.id === editingElement.id ? { ...edge, weight: newWeight } : edge
                    ));
                    }}
                />
                <p className="text-[9px] text-slate-600 mt-1 italic">* El peso debe ser un número entero positivo.</p>
                </div>
            ) : (
                /* --- CONTROLES PARA NODO --- */
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Etiqueta</label>
                        <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-all"
                        value={editingElement.label || ''}
                        autoFocus
                        onChange={(e) => {
                            const newLabel = e.target.value;
                            // Actualiza el panel
                            setEditingElement({ ...editingElement, label: newLabel });
                            // Actualiza el nodo en el estado global
                            setNodes(prevNodes => prevNodes.map(node => 
                            node.id === editingElement.id ? { ...node, label: newLabel } : node
                            ));
                        }}
                        />
                    </div>

      
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Color Neón</label>
                        <div className="flex gap-3 items-center bg-slate-900 border border-slate-700 rounded-lg p-2 transition-all focus-within:border-cyan-500">
                   <input 
                        type="color" 
                        className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-md overflow-hidden"
                        value={editingElement.color || '#3b82f6'}
                        onChange={(e) => {
                        const newColor = e.target.value;
                        // Actualiza el panel
                        setEditingElement({ ...editingElement, color: newColor });
                        // Actualiza el color en el estado global
                        setNodes(prevNodes => prevNodes.map(node => 
                            node.id === editingElement.id ? { ...node, color: newColor } : node
                        ));
                        }}
                    />
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                        {editingElement.color || '#3b82f6'}
                    </span>
                </div>
            </div>
        </div>
            )}

            <div className="flex flex-col gap-2 mt-4">
                {/* BOTÓN PRINCIPAL: CREAR O GUARDAR */}
                <button 
                onClick={() => {
                    if (editingElement.source) {
                        const weightVal = parseInt(editingElement.weight);
                        if (isNaN(weightVal) || weightVal <= 0) {
                            alert("¡Atención! El peso debe ser un número mayor a 0.");
                            return; // Detiene la ejecución para que no se guarde el peso incorrecto
                        }
                    }

                    if (tempElement) {
                    // Si es nuevo, lo añadimos a la lista oficial
                    if (editingElement.source) {
                        setEdges(prev => [...prev, editingElement as EdgeData]);
                    } else {
                        setNodes(prev => [...prev, editingElement as NodeData]);
                    }
                    } else {
                    // Si ya existía, actualizamos la lista oficial
                    if (editingElement.source) {
                        setEdges(prev => prev.map(e => e.id === editingElement.id ? editingElement as EdgeData : e));
                    } else {
                        setNodes(prev => prev.map(n => n.id === editingElement.id ? editingElement as NodeData : n));
                    }
                    }
                    setIsPanelOpen(false);
                    setEditingElement(null);
                    setTempElement(null);
                }}
                className="w-full bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/50 text-cyan-400 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                {tempElement ? 'CREAR ELEMENTO' : 'GUARDAR CAMBIOS'}
                </button>

                <div className="flex gap-2">
               
                {!tempElement && (
                    <button 
                    onClick={() => {
                        if (editingElement.source) {
                        setEdges(prev => prev.filter(e => e.id !== editingElement.id));
                        } else {
                        setNodes(prev => prev.filter(n => n.id !== editingElement.id));
                        setEdges(prev => prev.filter(e => e.source !== editingElement.id && e.target !== editingElement.id));
                        }
                        setIsPanelOpen(false);
                        setEditingElement(null);
                    }}
                    className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                    >
                    ELIMINAR
                    </button>
                )}

           
                <button 
                    onClick={() => {
                    setIsPanelOpen(false);
                    setEditingElement(null);
                    setTempElement(null);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                    CANCELAR
                </button>
                </div>
            </div>
            </div>
        </div>
        )}
       
        {mode === 'addEdge' && selectedNodeId && (
          <div className="absolute bottom-6 right-8 bg-cyan-500 text-white px-4 py-2 rounded-full text-xs font-black tracking-widest animate-pulse shadow-2xl">
            SISTEMA DE CONEXIÓN ACTIVO
          </div>
        )}
      </main>
    </div>
    {isMatrixOpen && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-2xl rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
      
      {/* Cabecera */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <h3 className="text-cyan-400 text-xs font-black tracking-[0.2em] uppercase">Matriz de Transición</h3>
        </div>
        <button 
          onClick={() => setIsMatrixOpen(false)}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Contenido de la Matriz */}
      <div className="p-6 overflow-auto max-h-[70vh]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-slate-800 bg-slate-800/30 text-[10px] text-slate-500 italic">Nodos</th>
              {nodes.map(n => (
                <th key={n.id} className="p-2 border border-slate-800 bg-slate-800/30 text-cyan-500 font-mono text-xs">{n.label}</th>
              ))}
            </tr>
          </thead>
   
            <tbody className="divide-y divide-slate-800">
            {generateMatrix().map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-3 border border-slate-800 bg-slate-900 text-cyan-500 font-mono text-xs text-center font-black">
                    {nodes[i].label}
                </td>
                {row.map((cell, j) => (
                    <td 
                    key={j} 
                    className={`p-3 border border-slate-800 text-center font-mono text-sm transition-all duration-300 ${
                        cell.isMst 
                        ? 'bg-cyan-400/20 text-cyan-300 shadow-[inset_0_0_15px_rgba(34,211,238,0.4)] border-cyan-500/50' 
                        : 'text-slate-400'
                    }`}
                    >
                    <span className={cell.isMst ? "drop-shadow-[0_0_5px_#22d3ee] font-bold" : ""}>
                        {cell.weight}
                    </span>
                    </td>
                ))}
                </tr>
            ))}
            </tbody>
        </table>
      </div>

      {/* Pie de ventana */}
      <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-right">
        <button 
          onClick={() => setIsMatrixOpen(false)}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-all"
        >
          CERRAR TERMINAL
        </button>
      </div>
    </div>
  </div>
)}
  </div>
  
);

}