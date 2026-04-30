import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Algoritmos from "./pages/Algoritmos";
import Grafos from "./pages/Grafos";
import Asignacion from "./pages/Asignacion";
import Johnson from "./pages/Johnson";
import Ordenamiento from "./pages/Ordenamiento";
import Arboles from "./pages/Arboles";
import Northwest from "./pages/Northwest";
import NotFound from "./pages/NotFound";
import Kruskal from "./pages/Kruskal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/algoritmos" element={<Algoritmos />} />
          <Route path="/grafos" element={<Grafos />} />
          <Route path="/asignacion" element={<Asignacion />} />
          <Route path="/johnson" element={<Johnson />} />
          <Route path="/ordenamiento" element={<Ordenamiento />} />
          <Route path="/arboles" element={<Arboles />} />
          <Route path="/northwest" element={<Northwest />} /> 
          <Route path="/kruskal" element={<Kruskal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
