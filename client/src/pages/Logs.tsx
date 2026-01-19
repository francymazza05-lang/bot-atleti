import { useLogs } from "@/hooks/use-dashboard";
import { Sidebar } from "@/components/Sidebar";
import { format } from "date-fns";
import { Terminal, Search, Filter, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function Logs() {
  const { data: logs, isLoading, refetch } = useLogs();

  return (
    <div className="min-h-screen bg-background grid-bg text-foreground pl-64">
      <Sidebar />
      
      <main className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-end pb-6 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold mb-2">SYSTEM LOGS</h2>
            <p className="text-muted-foreground font-body">Audit trail of bot activities and errors</p>
          </div>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>REFRESH</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm"
            />
          </div>
          <button className="px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/5 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-card/30 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5 font-display text-xs tracking-wider font-bold text-muted-foreground">
            <div className="col-span-2">TIMESTAMP</div>
            <div className="col-span-2">ACTION</div>
            <div className="col-span-2">USER</div>
            <div className="col-span-6">DETAILS</div>
          </div>
          
          <div className="divide-y divide-white/5 font-mono text-sm max-h-[600px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">
                Decrypting log stream...
              </div>
            ) : logs && logs.length > 0 ? (
              logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={log.id} 
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors items-center group"
                >
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {log.createdAt ? format(new Date(log.createdAt), "MMM dd, HH:mm:ss") : "-"}
                  </div>
                  <div className="col-span-2">
                    <span className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary/20 transition-colors">
                      {log.action}
                    </span>
                  </div>
                  <div className="col-span-2 text-white/80 truncate font-bold">
                    {log.username || "System"}
                  </div>
                  <div className="col-span-6 text-muted-foreground truncate group-hover:text-white transition-colors">
                    {log.details}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                <Terminal className="w-12 h-12 opacity-20" />
                No logs recorded yet. System waiting for input.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
