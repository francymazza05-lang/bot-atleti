import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: "primary" | "secondary" | "accent" | "default";
  delay?: number;
}

export function StatsCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendUp, 
  color = "default",
  delay = 0 
}: StatsCardProps) {
  
  const colors = {
    primary: "from-primary/20 to-primary/5 border-primary/30 text-primary",
    secondary: "from-secondary/20 to-secondary/5 border-secondary/30 text-secondary",
    accent: "from-accent/20 to-accent/5 border-accent/30 text-accent",
    default: "from-white/10 to-white/5 border-white/10 text-white"
  };

  const glowColors = {
    primary: "shadow-[0_0_20px_-10px_hsl(var(--primary))]",
    secondary: "shadow-[0_0_20px_-10px_hsl(var(--secondary))]",
    accent: "shadow-[0_0_20px_-10px_hsl(var(--accent))]",
    default: "shadow-[0_0_20px_-10px_rgba(255,255,255,0.1)]"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className={cn(
        "relative p-6 rounded-xl border bg-gradient-to-br overflow-hidden group hover:-translate-y-1 transition-transform duration-300",
        colors[color],
        glowColors[color]
      )}
    >
      {/* Background decorative elements */}
      <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform scale-150 -translate-y-2 translate-x-2">
        {icon}
      </div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5 text-current">
            {icon}
          </div>
          {trend && (
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded bg-black/20 border border-white/5",
              trendUp ? "text-green-400" : "text-red-400"
            )}>
              {trend}
            </span>
          )}
        </div>
        
        <h3 className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-1 font-display">
          {title}
        </h3>
        <div className="text-3xl font-bold tracking-tight font-display text-glow">
          {value}
        </div>
      </div>

      {/* Animated scanline */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-[200%] w-full animate-[scan_4s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 pointer-events-none" />
    </motion.div>
  );
}
