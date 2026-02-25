
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Revoke from public, only service role can call this
REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
