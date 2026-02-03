import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Search, Database, Zap } from "lucide-react";

interface DeltaCheckLoadingProps {
  className?: string;
}

export function DeltaCheckLoading({ className }: DeltaCheckLoadingProps) {
  return (
    <Card className={`border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 ${className}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Search className="h-8 w-8 text-blue-600" />
            <RefreshCw className="h-4 w-4 text-blue-400 animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Checking for changes...</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Comparing Navio API data against your local snapshot
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <Database className="h-3 w-3" />
                <span>Fetching delivery areas from Navio...</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-600/70 dark:text-blue-400/70">
                <Zap className="h-3 w-3" />
                <span>Computing differences...</span>
              </div>
            </div>
            
            <div className="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
