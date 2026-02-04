import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  label: string;
  count: number;
  secondaryCount?: number;
  secondaryLabel?: string;
  status: "empty" | "has-data" | "warning" | "success";
}

export interface NavioPipelineStatus {
  // Raw counts
  snapshotCount: number;
  productionCities: number;
  productionDistricts: number;
  productionAreas: number;
  stagingPending: number;
  stagingApproved: number;
  stagingCommitted: number;
  lastSnapshotUpdate: string | null;
  
  // Computed pipeline stages
  stages: {
    snapshot: PipelineStage;
    staging: PipelineStage;
    production: PipelineStage;
  };
  
  // Contextual guidance
  nextAction: {
    type: "import" | "review" | "commit" | "sync" | "none";
    message: string;
    urgency: "low" | "medium" | "high";
  };
}

export function useNavioPipelineStatus() {
  return useQuery({
    queryKey: ["navio-pipeline-status"],
    queryFn: async (): Promise<NavioPipelineStatus> => {
      const [
        snapshotResult,
        citiesResult,
        districtsResult,
        areasResult,
        stagingCitiesResult,
      ] = await Promise.all([
        supabase.from("navio_snapshot").select("snapshot_at", { count: "exact", head: false }).limit(1).order("snapshot_at", { ascending: false }),
        supabase.from("cities").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
        supabase.from("areas").select("id", { count: "exact", head: true }),
        supabase.from("navio_staging_cities").select("status"),
      ]);

      const stagingData = stagingCitiesResult.data || [];
      const stagingPending = stagingData.filter(c => c.status === "pending").length;
      const stagingApproved = stagingData.filter(c => c.status === "approved").length;
      const stagingCommitted = stagingData.filter(c => c.status === "committed").length;

      const snapshotCount = snapshotResult.count || 0;
      const productionCities = citiesResult.count || 0;
      const productionDistricts = districtsResult.count || 0;
      const productionAreas = areasResult.count || 0;
      const lastSnapshotUpdate = snapshotResult.data?.[0]?.snapshot_at || null;

      // Compute pipeline stages
      const totalStaging = stagingPending + stagingApproved;
      
      const stages: NavioPipelineStatus["stages"] = {
        snapshot: {
          label: "Snapshot",
          count: snapshotCount,
          status: snapshotCount > 0 ? "has-data" : "empty",
        },
        staging: {
          label: "Staging",
          count: stagingPending,
          secondaryCount: stagingApproved,
          secondaryLabel: "approved",
          status: stagingApproved > 0 
            ? "success" 
            : stagingPending > 0 
              ? "warning" 
              : "empty",
        },
        production: {
          label: "Production",
          count: productionAreas,
          secondaryCount: productionCities,
          secondaryLabel: "cities",
          status: productionAreas > 0 ? "has-data" : "empty",
        },
      };

      // Determine next action
      let nextAction: NavioPipelineStatus["nextAction"];
      
      if (stagingApproved > 0) {
        nextAction = {
          type: "commit",
          message: `${stagingApproved} approved ${stagingApproved === 1 ? "city is" : "cities are"} ready to commit to production.`,
          urgency: "high",
        };
      } else if (stagingPending > 0) {
        nextAction = {
          type: "review",
          message: `${stagingPending} ${stagingPending === 1 ? "city needs" : "cities need"} review. Approve or reject them before committing.`,
          urgency: "medium",
        };
      } else if (snapshotCount === 0 && productionAreas === 0) {
        nextAction = {
          type: "import",
          message: "No data yet. Run an AI Import to discover delivery areas from Navio.",
          urgency: "medium",
        };
      } else if (snapshotCount > 0 && productionAreas > 0) {
        nextAction = {
          type: "sync",
          message: "Run 'Check for Changes' to detect new or modified areas in Navio.",
          urgency: "low",
        };
      } else {
        nextAction = {
          type: "none",
          message: "All systems up to date.",
          urgency: "low",
        };
      }

      return {
        snapshotCount,
        productionCities,
        productionDistricts,
        productionAreas,
        stagingPending,
        stagingApproved,
        stagingCommitted,
        lastSnapshotUpdate,
        stages,
        nextAction,
      };
    },
    refetchInterval: 15000,
  });
}
