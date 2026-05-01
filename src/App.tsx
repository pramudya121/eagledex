import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/lib/web3";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import Home from "./pages/Home";
import Swap from "./pages/Swap";
import Liquidity from "./pages/Liquidity";
import Pools from "./pages/Pools";
import Analytics from "./pages/Analytics";
import Portfolio from "./pages/Portfolio";
import Docs from "./pages/Docs";
import Farming from "./pages/Farming";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="bottom-right" />
      <ErrorBoundary>
        <Web3Provider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/liquidity" element={<Liquidity />} />
                <Route path="/pools" element={<Pools />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/farming" element={<Farming />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/docs" element={<Docs />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </Web3Provider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
