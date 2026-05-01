import { NavLink, Outlet } from "react-router-dom";
import Logo from "./Logo";
import WalletButton from "./WalletButton";
import NebulaBackground from "./NebulaBackground";
import TxHistoryButton from "./TxHistoryButton";

import { ArrowLeftRight, Droplets, Layers, BarChart3, Briefcase, BookOpen, Home, Sprout } from "lucide-react";

const NAV = [
  { to: "/",          label: "Home",      icon: Home },
  { to: "/swap",       label: "Swap",      icon: ArrowLeftRight },
  { to: "/liquidity",  label: "Liquidity", icon: Droplets },
  { to: "/pools",      label: "Pools",     icon: Layers },
  { to: "/farming",    label: "Farming",   icon: Sprout },
  { to: "/analytics",  label: "Analytics", icon: BarChart3 },
  { to: "/portfolio",  label: "Portfolio", icon: Briefcase },
  { to: "/docs",       label: "Docs",      icon: BookOpen },
];

const Layout = () => (
  <div className="min-h-screen flex flex-col">
    <NebulaBackground />
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/40 border-b border-border/40">
      
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/"><Logo /></NavLink>
        <nav className="hidden md:flex items-center gap-1 glass rounded-full p-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive ? "btn-primary-grad text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <TxHistoryButton />
          <WalletButton />
        </div>
      </div>
      <nav className="md:hidden flex overflow-x-auto gap-1 px-3 pb-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                isActive ? "btn-primary-grad text-primary-foreground border-transparent" : "border-border text-muted-foreground"
              }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </NavLink>
        ))}
      </nav>
    </header>
    <main className="flex-1 container mx-auto px-4 py-8">
      <Outlet />
    </main>
    <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
      EAGLEDEX • Built on Integralayer Testnet • Chain ID 26218
    </footer>
  </div>
);

export default Layout;
