import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type OperationType = "delta_check" | "ai_import" | "geo_sync" | "commit" | "approve" | "reject";
export type OperationStatus = "started" | "success" | "failed";

export interface OperationLogEntry {
  id: string;
  operation_type: OperationType;
  status: OperationStatus;
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface LogOperationParams {
  operation_type: OperationType;
  status?: OperationStatus;
  details?: Record<string, unknown>;
  batch_id?: string;
}

export function useNavioOperationLog(limit = 20) {
  const queryClient = useQueryClient();

  const logsQuery = useQuery({
    queryKey: ["navio-operation-log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navio_operation_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as OperationLogEntry[];
    },
  });

  const logOperation = useMutation({
    mutationFn: async (params: LogOperationParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Use type assertion to work around strict typing
      const { data, error } = await supabase
        .from("navio_operation_log")
        .insert([{
          operation_type: params.operation_type as string,
          status: (params.status || "started") as string,
          details: (params.details || null) as Json,
          batch_id: params.batch_id || null,
          user_id: user?.id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as OperationLogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-operation-log"] });
    },
  });

  const updateOperation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      details 
    }: { 
      id: string; 
      status: OperationStatus; 
      details?: Record<string, unknown>;
    }) => {
      const updateData: Record<string, unknown> = {
        status,
        completed_at: new Date().toISOString(),
      };
      
      if (details) {
        updateData.details = details;
      }

      const { data, error } = await supabase
        .from("navio_operation_log")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as OperationLogEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navio-operation-log"] });
    },
  });

  return {
    logs: logsQuery.data || [],
    isLoading: logsQuery.isLoading,
    error: logsQuery.error,
    logOperation,
    updateOperation,
    refetch: logsQuery.refetch,
  };
}

// Helper function to get operation display info
export function getOperationDisplayInfo(type: OperationType): { label: string; icon: string } {
  switch (type) {
    case "delta_check":
      return { label: "Check for Changes", icon: "Search" };
    case "ai_import":
      return { label: "AI Import", icon: "Brain" };
    case "geo_sync":
      return { label: "Geo Sync", icon: "MapPinned" };
    case "commit":
      return { label: "Commit", icon: "Upload" };
    case "approve":
      return { label: "Approve", icon: "Check" };
    case "reject":
      return { label: "Reject", icon: "X" };
    default:
      return { label: type, icon: "Activity" };
  }
}
