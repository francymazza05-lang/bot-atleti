import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background grid-bg p-4">
      <Card className="w-full max-w-md bg-card border border-destructive/50 shadow-[0_0_30px_-10px_hsl(var(--destructive))]">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive items-center justify-center">
            <AlertTriangle className="h-12 w-12 animate-pulse" />
            <h1 className="text-4xl font-bold font-display tracking-widest">404</h1>
          </div>
          
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold tracking-wider text-white">SYSTEM ERROR</h2>
            <p className="text-muted-foreground font-mono text-sm">
              The requested protocol could not be found. The resource may have been deleted or moved to a secure sector.
            </p>

            <div className="pt-4">
              <Link href="/" className="inline-flex items-center justify-center px-6 py-3 border border-primary/50 text-primary font-bold tracking-widest hover:bg-primary/20 hover:shadow-[0_0_15px_-5px_hsl(var(--primary))] transition-all rounded uppercase">
                Return to Base
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
