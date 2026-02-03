import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeliveryCheckRequest {
  lng: number;
  lat: number;
}

interface DeliveryArea {
  area_id: string;
  area_name: string;
  district_id: string;
  district_name: string;
  city_id: string;
  city_name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lng, lat }: DeliveryCheckRequest = await req.json();

    if (typeof lng !== "number" || typeof lat !== "number") {
      return new Response(
        JSON.stringify({ error: "lng and lat must be numbers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the PostGIS function to find delivery areas containing this point
    const { data, error } = await supabase.rpc("find_delivery_areas", {
      lng,
      lat,
    });

    if (error) {
      console.error("Error checking delivery:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const areas = data as DeliveryArea[];
    const delivers = areas.length > 0;

    return new Response(
      JSON.stringify({
        delivers,
        coordinates: { lng, lat },
        areas,
        message: delivers
          ? `We deliver to this location! Found in ${areas.length} delivery area(s).`
          : "Sorry, we don't deliver to this location yet.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
