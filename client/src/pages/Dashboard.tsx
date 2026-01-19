import { useBotStatus } from "@/hooks/use-dashboard";
import { StatsCard } from "@/components/StatsCard";
import { Sidebar } from "@/components/Sidebar";
import { Activity, Server, Clock, Wifi, Cpu, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

function formatUptime(uptime: number | null): string {
  if (!uptime) return "00h 00m";
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function Dashboard() {
  const { data: status, isLoading, isError } = useBotStatus();

  // Mock data for visual completeness until backend is fully seeded
  const displayStatus = status || { 
    status: "connecting", 
    uptime: 0, 
    serverCount: 0, 
    ping: 0 
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-[0_0_30px_-5px_hsl(var(--primary))]" />
          <p className="text-primary font-display tracking-widest animate-pulse">INITIALIZING DASHBOARD...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-destructive font-bold font-display text-xl border border-destructive/30 p-8 rounded-lg bg-destructive/10 backdrop-blur-xl">
          <ShieldCheck className="w-12 h-12 mb-4 mx-auto" />
          CONNECTION FAILED. RETRYING...
        </div>
      </div>
    );
  }

  const isOnline = displayStatus.status === "online";

  return (
    <div className="min-h-screen bg-background grid-bg text-foreground pl-64">
      <Sidebar />
      
      <main className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-end pb-6 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold mb-2">SYSTEM OVERVIEW</h2>
            <p className="text-muted-foreground font-body">Real-time telemetry and system diagnostics</p>
          </div>
          <div className="flex items-center gap-3 bg-card/50 px-4 py-2 rounded-full border border-white/5">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-secondary animate-pulse shadow-[0_0_10px_hsl(var(--secondary))]' : 'bg-destructive'}`} />
            <span className="font-mono text-sm tracking-wider uppercase font-bold text-white/80">
              STATUS: {displayStatus.status}
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard 
            title="System Status" 
            value={displayStatus.status.toUpperCase()} 
            icon={<Activity className="w-6 h-6" />}
            color={isOnline ? "secondary" : "default"}
            delay={0}
          />
          <StatsCard 
            title="Active Servers" 
            value={displayStatus.serverCount} 
            icon={<Server className="w-6 h-6" />}
            color="primary"
            delay={1}
            trend="+2.4%"
            trendUp={true}
          />
          <StatsCard 
            title="Current Uptime" 
            value={formatUptime(displayStatus.uptime)} 
            icon={<Clock className="w-6 h-6" />}
            color="accent"
            delay={2}
          />
          <StatsCard 
            title="Network Latency" 
            value={`${Math.round(displayStatus.ping)}ms`} 
            icon={<Wifi className="w-6 h-6" />}
            color={displayStatus.ping < 100 ? "secondary" : "default"}
            delay={3}
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area (Mock) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="lg:col-span-2 bg-card/30 border border-white/10 rounded-xl p-6 backdrop-blur-md relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-lg tracking-wider flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                COMMAND THROUGHPUT
              </h3>
              <div className="flex gap-2">
                {['1H', '24H', '7D'].map((period) => (
                  <button 
                    key={period}
                    className="px-3 py-1 text-xs rounded bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors border border-transparent hover:border-primary/30"
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Visual Placeholder for Chart */}
            <div className="h-64 w-full bg-gradient-to-t from-primary/5 via-transparent to-transparent rounded-lg border border-white/5 flex items-end justify-between px-4 pb-0 relative group">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-[3%] bg-primary/40 rounded-t-sm hover:bg-primary/80 transition-all duration-300 relative group-hover:shadow-[0_0_15px_-5px_hsl(var(--primary))]"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
                />
              ))}
              <div className="absolute inset-x-0 bottom-0 h-[1px] bg-primary/50" />
            </div>
          </motion.div>

          {/* Quick Actions / Recent Events */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-card/30 border border-white/10 rounded-xl p-6 backdrop-blur-md"
          >
             <h3 className="font-display text-lg tracking-wider mb-6 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                SYSTEM HEALTH
              </h3>
              
              <div className="space-y-6">
                {[
                  { label: "Memory Usage", value: "32%", color: "bg-secondary" },
                  { label: "CPU Load", value: "14%", color: "bg-primary" },
                  { label: "Disk Space", value: "65%", color: "bg-accent" },
                ].map((stat, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                      <span>{stat.label}</span>
                      <span className="text-white">{stat.value}</span>
                    </div>
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full ${stat.color} shadow-[0_0_10px_-2px_currentColor]`} 
                        style={{ width: stat.value }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-gradient-to-br from-white/5 to-transparent rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Latest Broadcast</p>
                <p className="text-sm italic text-white/80">"Scheduled maintenance completed successfully. All systems operational."</p>
              </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
