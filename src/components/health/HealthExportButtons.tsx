import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ValidationResults {
  collections: Record<string, {
    webflow_collection_name: string | null;
    collection_id: string | null;
    status: "ok" | "missing_fields" | "not_configured" | "error";
    expected_fields: string[];
    found_fields: string[];
    missing_in_webflow: string[];
    missing_required: string[];
    extra_in_webflow: string[];
    error_message?: string;
  }>;
  summary: {
    total: number;
    ok: number;
    missing_fields: number;
    not_configured: number;
    errors: number;
  };
  data_completeness?: Record<string, {
    total: number;
    seo_title: number;
    seo_meta_description: number;
    intro: number;
    name_en: number;
    name_sv: number;
  }>;
}

interface HealthExportButtonsProps {
  results: ValidationResults | null;
  checkedAt?: string;
}

export function HealthExportButtons({ results, checkedAt }: HealthExportButtonsProps) {
  const exportAsCSV = () => {
    if (!results) return;
    
    const rows: string[][] = [];
    
    // Header
    rows.push(["Health Report - " + (checkedAt ? new Date(checkedAt).toISOString() : "N/A")]);
    rows.push([]);
    
    // Summary
    rows.push(["Summary"]);
    rows.push(["Total Collections", String(results.summary.total)]);
    rows.push(["OK", String(results.summary.ok)]);
    rows.push(["Missing Fields", String(results.summary.missing_fields)]);
    rows.push(["Not Configured", String(results.summary.not_configured)]);
    rows.push(["Errors", String(results.summary.errors)]);
    rows.push([]);
    
    // Collection Details
    rows.push(["Collection Details"]);
    rows.push(["Collection", "Status", "Missing Fields", "Extra Fields", "Error"]);
    
    for (const [name, collection] of Object.entries(results.collections)) {
      rows.push([
        name,
        collection.status,
        collection.missing_in_webflow.join("; "),
        collection.extra_in_webflow.join("; "),
        collection.error_message || ""
      ]);
    }
    
    // Data Completeness
    if (results.data_completeness) {
      rows.push([]);
      rows.push(["Data Completeness"]);
      rows.push(["Entity", "Total", "SEO Title %", "Meta Desc %", "Intro %", "Name EN %", "Name SV %"]);
      
      for (const [entity, stats] of Object.entries(results.data_completeness)) {
        const total = stats.total || 1;
        rows.push([
          entity,
          String(stats.total),
          String(Math.round((stats.seo_title / total) * 100)) + "%",
          String(Math.round((stats.seo_meta_description / total) * 100)) + "%",
          String(Math.round((stats.intro / total) * 100)) + "%",
          String(Math.round((stats.name_en / total) * 100)) + "%",
          String(Math.round((stats.name_sv / total) * 100)) + "%"
        ]);
      }
    }
    
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    
    downloadFile(csvContent, "health-report.csv", "text/csv");
  };
  
  const exportAsJSON = () => {
    if (!results) return;
    
    const exportData = {
      generated_at: new Date().toISOString(),
      checked_at: checkedAt,
      summary: results.summary,
      collections: results.collections,
      data_completeness: results.data_completeness
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    downloadFile(jsonContent, "health-report.json", "application/json");
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
        disabled={!results}
      >
        <Download className="h-4 w-4 mr-2" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportAsJSON}
        disabled={!results}
      >
        <Download className="h-4 w-4 mr-2" />
        Export JSON
      </Button>
    </div>
  );
}
