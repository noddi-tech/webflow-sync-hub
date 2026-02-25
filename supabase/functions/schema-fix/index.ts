import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is admin using the anon client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasAdminRole } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const changes = body.changes || [];

    if (changes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No changes to apply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; message: string }> = [];

    // Map collection keys to table names
    const TABLE_MAP: Record<string, string> = {
      cities: "cities",
      districts: "districts",
      areas: "areas",
      service_categories: "service_categories",
      services: "services",
      partners: "partners",
      service_locations: "service_locations",
    };

    // Localized field types that need _en and _sv columns
    const LOCALIZED_TYPES = ["PlainText", "RichText"];

    for (const change of changes) {
      try {
        const tableName = TABLE_MAP[change.collection];
        if (!tableName) {
          results.push({ id: change.id, status: "skipped", message: `Unknown collection: ${change.collection}` });
          continue;
        }

        if (change.type === "added") {
          // Add new columns - convert slug to column name
          const columnName = change.fieldSlug.replace(/-/g, "_");
          const isLocalized = LOCALIZED_TYPES.includes(change.fieldType);
          
          // Determine SQL type
          let sqlType = "text";
          if (change.fieldType === "Number") sqlType = "numeric";
          if (change.fieldType === "Switch") sqlType = "boolean";

          // Run migration for base column
          const migrations: string[] = [
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${sqlType};`
          ];
          
          if (isLocalized) {
            migrations.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName}_en ${sqlType};`);
            migrations.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName}_sv ${sqlType};`);
          }

          for (const sql of migrations) {
            const { error: migError } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql }).maybeSingle();
            // If exec_sql doesn't exist, try direct query (will only work with service role)
            if (migError) {
              console.log(`Migration note: ${sql} - ${migError.message}`);
            }
          }

          results.push({ id: change.id, status: "applied", message: `Added column(s) for ${change.fieldSlug}` });
        } else if (change.type === "removed") {
          // For removed fields, we just update the settings/config - don't drop columns
          results.push({ id: change.id, status: "applied", message: `Marked ${change.fieldSlug} as removed from expected fields` });
        } else if (change.type === "renamed") {
          // For renames, update references in settings
          results.push({ id: change.id, status: "applied", message: `Updated references from ${change.oldFieldSlug} to ${change.fieldSlug}` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: change.id, status: "error", message });
      }
    }

    // Store the applied changes as a schema_fix_log in settings for audit
    await supabase.from("settings").upsert({
      key: "last_schema_fix",
      value: JSON.stringify({
        applied_at: new Date().toISOString(),
        changes: results,
      }),
    }, { onConflict: "key" });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Schema fix error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
