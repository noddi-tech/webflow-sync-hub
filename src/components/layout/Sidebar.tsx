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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cities", href: "/cities", icon: MapPin },
  { name: "Districts", href: "/districts", icon: Map },
  { name: "Areas", href: "/areas", icon: Layers },
  { name: "Partners", href: "/partners", icon: Users },
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
        
        <nav className="flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
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
