-- Drop the overly permissive policy for service role inserts
DROP POLICY IF EXISTS "Service role can insert system_health" ON public.system_health;