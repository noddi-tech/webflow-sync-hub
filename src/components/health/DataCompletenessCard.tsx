import { Progress } from "@/components/ui/progress";

interface DataCompletenessCardProps {
  entity: string;
  stats: {
    total: number;
    seo_title: number;
    seo_meta_description: number;
    intro: number;
    name_en: number;
    name_sv: number;
  };
}

const ENTITY_LABELS: Record<string, string> = {
  cities: "Cities",
  districts: "Districts",
  areas: "Areas",
  service_categories: "Service Categories",
  services: "Services",
  partners: "Partners",
  service_locations: "Service Locations",
};

function getPercentage(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-yellow-500";
  return "bg-destructive";
}

export function DataCompletenessCard({ entity, stats }: DataCompletenessCardProps) {
  const metrics = [
    { label: "SEO Title", value: stats.seo_title, total: stats.total },
    { label: "Meta Description", value: stats.seo_meta_description, total: stats.total },
    { label: "Intro Content", value: stats.intro, total: stats.total },
    { label: "English Name", value: stats.name_en, total: stats.total },
    { label: "Swedish Name", value: stats.name_sv, total: stats.total },
  ];

  // Calculate overall completeness
  const overallPercentage = Math.round(
    metrics.reduce((sum, m) => sum + getPercentage(m.value, m.total), 0) / metrics.length
  );

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">{ENTITY_LABELS[entity] || entity}</h4>
        <span className="text-xs text-muted-foreground">
          {stats.total} records
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Overall</span>
          <span className="text-xs font-medium">{overallPercentage}%</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all ${getProgressColor(overallPercentage)}`}
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {/* Individual metrics */}
      <div className="space-y-2">
        {metrics.map((metric) => {
          const percentage = getPercentage(metric.value, metric.total);
          return (
            <div key={metric.label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28 shrink-0">
                {metric.label}
              </span>
              <div className="flex-1 relative h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all ${getProgressColor(percentage)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right">
                {metric.value}/{metric.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
