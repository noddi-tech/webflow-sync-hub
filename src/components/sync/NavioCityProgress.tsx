import { Check, Loader2, AlertCircle, MapPin, Building2, Map } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

export interface CityData {
  name: string;
  countryCode: string;
  districtsFound?: number;
  neighborhoodsFound?: number;
  status?: "pending" | "processing" | "completed";
}

export interface CityProgressData {
  phase: "idle" | "initializing" | "processing" | "finalizing" | "complete" | "error";
  currentCity: string | null;
  citiesTotal: number;
  citiesProcessed: number;
  cities: CityData[];
  currentDistrictsTotal?: number;
  currentDistrictsProcessed?: number;
  currentNeighborhoodsFound?: number;
  errorMessage?: string;
}

interface NavioCityProgressProps {
  progress: CityProgressData;
}

export function NavioCityProgress({ progress }: NavioCityProgressProps) {
  const cityPercent = progress.citiesTotal > 0 
    ? Math.round((progress.citiesProcessed / progress.citiesTotal) * 100)
    : 0;

  const districtPercent = progress.currentDistrictsTotal && progress.currentDistrictsTotal > 0
    ? Math.round((progress.currentDistrictsProcessed || 0) / progress.currentDistrictsTotal * 100)
    : 0;

  const getPhaseInfo = () => {
    switch (progress.phase) {
      case "initializing":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
          label: "Connecting to Navio...",
          description: "Fetching available cities and service areas"
        };
      case "processing":
        return {
          icon: <MapPin className="h-5 w-5 text-primary" />,
          label: progress.currentCity 
            ? `Discovering neighborhoods in ${progress.currentCity}`
            : "Processing cities...",
          description: "AI is analyzing districts and finding neighborhoods"
        };
      case "finalizing":
        return {
          icon: <Map className="h-5 w-5 text-primary" />,
          label: "Organizing discovered data...",
          description: "Saving neighborhoods to staging for review"
        };
      case "complete":
        return {
          icon: <Check className="h-5 w-5 text-green-500" />,
          label: "Import complete!",
          description: "Ready for preview"
        };
      case "error":
        return {
          icon: <AlertCircle className="h-5 w-5 text-destructive" />,
          label: "Import failed",
          description: progress.errorMessage || "An error occurred"
        };
      default:
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
          label: "Starting...",
          description: ""
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  // Find the current city being processed
  const currentCityData = progress.cities.find(c => c.name === progress.currentCity);

  return (
    <div className="space-y-4">
      {/* Phase Header */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        {phaseInfo.icon}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{phaseInfo.label}</p>
          {phaseInfo.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{phaseInfo.description}</p>
          )}
        </div>
      </div>

      {/* Current City Card - Only show when processing */}
      {progress.phase === "processing" && progress.currentCity && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{progress.currentCity}</span>
            {currentCityData && (
              <span className="text-xs text-muted-foreground">
                ({currentCityData.countryCode})
              </span>
            )}
            <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
          </div>

          {/* District progress within current city */}
          {progress.currentDistrictsTotal && progress.currentDistrictsTotal > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Processing districts...
                </span>
                <span className="font-medium">
                  {progress.currentDistrictsProcessed || 0}/{progress.currentDistrictsTotal}
                </span>
              </div>
              <Progress value={districtPercent} className="h-1.5" />
              
              {progress.currentNeighborhoodsFound !== undefined && progress.currentNeighborhoodsFound > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  → {progress.currentNeighborhoodsFound} neighborhoods discovered so far
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* City List */}
      {progress.cities.length > 0 && progress.phase !== "initializing" && (
        <ScrollArea className="h-36 rounded-md border p-2">
          <div className="space-y-1">
            {progress.cities.map((city, idx) => {
              const isCompleted = city.status === "completed" || idx < progress.citiesProcessed;
              const isProcessing = city.name === progress.currentCity && progress.phase === "processing";
              const isPending = !isCompleted && !isProcessing;

              return (
                <div 
                  key={`${city.name}-${city.countryCode}`} 
                  className="flex items-center gap-2 text-sm py-1"
                >
                  {isCompleted && (
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  )}
                  {isProcessing && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  )}
                  {isPending && (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                  )}
                  
                  <span 
                    className={
                      isProcessing 
                        ? "font-medium text-foreground" 
                        : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                    }
                  >
                    {city.name}
                  </span>
                  
                  <span className="text-xs text-muted-foreground/50">
                    ({city.countryCode})
                  </span>

                  {/* Show stats for completed cities */}
                  {isCompleted && (city.districtsFound || city.neighborhoodsFound) && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {city.districtsFound && `${city.districtsFound} districts`}
                      {city.districtsFound && city.neighborhoodsFound && ", "}
                      {city.neighborhoodsFound && `${city.neighborhoodsFound} areas`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Overall Progress */}
      {progress.citiesTotal > 0 && progress.phase !== "initializing" && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall progress</span>
            <span className="font-medium">
              {progress.citiesProcessed}/{progress.citiesTotal} cities
            </span>
          </div>
          <Progress value={cityPercent} className="h-2" />
        </div>
      )}

      {/* Initializing State */}
      {progress.phase === "initializing" && (
        <div className="flex flex-col items-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to Navio API...</p>
        </div>
      )}

      {/* Finalizing State */}
      {progress.phase === "finalizing" && (
        <div className="flex flex-col items-center py-6 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Organizing {progress.citiesProcessed} cities for review...
          </p>
        </div>
      )}

      {/* Error State */}
      {progress.phase === "error" && progress.errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <span className="text-destructive">{progress.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
