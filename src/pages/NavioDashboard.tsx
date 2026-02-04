import { useState, useEffect, useCallback, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Layers, 
  Map, 
  History,
  RefreshCw,
  Search,
  MapPinned,
  Brain,
  Database,
} from "lucide-react";
import { useNavioImport } from "@/hooks/useNavioImport";
import { PipelineStatusBanner } from "@/components/navio/PipelineStatusBanner";
import { NextActionCard } from "@/components/navio/NextActionCard";
import { OperationHistoryTable } from "@/components/navio/OperationHistoryTable";
import { DeltaResultsPanel } from "@/components/sync/DeltaResultsPanel";
import { DeltaCheckLoading } from "@/components/sync/DeltaCheckLoading";
import { SyncProgressDialog } from "@/components/sync/SyncProgressDialog";
import { StagingAreaMap } from "@/components/map/StagingAreaMap";
import { DeliveryChecker } from "@/components/delivery/DeliveryChecker";
import { EnhancedSourceToggle, type MapSource } from "@/components/navio/EnhancedSourceToggle";
import { useNavioPipelineStatus } from "@/hooks/useNavioPipelineStatus";
import { ProductionDataPanel } from "@/components/navio/ProductionDataPanel";
import NavioStagingTab from "@/components/navio/NavioStagingTab";

const NavioDashboard = forwardRef<HTMLDivElement>((_, ref) => {
  const queryClient = useQueryClient();
  const [progressOpen, setProgressOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [mapSource, setMapSource] = useState<MapSource>("production");

  const { data: pipelineStatus } = useNavioPipelineStatus();

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

  const handleGoToStaging = useCallback(() => {
    setActiveTab("staging");
  }, []);

  const handleStartImport = useCallback(() => {
    navioIncrementalImport.mutate({ batchId: crypto.randomUUID() });
  }, [navioIncrementalImport]);

  return (
    <div ref={ref} className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Navio Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage delivery area imports and synchronization
        </p>
      </div>

      {/* Pipeline Status - Always visible */}
      <div className="mb-6">
        <PipelineStatusBanner />
      </div>

      {/* Next Action Card */}
      <div className="mb-6">
        <NextActionCard
          onCheckChanges={() => checkDelta()}
          onImport={handleStartImport}
          onGoToStaging={handleGoToStaging}
          onGeoSync={() => startGeoSync()}
          isCheckingDelta={isCheckingDelta}
          isImporting={isNavioImporting}
          isGeoSyncing={isGeoSyncing}
        />
      </div>

      {/* Main Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="staging" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Staging</span>
            {pipelineStatus && (pipelineStatus.stagingPending > 0 || pipelineStatus.stagingApproved > 0) && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {pipelineStatus.stagingPending + pipelineStatus.stagingApproved}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Production</span>
            {pipelineStatus && pipelineStatus.productionAreas > 0 && pipelineStatus.productionAreasWithGeo === 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                !
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Map</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Loading state during delta check */}
          {isCheckingDelta && <DeltaCheckLoading />}

          {/* Delta Results Panel - Shows after check completes */}
          {deltaResult && !isCheckingDelta && (
            <DeltaResultsPanel
              result={deltaResult}
              onStartImport={startDeltaImport}
              isImporting={isNavioImporting}
            />
          )}

          {/* Quick Actions Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Check for Changes
                </CardTitle>
                <CardDescription className="text-xs">
                  Detect new, changed, or removed areas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => checkDelta()}
                  disabled={isBusy}
                  size="sm"
                  className="w-full"
                >
                  {isCheckingDelta ? (
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-3 w-3" />
                  )}
                  Check Changes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPinned className="h-4 w-4" />
                  Geo Sync
                </CardTitle>
                <CardDescription className="text-xs">
                  Fast polygon-only sync
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => startGeoSync()}
                  disabled={isBusy}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  {isGeoSyncing ? (
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <MapPinned className="mr-2 h-3 w-3" />
                  )}
                  Run Sync
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Import
                </CardTitle>
                <CardDescription className="text-xs">
                  Full discovery with AI classification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleStartImport}
                  disabled={isBusy}
                  size="sm"
                  className="w-full"
                >
                  {isNavioImporting ? (
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Brain className="mr-2 h-3 w-3" />
                  )}
                  Start Import
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Operations */}
          <OperationHistoryTable limit={5} />
        </TabsContent>

        {/* Staging Tab */}
        <TabsContent value="staging">
          <NavioStagingTab />
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <ProductionDataPanel
            onGeoSync={() => startGeoSync()}
            isGeoSyncing={isGeoSyncing}
          />
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            {/* Source Toggle & Checker */}
            <div className="lg:col-span-1 space-y-4">
              <EnhancedSourceToggle
                value={mapSource}
                onChange={setMapSource}
                stagingCount={pipelineStatus?.stagingPending ?? 0}
                productionCount={pipelineStatus?.productionAreas ?? 0}
                productionGeoCount={pipelineStatus?.productionAreasWithGeo ?? 0}
                snapshotCount={pipelineStatus?.snapshotCount ?? 0}
              />
              <DeliveryChecker />
            </div>
            
            {/* Map */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Delivery Areas</CardTitle>
                </CardHeader>
                <CardContent>
                  <StagingAreaMap defaultSource={mapSource} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <OperationHistoryTable limit={50} />
        </TabsContent>
      </Tabs>

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
          queryClient.invalidateQueries({ queryKey: ["navio-pipeline-status"] });
        }}
      />
    </div>
  );
});
NavioDashboard.displayName = "NavioDashboard";

export default NavioDashboard;
