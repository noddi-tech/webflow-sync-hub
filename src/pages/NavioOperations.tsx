import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, MapPinned, Brain, ArrowRight } from "lucide-react";
import { useNavioImport } from "@/hooks/useNavioImport";
import { DeltaSummaryCard } from "@/components/sync/DeltaSummary";
import { SyncProgressDialog } from "@/components/sync/SyncProgressDialog";
import { Link } from "react-router-dom";

export default function NavioOperations() {
  const queryClient = useQueryClient();
  const [progressOpen, setProgressOpen] = useState(false);

  const {
    cityProgress,
    navioIncrementalImport,
    isImporting: isNavioImporting,
    deltaResult,
    isCheckingDelta,
    checkDelta,
    startDeltaImport,
    isGeoSyncing,
    startGeoSync,
  } = useNavioImport();

  // Open progress dialog when Navio import starts
  useEffect(() => {
    if (cityProgress.phase !== "idle") {
      setProgressOpen(true);
    }
  }, [cityProgress.phase]);

  const isBusy = isNavioImporting || isCheckingDelta || isGeoSyncing;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Navio Operations</h1>
        <p className="text-muted-foreground mt-1">
          Manage delivery area imports and synchronization from Navio
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Delta Summary Card */}
        {deltaResult && (
          <DeltaSummaryCard
            deltaResult={deltaResult}
            onStartImport={startDeltaImport}
            isImporting={isNavioImporting}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Check for Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Check for Changes
              </CardTitle>
              <CardDescription>
                Compare current Navio data against your last snapshot to detect new, changed, or removed areas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => checkDelta()}
                disabled={isBusy}
                className="w-full"
              >
                {isCheckingDelta ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Check for Changes
              </Button>
            </CardContent>
          </Card>

          {/* Geo Sync */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned className="h-5 w-5" />
                Geo Sync
              </CardTitle>
              <CardDescription>
                Fast polygon-only sync. Updates geofences without AI classification. Best for routine updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => startGeoSync()}
                disabled={isBusy}
                variant="secondary"
                className="w-full"
              >
                {isGeoSyncing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPinned className="mr-2 h-4 w-4" />
                )}
                Run Geo Sync
              </Button>
            </CardContent>
          </Card>

          {/* AI Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Import
              </CardTitle>
              <CardDescription>
                Full discovery with AI neighborhood classification. Use when adding new cities or restructuring areas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navioIncrementalImport.mutate({ batchId: crypto.randomUUID() })}
                disabled={isBusy}
                className="w-full"
              >
                {isNavioImporting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                Start AI Import
              </Button>
            </CardContent>
          </Card>

          {/* Preview Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Preview & Commit
              </CardTitle>
              <CardDescription>
                Review staged data and commit approved changes to the production database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/navio-preview">
                  Go to Preview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SyncProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        batchId={null}
        operation="import"
        entities={["cities", "districts", "areas"]}
        source="navio"
        cityProgress={cityProgress}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["entity-counts"] });
        }}
      />
    </div>
  );
}
