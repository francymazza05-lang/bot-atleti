import { Link, useLocation } from "wouter";
import { LayoutDashboard, Terminal, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/logs", icon: Terminal, label: "System Logs" },
    { href: "/settings", icon: Settings, label: "Configuration" },
  ];

  return (
    <div className="w-64 h-screen border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col fixed left-0 top-0 z-50">
      <div className="p-8 border-b border-white/5 flex items-center gap-3">
        <div className="p-2 rounded bg-primary/20 border border-primary/50 shadow-[0_0_15px_-3px_hsl(var(--primary))]">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none tracking-widest bg-gradient-to-r from-primary via-purple-400 to-white bg-clip-text text-transparent">
            NEXUS
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
            Bot Control v1.0
          </p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group cursor-pointer border border-transparent",
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_-5px_hsl(var(--primary))]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "animate-pulse")} />
                <span className="font-medium tracking-wide text-sm font-body">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="p-4 rounded-lg bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-bold text-secondary tracking-wider">SYSTEM ONLINE</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Connection stable. Monitoring active protocols.
          </p>
        </div>
      </div>
    </div>
  );
}
