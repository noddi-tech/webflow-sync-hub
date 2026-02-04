-- Create operation log table for tracking all Navio operations
CREATE TABLE public.navio_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'delta_check', 'ai_import', 'geo_sync', 'commit', 'approve', 'reject'
  status TEXT NOT NULL DEFAULT 'started', -- 'started', 'success', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  details JSONB, -- cities affected, areas processed, error messages, etc.
  user_id UUID REFERENCES auth.users(id),
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.navio_operation_log ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view navio_operation_log" 
ON public.navio_operation_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_operation_log" 
ON public.navio_operation_log 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_operation_log" 
ON public.navio_operation_log 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_operation_log" 
ON public.navio_operation_log 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient querying
CREATE INDEX idx_navio_operation_log_type_started ON public.navio_operation_log(operation_type, started_at DESC);
CREATE INDEX idx_navio_operation_log_batch ON public.navio_operation_log(batch_id) WHERE batch_id IS NOT NULL;