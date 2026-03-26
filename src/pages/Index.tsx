import Layout from "@/components/Layout";
import { User, BookOpen, Calendar } from "lucide-react";
import ucatolicaLogo from "@/assets/logocato.jpg";

const infoFields = [
  { icon: User, label: "Equipo", value: ["Pablo Soto Flores", "Adriana Pando", "Mayte Torrico", "Alejandro Bobarin", "Emilia Crespo", "Paulo Escaray"] },
  { icon: BookOpen, label: "Curso", value: "Análisis de Algoritmos" },
  { icon: Calendar, label: "Semestre", value: "1-2026" },
];

const Index = () => {
  return (
    <Layout>
      {/* Hero with gradient overlay */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          background: "var(--gradient-hero-overlay)",
        }}
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, hsl(248 70% 18%) 0%, hsl(220 80% 22%) 50%, hsl(200 80% 18%) 100%)",
          }}
        />

        {/* Decorative circles */}
        <div
          className="absolute top-1/4 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "hsl(248 70% 65%)" }}
        />
        <div
          className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "hsl(200 80% 55%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 py-24">
          {/* Logo */}
          <div
            className="mb-8 rounded-2xl overflow-hidden border-4 shadow-2xl"
            style={{
              borderColor: "hsl(0 0% 100% / 0.2)",
              boxShadow: "0 24px 60px hsl(248 70% 20% / 0.5)",
            }}
          >
            <img
              src={ucatolicaLogo}
              alt="Universidad Católica"
              className="w-40 h-40 object-contain bg-white"
            />
          </div>

          {/* Title */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 tracking-tight leading-none"
            style={{
              color: "hsl(0 0% 100%)",
              fontFamily: "'Montserrat', sans-serif",
              textShadow: "0 4px 24px hsl(248 70% 20% / 0.5)",
            }}
          >
            Análisis de{" "}
            <span
              style={{
                background: "linear-gradient(90deg, hsl(200 90% 70%), hsl(248 80% 85%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Algoritmos
            </span>
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl leading-relaxed mb-12"
            style={{ color: "hsl(240 30% 88%)" }}
          >
            Exploración interactiva de estructuras matemáticas discretas,
            algoritmos y representaciones visuales de grafos.
          </p>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
            {infoFields.map((field) => (
              <div
                key={field.label}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 ${
                  field.label === 'Equipo' ? 'col-span-1 sm:col-span-2' : ''
                }`}
                style={{
                  background: "hsl(0 0% 100% / 0.08)",
                  borderColor: "hsl(0 0% 100% / 0.14)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  <field.icon className="h-5 w-5" style={{ color: "hsl(0 0% 100%)" }} />
                </div>
                <div className="text-left flex-1">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "hsl(200 80% 75%)", fontFamily: "'Poppins', sans-serif" }}
                  >
                    {field.label}
                  </p>
                  <div className="mt-1.5">
                    {field.label === 'Equipo' && Array.isArray(field.value) ? (
                      <div className="flex flex-wrap gap-2">
                        {field.value.map((name, index) => (
                          <span
                            key={index}
                            className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm border border-white/20"
                            style={{ color: "hsl(0 0% 100%)" }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="font-semibold"
                        style={{ color: "hsl(0 0% 100%)" }}
                      >
                        {field.value}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground">
          Proyecto académico — Análisis de Algoritmos © 2026
        </p>
      </footer>
    </Layout>
  );
};

export default Index;
