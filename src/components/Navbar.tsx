import { Link, useLocation } from "react-router-dom";
import { BookOpen, GitFork, Home, Users, ChevronDown, BarChart2, TreePine, Compass } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/algoritmos", label: "Algoritmos", icon: BookOpen },
];

const algorithmItems = [
  { to: "/grafos", label: "Grafos", icon: GitFork },
  { to: "/asignacion", label: "Algoritmo de Asignación", icon: Users },
  { to: "/johnson", label: "Algoritmo de Johnson", icon: GitFork },
  { to: "/ordenamiento", label: "Ordenamiento", icon: BarChart2 },
  { to: "/arboles", label: "Árboles", icon: TreePine },
  { to: "/northwest", label: "Northwest", icon: Compass },
];

const Navbar = () => {
  const location = useLocation();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        background: "hsl(248 70% 14% / 0.88)",
        borderColor: "hsl(248 50% 30% / 0.35)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="academic-container flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg"
          style={{ color: "hsl(0 0% 100%)", fontFamily: "'Montserrat', sans-serif" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-hero)" }}
          >
            <GitFork className="h-4 w-4" style={{ color: "hsl(0 0% 100%)" }} />
          </div>
          <span
            style={{
              background: "linear-gradient(90deg, hsl(0 0% 100%), hsl(200 90% 80%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Análisis de Algoritmos
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: "var(--gradient-hero)",
                        color: "hsl(0 0% 100%)",
                        boxShadow: "var(--shadow-btn)",
                        fontFamily: "'Poppins', sans-serif",
                      }
                    : {
                        color: "hsl(240 30% 75%)",
                        fontFamily: "'Poppins', sans-serif",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "hsl(0 0% 100%)";
                    (e.currentTarget as HTMLElement).style.background =
                      "hsl(0 0% 100% / 0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "hsl(240 30% 75%)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}

          {/* Algorithms Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  color: "hsl(240 30% 75%)",
                  fontFamily: "'Poppins', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "hsl(0 0% 100%)";
                  (e.currentTarget as HTMLElement).style.background =
                    "hsl(0 0% 100% / 0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "hsl(240 30% 75%)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Algoritmos</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              style={{
                background: "hsl(248 70% 14% / 0.95)",
                borderColor: "hsl(248 50% 30% / 0.35)",
                backdropFilter: "blur(16px)",
              }}
              className="border shadow-xl"
            >
              {algorithmItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer"
                      style={{
                        color: isActive ? "hsl(0 0% 100%)" : "hsl(240 30% 75%)",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.color = "hsl(0 0% 100%)";
                          (e.currentTarget as HTMLElement).style.background =
                            "hsl(0 0% 100% / 0.08)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.color = "hsl(240 30% 75%)";
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
