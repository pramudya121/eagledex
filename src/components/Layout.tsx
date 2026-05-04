import { NavLink, Outlet } from "react-router-dom";
import Logo from "./Logo";
import WalletButton from "./WalletButton";
import NebulaBackground from "./NebulaBackground";
import FloatingDock from "./ui-fx/FloatingDock";
import ThemeToggle from "./ui-fx/ThemeToggle";

import { ArrowLeftRight, Droplets, Layers, BarChart3, Briefcase, BookOpen, Home, Sprout, Droplet } from "lucide-react";

const NAV = [
  { to: "/",          label: "Home",      icon: Home,         end: true },
  { to: "/swap",       label: "Swap",      icon: ArrowLeftRight },
  { to: "/liquidity",  label: "Liquidity", icon: Droplets },
  { to: "/pools",      label: "Pools",     icon: Layers },
  { to: "/farming",    label: "Farming",   icon: Sprout },
  { to: "/analytics",  label: "Analytics", icon: BarChart3 },
  { to: "/portfolio",  label: "Portfolio", icon: Briefcase },
  { to: "/docs",       label: "Docs",      icon: BookOpen },
  { to: "/faucet",     label: "Faucet",    icon: Droplet },
];

const Layout = () => (
  <div className="min-h-screen flex flex-col">
    <NebulaBackground />
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/40 border-b border-border/40">
      <div className="container mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
        <NavLink to="/" className="shrink-0"><Logo /></NavLink>
        <nav className="hidden md:flex items-center gap-1 glass rounded-full p-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive ? "btn-primary-grad text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
    <main className="flex-1 container mx-auto px-4 py-8 pb-28 md:pb-8">
      <Outlet />
    </main>
    <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
      EAGLEDEX • Built on Integralayer Testnet • Chain ID 26218
    </footer>

    {/* Mobile floating dock */}
    <FloatingDock items={NAV} />
  </div>
);

export default Layout;
