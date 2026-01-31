import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Copy, 
  Code, 
  Link2, 
  EyeOff,
  ChevronDown,
  ChevronUp 
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SEOQualityIssue {
  id: string;
  slug: string;
  seo_title?: string;
  seo_meta_description?: string;
  issue_type: string;
}

interface SEOQualityStats {
  duplicate_seo_titles: number;
  duplicate_meta_descriptions: number;
  invalid_json_ld: number;
  short_intro_content: number;
  noindex_with_partners: number;
  missing_canonical_urls: number;
  issues: SEOQualityIssue[];
  score: number;
}

interface SEOQualityCardProps {
  stats: SEOQualityStats | null;
}

const issueConfig = {
  duplicate_title: {
    label: "Duplicate SEO Titles",
    icon: Copy,
    level: "warning" as const,
    description: "Multiple pages share the same SEO title",
  },
  duplicate_description: {
    label: "Duplicate Meta Descriptions",
    icon: Copy,
    level: "warning" as const,
    description: "Multiple pages share the same meta description",
  },
  invalid_json_ld: {
    label: "Invalid JSON-LD",
    icon: Code,
    level: "error" as const,
    description: "Structured data is missing or invalid",
  },
  short_intro: {
    label: "Short Intro Content",
    icon: FileText,
    level: "info" as const,
    description: "Intro content is below 150 words",
  },
  noindex_with_partners: {
    label: "Noindex with Partners",
    icon: EyeOff,
    level: "warning" as const,
    description: "Page is noindexed but has active partners",
  },
  missing_canonical: {
    label: "Missing Canonical URL",
    icon: Link2,
    level: "error" as const,
    description: "Page is missing canonical URL",
  },
};

function IssueRow({ 
  type, 
  count, 
  issues 
}: { 
  type: keyof typeof issueConfig; 
  count: number; 
  issues: SEOQualityIssue[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const config = issueConfig[type];
  const Icon = config.icon;
  const relevantIssues = issues.filter(i => i.issue_type === type);

  if (count === 0) return null;

  const levelColors = {
    error: "text-destructive",
    warning: "text-yellow-500",
    info: "text-blue-500",
  };

  const badgeVariants = {
    error: "destructive" as const,
    warning: "secondary" as const,
    info: "outline" as const,
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <Icon className={`h-4 w-4 ${levelColors[config.level]}`} />
            <div className="text-left">
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariants[config.level]}>
              {count} {config.level === "error" ? "errors" : config.level === "warning" ? "warnings" : "info"}
            </Badge>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-3 pb-3">
          <div className="bg-muted/30 rounded-md p-2 max-h-40 overflow-y-auto">
            {relevantIssues.slice(0, 10).map((issue, idx) => (
              <div key={idx} className="text-xs py-1 border-b border-border last:border-0">
                <span className="font-mono text-muted-foreground">{issue.slug}</span>
                {issue.seo_title && (
                  <span className="ml-2 text-foreground">"{issue.seo_title.substring(0, 40)}..."</span>
                )}
              </div>
            ))}
            {relevantIssues.length > 10 && (
              <p className="text-xs text-muted-foreground pt-1">
                + {relevantIssues.length - 10} more...
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SEOQualityCard({ stats }: SEOQualityCardProps) {
  if (!stats) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            SEO Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No SEO quality data available. Run a health check to analyze SEO metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-destructive";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return CheckCircle2;
    if (score >= 70) return AlertTriangle;
    return XCircle;
  };

  const ScoreIcon = getScoreIcon(stats.score);
  const totalIssues = 
    stats.duplicate_seo_titles + 
    stats.duplicate_meta_descriptions + 
    stats.invalid_json_ld + 
    stats.short_intro_content + 
    stats.noindex_with_partners + 
    stats.missing_canonical_urls;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            SEO Quality
          </CardTitle>
          <div className="flex items-center gap-2">
            <ScoreIcon className={`h-5 w-5 ${getScoreColor(stats.score)}`} />
            <span className={`text-2xl font-bold ${getScoreColor(stats.score)}`}>
              {stats.score}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={stats.score} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {totalIssues === 0 
              ? "All SEO checks passed" 
              : `${totalIssues} issue${totalIssues > 1 ? 's' : ''} found across service locations`
            }
          </p>
        </div>

        {/* Issues List */}
        {totalIssues > 0 && (
          <div className="space-y-1 border-t pt-4">
            <IssueRow 
              type="invalid_json_ld" 
              count={stats.invalid_json_ld} 
              issues={stats.issues} 
            />
            <IssueRow 
              type="missing_canonical" 
              count={stats.missing_canonical_urls} 
              issues={stats.issues} 
            />
            <IssueRow 
              type="duplicate_title" 
              count={stats.duplicate_seo_titles} 
              issues={stats.issues} 
            />
            <IssueRow 
              type="duplicate_description" 
              count={stats.duplicate_meta_descriptions} 
              issues={stats.issues} 
            />
            <IssueRow 
              type="noindex_with_partners" 
              count={stats.noindex_with_partners} 
              issues={stats.issues} 
            />
            <IssueRow 
              type="short_intro" 
              count={stats.short_intro_content} 
              issues={stats.issues} 
            />
          </div>
        )}

        {/* All Clear Message */}
        {totalIssues === 0 && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-600 dark:text-green-400">
              All SEO quality checks passed! Your service location pages are optimized.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
