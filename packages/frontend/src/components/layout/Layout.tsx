import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Wallet,
  BarChart3,
  Bell,
  Menu,
  X,
  Shield,
  ArrowRightLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
          isActive
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
            : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </NavLink>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-indigo-500" />
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Zscreener
          </span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/60 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full flex flex-col p-6">
            <div className="flex items-center gap-3 px-2 mb-10">
              <div className="relative">
                <Shield className="w-10 h-10 text-indigo-500" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Zscreener</h1>
                <p className="text-xs text-indigo-400 font-medium">Privacy Explorer</p>
              </div>
            </div>

            <nav className="space-y-2 flex-1">
              <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <SidebarItem to="/explorer" icon={Search} label="Explorer" />
              <SidebarItem to="/wallet" icon={Wallet} label="Shielded Wallet" />
              <SidebarItem to="/cross-chain" icon={ArrowRightLeft} label="Cross Chain" />
              <SidebarItem to="/analytics" icon={BarChart3} label="Analytics" />
            </nav>

            <div className="mt-auto pt-6 border-t border-slate-800/60">
              <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Shield className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Nillion Secured</p>
                    <p className="text-xs text-slate-400">Privacy Active</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-2">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60">
            <h2 className="text-xl font-semibold text-white">
              {location.pathname === '/' ? 'Network Overview' :
               location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(1).slice(1).replace('-', ' ')}
            </h2>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Mainnet Live</span>
              </div>
              <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border border-slate-900" />
              </button>
            </div>
          </header>

          <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
