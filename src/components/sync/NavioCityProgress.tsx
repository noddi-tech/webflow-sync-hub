import { Check, Loader2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface CityProgressData {
  phase: "idle" | "initializing" | "processing" | "finalizing" | "complete" | "error";
  currentCity: string | null;
  citiesTotal: number;
  citiesProcessed: number;
  cities: Array<{ name: string; countryCode: string }>;
  errorMessage?: string;
}

interface NavioCityProgressProps {
  progress: CityProgressData;
}

export function NavioCityProgress({ progress }: NavioCityProgressProps) {
  const percent = progress.citiesTotal > 0 
    ? Math.round((progress.citiesProcessed / progress.citiesTotal) * 100)
    : 0;

  const getPhaseLabel = () => {
    switch (progress.phase) {
      case "initializing":
        return "Fetching Navio data...";
      case "processing":
        return progress.currentCity 
          ? `Processing ${progress.currentCity}...`
          : "Processing cities...";
      case "finalizing":
        return "Saving results...";
      case "complete":
        return "Import complete!";
      case "error":
        return "Import failed";
      default:
        return "Starting...";
    }
  };

  const getCityStatus = (city: { name: string }, index: number) => {
    if (index < progress.citiesProcessed) {
      return "completed";
    }
    if (city.name === progress.currentCity) {
      return "processing";
    }
    return "pending";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{getPhaseLabel()}</span>
        {progress.citiesTotal > 0 && (
          <span className="text-muted-foreground">
            {progress.citiesProcessed}/{progress.citiesTotal} cities
          </span>
        )}
      </div>

      {progress.phase !== "initializing" && progress.citiesTotal > 0 && (
        <Progress value={percent} className="h-2" />
      )}

      {progress.phase === "error" && progress.errorMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{progress.errorMessage}</span>
        </div>
      )}

      {progress.cities.length > 0 && progress.phase !== "initializing" && (
        <ScrollArea className="h-40 rounded-md border p-2">
          <div className="space-y-1">
            {progress.cities.map((city, idx) => {
              const status = getCityStatus(city, idx);
              return (
                <div 
                  key={`${city.name}-${city.countryCode}`} 
                  className="flex items-center gap-2 text-sm py-0.5"
                >
                  {status === "completed" && (
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                  )}
                  {status === "processing" && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  )}
                  {status === "pending" && (
                    <div className="h-3 w-3 rounded-full border border-muted shrink-0" />
                  )}
                  <span 
                    className={
                      status === "processing" 
                        ? "font-medium" 
                        : status === "completed"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    }
                  >
                    {city.name}
                  </span>
                  <span className="text-xs text-muted-foreground/50">
                    ({city.countryCode})
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {progress.phase === "initializing" && (
        <div className="flex flex-col items-center py-4 space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to Navio...</p>
        </div>
      )}

      {progress.phase === "finalizing" && (
        <div className="flex flex-col items-center py-4 space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Organizing discovered neighborhoods...
          </p>
        </div>
      )}
    </div>
  );
}
