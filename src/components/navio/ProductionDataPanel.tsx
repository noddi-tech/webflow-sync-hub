import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  AlertTriangle,
  ExternalLink,
  Database,
  Map,
} from "lucide-react";
import { useProductionData, useProductionDistricts, type ProductionCity } from "@/hooks/useProductionData";
import { cn } from "@/lib/utils";

const getCountryFlag = (code: string | null) => {
  const flags: Record<string, string> = {
    NO: "🇳🇴",
    SE: "🇸🇪",
    DK: "🇩🇰",
    FI: "🇫🇮",
    DE: "🇩🇪",
    GB: "🇬🇧",
    US: "🇺🇸",
    CA: "🇨🇦",
  };
  return flags[code || ""] || "🏳️";
};

function DistrictsList({ cityId }: { cityId: string }) {
  const { data: districts, isLoading } = useProductionDistricts(cityId);

  if (isLoading) {
    return (
      <div className="pl-8 py-2 space-y-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  if (!districts?.length) {
    return (
      <div className="pl-8 py-2 text-sm text-muted-foreground">
        No districts found
      </div>
    );
  }

  return (
    <div className="pl-8 py-2 border-l ml-4">
      {districts.map(district => (
        <div 
          key={district.id} 
          className="flex items-center gap-3 py-1 text-sm hover:bg-muted/50 px-2 rounded"
        >
          <span className="font-medium">{district.name}</span>
          <span className="text-muted-foreground">
            {district.area_count} areas
          </span>
          {district.areas_with_geofence > 0 && (
            <Badge variant="outline" className="text-xs">
              <Map className="h-3 w-3 mr-1" />
              {district.areas_with_geofence}
            </Badge>
          )}
          {district.area_count > 0 && district.areas_with_geofence === 0 && (
            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              No geofences
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function CityRow({ city }: { city: ProductionCity }) {
  const [isOpen, setIsOpen] = useState(false);
  const geoPercent = city.area_count > 0 
    ? Math.round((city.areas_with_geofence / city.area_count) * 100) 
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="cursor-pointer hover:bg-muted/50">
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell>
          <span className="mr-2">{getCountryFlag(city.country_code)}</span>
          <span className="font-medium">{city.name}</span>
          {city.is_delivery && (
            <Badge variant="secondary" className="ml-2 text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              Delivery
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">{city.district_count}</TableCell>
        <TableCell className="text-center">{city.area_count}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Progress 
              value={geoPercent} 
              className={cn(
                "h-2 w-20",
                geoPercent === 0 && "bg-amber-100"
              )}
            />
            <span className={cn(
              "text-xs",
              geoPercent === 0 && "text-amber-600 font-medium",
              geoPercent === 100 && "text-green-600"
            )}>
              {city.areas_with_geofence}/{city.area_count}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Link to="/cities">
            <Button variant="ghost" size="sm" className="h-7">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={6} className="p-0 bg-muted/30">
            <DistrictsList cityId={city.id} />
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ProductionDataPanelProps {
  onGeoSync?: () => void;
  isGeoSyncing?: boolean;
}

export function ProductionDataPanel({ onGeoSync, isGeoSyncing }: ProductionDataPanelProps) {
  const { data, isLoading } = useProductionData();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Production Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { cities, summary } = data || { cities: [], summary: { cities: 0, districts: 0, areas: 0, areasWithGeofence: 0, geofenceCoverage: 0 } };
  const needsGeoSync = summary.areas > 0 && summary.geofenceCoverage < 50;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Production Data
          </CardTitle>
          {needsGeoSync && onGeoSync && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={onGeoSync}
              disabled={isGeoSyncing}
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {isGeoSyncing ? "Syncing..." : "Geo Sync Needed"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.cities}</p>
            <p className="text-xs text-muted-foreground">Cities</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.districts}</p>
            <p className="text-xs text-muted-foreground">Districts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.areas.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Areas</p>
          </div>
          <div className="text-center">
            <p className={cn(
              "text-2xl font-bold",
              summary.geofenceCoverage === 0 && "text-amber-600",
              summary.geofenceCoverage === 100 && "text-green-600"
            )}>
              {summary.geofenceCoverage}%
            </p>
            <p className="text-xs text-muted-foreground">Geofences</p>
          </div>
        </div>

        {/* Warning Banner */}
        {summary.areas > 0 && summary.areasWithGeofence === 0 && (
          <div className="flex items-center gap-3 p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">No geofence data in production</p>
              <p className="text-xs opacity-80">
                {summary.areas.toLocaleString()} areas exist but none have polygon data. 
                Run Geo Sync to populate geofences from the Navio API.
              </p>
            </div>
          </div>
        )}

        {/* Cities Table */}
        {cities.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="w-24 text-center">Districts</TableHead>
                  <TableHead className="w-24 text-center">Areas</TableHead>
                  <TableHead className="w-32">Geofences</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities.map(city => (
                  <CityRow key={city.id} city={city} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No production data yet</p>
            <p className="text-sm">
              Import and commit cities from staging to see them here
            </p>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex gap-2 pt-2">
          <Link to="/cities">
            <Button variant="outline" size="sm">
              Manage Cities
            </Button>
          </Link>
          <Link to="/districts">
            <Button variant="outline" size="sm">
              Manage Districts
            </Button>
          </Link>
          <Link to="/areas">
            <Button variant="outline" size="sm">
              Manage Areas
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
