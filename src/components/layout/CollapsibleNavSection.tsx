import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

interface CollapsibleNavSectionProps {
  section: NavSection;
}

export function CollapsibleNavSection({ section }: CollapsibleNavSectionProps) {
  const location = useLocation();
  
  const [isOpen, setIsOpen] = React.useState(() => {
    const stored = localStorage.getItem(`nav-${section.name}`);
    return stored !== 'false';
  });

  const hasActiveChild = section.items.some(
    item => location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem(`nav-${section.name}`, String(open));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          hasActiveChild
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <section.icon className="h-5 w-5" />
        <span className="flex-1 text-left">{section.name}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1">
        {section.items.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg pl-10 pr-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
