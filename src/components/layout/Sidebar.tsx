import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Map,
  Layers,
  Users,
  Settings,
  LogOut,
  History,
  FolderTree,
  Wrench,
  Link2,
  Globe,
  ExternalLink,
  Download,
  RefreshCw,
  MapPinned,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CollapsibleNavSection, type NavSection } from "./CollapsibleNavSection";

type NavItem = 
  | { type: "separator" }
  | { type: "collapsible"; section: NavSection }
  | { name: string; href: string; icon: React.ComponentType<{ className?: string }> };

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { type: "separator" },
  { name: "Cities", href: "/cities", icon: MapPin },
  { name: "Districts", href: "/districts", icon: Map },
  { name: "Areas", href: "/areas", icon: Layers },
  { type: "separator" },
  { name: "Service Categories", href: "/service-categories", icon: FolderTree },
  { name: "Services", href: "/services", icon: Wrench },
  { type: "separator" },
  { name: "Partners", href: "/partners", icon: Users },
  { name: "Partner Coverage", href: "/partner-service-locations", icon: Link2 },
  { type: "separator" },
  { name: "Service Locations", href: "/service-locations", icon: Globe },
  { type: "separator" },
  {
    type: "collapsible",
    section: {
      name: "Webflow",
      icon: ExternalLink,
      items: [
        { name: "Import", href: "/webflow/import", icon: Download },
        { name: "Sync", href: "/webflow/sync", icon: RefreshCw },
      ],
    },
  },
  {
    type: "collapsible",
    section: {
      name: "Navio",
      icon: MapPinned,
      items: [
        { name: "Operations", href: "/navio", icon: Settings },
        { name: "Staging", href: "/navio-staging", icon: Eye },
        { name: "Delivery Map", href: "/navio-map", icon: Map },
      ],
    },
  },
  { type: "separator" },
  { name: "Sync History", href: "/sync-history", icon: History },
  { type: "separator" },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar = React.forwardRef<HTMLDivElement, object>(
  function Sidebar(props, ref) {
    const location = useLocation();
    const { signOut, user } = useAuth();

    return (
      <div ref={ref} className="flex h-screen w-64 flex-col border-r bg-card">
        <div className="p-6">
          <h1 className="text-xl font-bold text-foreground">CMS Manager</h1>
          <p className="text-sm text-muted-foreground truncate mt-1">{user?.email}</p>
        </div>
        
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          {navigation.map((item, index) => {
            if ('type' in item && item.type === 'separator') {
              return <Separator key={`sep-${index}`} className="my-2" />;
            }
            
            if ('type' in item && item.type === 'collapsible') {
              return (
                <CollapsibleNavSection 
                  key={item.section.name} 
                  section={item.section} 
                />
              );
            }
            
            const navItem = item as { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
            const isActive = location.pathname === navItem.href;
            return (
              <Link
                key={navItem.name}
                to={navItem.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <navItem.icon className="h-5 w-5" />
                {navItem.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }
);
Sidebar.displayName = "Sidebar";
