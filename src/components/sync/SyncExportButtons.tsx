import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface SyncLog {
  id: string;
  created_at: string;
  entity_type: string;
  operation: string;
  status: string;
  message: string | null;
}

interface SyncExportButtonsProps {
  logs: SyncLog[];
  isLoading: boolean;
}

export function SyncExportButtons({ logs, isLoading }: SyncExportButtonsProps) {
  const exportAsCSV = () => {
    if (!logs || logs.length === 0) return;
    
    const headers = ["Timestamp", "Entity", "Operation", "Status", "Message"];
    const rows = logs.map(log => [
      new Date(log.created_at).toISOString(),
      log.entity_type,
      log.operation,
      log.status,
      log.message || ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    downloadFile(csvContent, "sync-history.csv", "text/csv");
  };
  
  const exportAsJSON = () => {
    if (!logs || logs.length === 0) return;
    
    const exportData = logs.map(log => ({
      timestamp: log.created_at,
      entity: log.entity_type,
      operation: log.operation,
      status: log.status,
      message: log.message
    }));
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    downloadFile(jsonContent, "sync-history.json", "application/json");
  };
  
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportAsCSV}
        disabled={isLoading || !logs || logs.length === 0}
      >
        <Download className="h-4 w-4 mr-2" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportAsJSON}
        disabled={isLoading || !logs || logs.length === 0}
      >
        <Download className="h-4 w-4 mr-2" />
        Export JSON
      </Button>
    </div>
  );
}
