import Layout from "@/components/Layout";
import { Play, FileText, Lightbulb, Network, GitMerge, Search, BarChart2 } from "lucide-react";

const algorithms = [
  {
    title: "Algoritmo de Dijkstra",
    description:
      "Encuentra el camino más corto desde un nodo origen a todos los demás nodos en un grafo con pesos no negativos.",
    icon: Network,
    color: "hsl(248 70% 58%)",
    colorBg: "hsl(248 70% 58% / 0.1)",
  },
  {
    title: "Algoritmo de Kruskal",
    description:
      "Construye un árbol de expansión mínima seleccionando aristas de menor peso sin formar ciclos.",
    icon: GitMerge,
    color: "hsl(200 80% 45%)",
    colorBg: "hsl(200 80% 45% / 0.1)",
  },
  {
    title: "Recorrido BFS",
    description:
      "Búsqueda en anchura que explora todos los nodos vecinos antes de pasar al siguiente nivel.",
    icon: Search,
    color: "hsl(270 60% 55%)",
    colorBg: "hsl(270 60% 55% / 0.1)",
  },
  {
    title: "Recorrido DFS",
    description:
      "Búsqueda en profundidad que explora lo más lejos posible por cada rama antes de retroceder.",
    icon: Lightbulb,
    color: "hsl(220 80% 52%)",
    colorBg: "hsl(220 80% 52% / 0.1)",
  },
  {
    title: "Algoritmos de Ordenamiento",
    description:
      "Diferentes métodos para organizar elementos en un orden específico, como Burbuja, Selección, Inserción, entre otros.",
    icon: BarChart2,
    color: "hsl(150 70% 50%)",
    colorBg: "hsl(150 70% 50% / 0.1)",
  },
];

const Algoritmos = () => {
  return (
    <Layout>
      {/* Hero header */}
      <section
        className="relative pt-24 pb-16 overflow-hidden"
        style={{
          background:
            "linear-gradient(150deg, hsl(248 70% 18%) 0%, hsl(220 80% 22%) 60%, hsl(200 80% 20%) 100%)",
        }}
      >
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "hsl(248 70% 65%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "hsl(200 80% 55%)" }}
        />

        <div className="academic-container max-w-4xl mx-auto text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{
              background: "hsl(0 0% 100% / 0.12)",
              color: "hsl(200 80% 80%)",
              border: "1px solid hsl(0 0% 100% / 0.18)",
            }}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Fundamentos Teóricos
          </div>

          <h1
            className="text-4xl md:text-5xl font-extrabold mb-4"
            style={{ color: "hsl(0 0% 100%)", fontFamily: "'Montserrat', sans-serif" }}
          >
            Algoritmos{" "}
            <span
              style={{
                background: "linear-gradient(90deg, hsl(200 90% 70%), hsl(248 80% 85%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Matemáticos
            </span>
          </h1>

          <p style={{ color: "hsl(240 30% 80%)" }} className="text-lg max-w-2xl mx-auto">
            Fundamentos teóricos y visualizaciones de los principales algoritmos sobre grafos.
          </p>
        </div>
      </section>

      {/* Conceptos */}
      <section className="academic-section py-8">
        <div className="academic-container max-w-4xl mx-auto">
          <div className="academic-card">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "var(--gradient-hero)" }}
              >
                <FileText className="h-4 w-4 text-primary-foreground" style={{ color: "hsl(0 0% 100%)" }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Conceptos Fundamentales</h2>
            </div>
            <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">
              <p>
                Los algoritmos sobre grafos permiten resolver problemas como encontrar caminos óptimos,
                detectar ciclos, calcular árboles de expansión mínima y analizar la conectividad de una red.
              </p>
              <p>
                A continuación se presentan algunos de los algoritmos más relevantes junto con recursos audiovisuales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="academic-section py-2 pb-8">
        <div className="academic-container max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {algorithms.map((algo) => (
              <div key={algo.title} className="academic-card">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: algo.colorBg, border: `1.5px solid ${algo.color}30` }}
                  >
                    <algo.icon className="h-5 w-5" style={{ color: algo.color }} />
                  </div>
                  <h3 className="font-bold text-foreground text-base">{algo.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{algo.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEOS */}
      <section className="academic-section py-2 pb-12">
        <div className="academic-container max-w-4xl mx-auto">
          <div className="academic-card">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Play className="h-4 w-4" style={{ color: "hsl(0 0% 100%)" }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Material Audiovisual</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="aspect-video rounded-xl overflow-hidden shadow-md">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/qluHZ1sV0I0"
                  title="Algoritmo de Dijkstra explicación"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="aspect-video rounded-xl overflow-hidden shadow-md">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/CN-UiM3of0E"
                  title="Algoritmo de Kruskal explicación"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground">
          Proyecto académico — Análisis de Algoritmos © 2026
        </p>
      </footer>
    </Layout>
  );
};

export default Algoritmos;
