import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StagingAreaMap } from "@/components/map/StagingAreaMap";
import { DeliveryChecker } from "@/components/delivery/DeliveryChecker";

export default function NavioDeliveryMap() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Delivery Map</h1>
        <p className="text-muted-foreground mt-1">
          View production delivery areas and test coverage
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map - takes 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <StagingAreaMap defaultSource="production" />
            </CardContent>
          </Card>
        </div>

        {/* Delivery Checker - takes 1/3 width */}
        <div>
          <DeliveryChecker />
        </div>
      </div>
    </div>
  );
}
