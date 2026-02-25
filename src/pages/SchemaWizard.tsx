import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { SchemaDetectionStep, type SchemaChange } from "@/components/schema/SchemaDetectionStep";
import { SchemaResolutionStep } from "@/components/schema/SchemaResolutionStep";
import { SchemaApplyStep } from "@/components/schema/SchemaApplyStep";

const COLLECTION_LABELS: Record<string, string> = {
  cities: "Cities",
  districts: "Districts",
  areas: "Areas",
  service_categories: "Service Categories",
  services: "Services",
  partners: "Partners",
  service_locations: "Service Locations",
};

// Detect renames by finding pairs of removed + added fields with similar slugs
function detectRenames(
  missing: Array<{ slug: string; type: string }>,
  extra: Array<{ slug: string; type: string }>
): Array<{ oldSlug: string; newSlug: string; type: string }> {
  const renames: Array<{ oldSlug: string; newSlug: string; type: string }> = [];
  
  for (const m of missing) {
    // Find an extra field with same type and similar name (e.g. city-2 → city-3)
    const baseSlug = m.slug.replace(/-\d+$/, "");
    const match = extra.find(e => {
      const eBase = e.slug.replace(/-\d+$/, "");
      return e.type === m.type && eBase === baseSlug && e.slug !== m.slug;
    });
    if (match) {
      renames.push({ oldSlug: m.slug, newSlug: match.slug, type: m.type });
    }
  }
  
  return renames;
}

export default function SchemaWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [changes, setChanges] = useState<SchemaChange[]>([]);

  // Fetch latest health check
  const { data: latestHealth, isLoading } = useQuery({
    queryKey: ["system-health-latest-wizard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_health")
        .select("*")
        .eq("check_type", "webflow_validation")
        .order("checked_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Parse validation results into schema changes
  useEffect(() => {
    if (!latestHealth?.results) return;
    
    const results = latestHealth.results as any;
    const collections = results.collections || {};
    const detected: SchemaChange[] = [];
    let idCounter = 0;

    for (const [collectionKey, collection] of Object.entries(collections) as any[]) {
      const missing = (collection.missing_in_webflow_typed || collection.missing_in_webflow || []).map((f: any) => 
        typeof f === "string" ? { slug: f, type: "Unknown" } : f
      );
      const extra = (collection.extra_in_webflow || []).map((slug: string) => {
        const detail = (collection.found_fields_detailed || []).find((d: any) => d.slug === slug);
        return { slug, type: detail?.type || "Unknown" };
      });

      // Detect renames
      const renames = detectRenames(missing, extra);
      const renamedOldSlugs = new Set(renames.map(r => r.oldSlug));
      const renamedNewSlugs = new Set(renames.map(r => r.newSlug));

      for (const r of renames) {
        detected.push({
          id: `change-${idCounter++}`,
          type: "renamed",
          collection: collectionKey,
          collectionLabel: COLLECTION_LABELS[collectionKey] || collectionKey,
          fieldSlug: r.newSlug,
          oldFieldSlug: r.oldSlug,
          fieldType: r.type,
          description: `Renamed from ${r.oldSlug} to ${r.newSlug}`,
          confirmed: false,
        });
      }

      // Added fields (extra in Webflow, not part of a rename)
      for (const e of extra) {
        if (renamedNewSlugs.has(e.slug)) continue;
        detected.push({
          id: `change-${idCounter++}`,
          type: "added",
          collection: collectionKey,
          collectionLabel: COLLECTION_LABELS[collectionKey] || collectionKey,
          fieldSlug: e.slug,
          fieldType: e.type,
          description: `New field added in Webflow`,
          confirmed: false,
        });
      }

      // Removed fields (in expected but not in Webflow, not part of a rename)
      for (const m of missing) {
        if (renamedOldSlugs.has(m.slug)) continue;
        detected.push({
          id: `change-${idCounter++}`,
          type: "removed",
          collection: collectionKey,
          collectionLabel: COLLECTION_LABELS[collectionKey] || collectionKey,
          fieldSlug: m.slug,
          fieldType: m.type || "Unknown",
          description: `Field no longer exists in Webflow`,
          confirmed: false,
        });
      }
    }

    setChanges(detected);
  }, [latestHealth]);

  const handleToggleChange = (id: string) => {
    setChanges(prev => prev.map(c => c.id === id ? { ...c, confirmed: !c.confirmed } : c));
  };

  const confirmedCount = changes.filter(c => c.confirmed).length;
  const hasChanges = changes.length > 0;

  const steps = [
    { label: "Detect", description: "Review detected changes" },
    { label: "Resolve", description: "Confirm each fix" },
    { label: "Apply", description: "Apply all fixes" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Schema Sync Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Detect and resolve Webflow schema mismatches
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {step === 0 && (
            <SchemaDetectionStep changes={changes} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <SchemaResolutionStep changes={changes} onToggleChange={handleToggleChange} />
          )}
          {step === 2 && (
            <SchemaApplyStep
              changes={changes}
              onComplete={() => navigate("/dashboard")}
            />
          )}
        </>
      )}

      {/* Navigation */}
      {!isLoading && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < 2 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && confirmedCount === 0}
            >
              {step === 0 && !hasChanges ? "No Changes" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
