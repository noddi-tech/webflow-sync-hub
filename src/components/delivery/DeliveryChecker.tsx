import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Search, Loader2, CheckCircle2, XCircle, Navigation } from "lucide-react";

interface DeliveryArea {
  area_id: string;
  area_name: string;
  district_id: string;
  district_name: string;
  city_id: string;
  city_name: string;
}

interface DeliveryCheckResult {
  delivers: boolean;
  areas: DeliveryArea[];
  coordinates: { lat: number; lng: number };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function DeliveryChecker() {
  const [coordinates, setCoordinates] = useState({ lat: 59.9139, lng: 10.7522 });
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<DeliveryCheckResult | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const checkMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }): Promise<DeliveryCheckResult> => {
      const { data, error } = await supabase.functions.invoke("check-delivery", {
        body: coords,
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return {
        delivers: data.delivers ?? false,
        areas: data.areas ?? [],
        coordinates: coords,
      };
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const geocodeAddress = async () => {
    if (!address.trim()) return;
    
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        {
          headers: {
            "User-Agent": "NavioDeliveryChecker/1.0",
          },
        }
      );
      
      const data: NominatimResult[] = await response.json();
      
      if (data[0]) {
        const newCoords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        setCoordinates(newCoords);
        setGeocodedAddress(data[0].display_name);
        // Automatically check delivery after geocoding
        checkMutation.mutate(newCoords);
      } else {
        setGeocodedAddress(null);
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      geocodeAddress();
    }
  };

  const handleCheck = () => {
    checkMutation.mutate(coordinates);
  };

  const useMyLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCoordinates(newCoords);
          setGeocodedAddress("Current location");
          checkMutation.mutate(newCoords);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Delivery Coverage Checker
        </CardTitle>
        <CardDescription>
          Enter an address or coordinates to check if delivery is available
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Address Search */}
        <div className="space-y-2">
          <Label>Address</Label>
          <div className="flex gap-2">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleAddressKeyDown}
              placeholder="Enter address (e.g., Karl Johans gate 1, Oslo)"
              className="flex-1"
            />
            <Button onClick={geocodeAddress} disabled={isGeocoding || !address.trim()}>
              {isGeocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {geocodedAddress && (
            <p className="text-xs text-muted-foreground truncate">
              Found: {geocodedAddress}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Coordinate Input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input
              type="number"
              step="any"
              value={coordinates.lat}
              onChange={(e) => setCoordinates((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))}
              placeholder="59.9139"
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input
              type="number"
              step="any"
              value={coordinates.lng}
              onChange={(e) => setCoordinates((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))}
              placeholder="10.7522"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleCheck} disabled={checkMutation.isPending} className="flex-1">
            {checkMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-2" />
            )}
            Check Delivery Coverage
          </Button>
          <Button variant="outline" onClick={useMyLocation}>
            <Navigation className="h-4 w-4" />
          </Button>
        </div>

        {/* Results */}
        {checkMutation.isError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {checkMutation.error instanceof Error ? checkMutation.error.message : "Check failed"}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert variant={result.delivers ? "default" : "destructive"}>
              {result.delivers ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.delivers ? "Delivery Available!" : "No Delivery Coverage"}
              </AlertTitle>
              <AlertDescription>
                {result.delivers
                  ? `Found ${result.areas.length} delivery area(s) covering this location.`
                  : "This location is not within any of our delivery areas."}
              </AlertDescription>
            </Alert>

            {result.delivers && result.areas.length > 0 && (
              <div className="space-y-2">
                <Label>Matching Areas</Label>
                <div className="space-y-2">
                  {result.areas.map((area) => (
                    <div
                      key={area.area_id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{area.area_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {area.district_name} → {area.city_name}
                        </p>
                      </div>
                      <Badge variant="outline">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Delivers
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Checked coordinates: {result.coordinates.lat.toFixed(6)}, {result.coordinates.lng.toFixed(6)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
