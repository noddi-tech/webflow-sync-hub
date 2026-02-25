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

    // Load current overrides from settings
    const { data: overrideSetting } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "schema_expected_overrides")
      .maybeSingle();

    let overrides: Record<string, { added: string[]; removed: string[]; renamed: Record<string, string> }> = {};
    try {
      if (overrideSetting?.value) {
        overrides = JSON.parse(overrideSetting.value);
      }
    } catch {
      // Invalid JSON, start fresh
    }

    for (const change of changes) {
      try {
        const tableName = TABLE_MAP[change.collection];
        if (!tableName) {
          results.push({ id: change.id, status: "skipped", message: `Unknown collection: ${change.collection}` });
          continue;
        }

        // Ensure overrides entry exists for this collection
        if (!overrides[change.collection]) {
          overrides[change.collection] = { added: [], removed: [], renamed: {} };
        }

        if (change.type === "added") {
          // Add new columns - convert slug to column name
          const columnName = change.fieldSlug.replace(/-/g, "_");
          const isLocalized = LOCALIZED_TYPES.includes(change.fieldType);
          
          // Determine SQL type
          let sqlType = "text";
          if (change.fieldType === "Number") sqlType = "numeric";
          if (change.fieldType === "Switch") sqlType = "boolean";

          const migrations: string[] = [
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${sqlType};`
          ];
          
          if (isLocalized) {
            migrations.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName}_en ${sqlType};`);
            migrations.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName}_sv ${sqlType};`);
          }

          for (const sql of migrations) {
            const { error: migError } = await supabaseAdmin.rpc("exec_sql", { sql_query: sql });
            if (migError) {
              throw new Error(`Migration failed: ${migError.message}`);
            }
          }

          // Track in overrides so validate knows about the new expected field
          if (!overrides[change.collection].added.includes(change.fieldSlug)) {
            overrides[change.collection].added.push(change.fieldSlug);
          }

          results.push({ id: change.id, status: "applied", message: `Added column(s) for ${change.fieldSlug}` });

        } else if (change.type === "removed") {
          // Don't drop columns - just update overrides so validate stops expecting it
          if (!overrides[change.collection].removed.includes(change.fieldSlug)) {
            overrides[change.collection].removed.push(change.fieldSlug);
          }

          results.push({ id: change.id, status: "applied", message: `Removed ${change.fieldSlug} from expected fields` });

        } else if (change.type === "renamed") {
          // Rename the database column
          const oldCol = change.oldFieldSlug.replace(/-/g, "_");
          const newCol = change.fieldSlug.replace(/-/g, "_");

          const renameSql = `ALTER TABLE ${tableName} RENAME COLUMN ${oldCol} TO ${newCol};`;
          const { error: renameError } = await supabaseAdmin.rpc("exec_sql", { sql_query: renameSql });
          
          if (renameError) {
            // Column might not exist or already renamed - log but don't fail
            console.log(`Rename note: ${renameSql} - ${renameError.message}`);
          }

          // Also try renaming localized variants
          for (const suffix of ["_en", "_sv"]) {
            const localizedSql = `ALTER TABLE ${tableName} RENAME COLUMN ${oldCol}${suffix} TO ${newCol}${suffix};`;
            await supabaseAdmin.rpc("exec_sql", { sql_query: localizedSql }).catch(() => {});
          }

          // Track in overrides
          overrides[change.collection].renamed[change.oldFieldSlug] = change.fieldSlug;
          // Also remove old from expected, add new
          if (!overrides[change.collection].removed.includes(change.oldFieldSlug)) {
            overrides[change.collection].removed.push(change.oldFieldSlug);
          }
          if (!overrides[change.collection].added.includes(change.fieldSlug)) {
            overrides[change.collection].added.push(change.fieldSlug);
          }

          results.push({ id: change.id, status: "applied", message: `Renamed ${change.oldFieldSlug} → ${change.fieldSlug}` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: change.id, status: "error", message });
      }
    }

    // Persist overrides to settings
    await supabaseAdmin.from("settings").upsert({
      key: "schema_expected_overrides",
      value: JSON.stringify(overrides),
    }, { onConflict: "key" });

    // Store audit log
    await supabaseAdmin.from("settings").upsert({
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
