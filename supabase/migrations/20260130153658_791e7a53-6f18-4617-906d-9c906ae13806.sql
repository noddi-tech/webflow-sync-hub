-- Create system_health table to store validation results and data completeness metrics
CREATE TABLE public.system_health (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
    results JSONB,
    summary JSONB,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for quick lookups by check_type and date
CREATE INDEX idx_system_health_check_type ON public.system_health(check_type);
CREATE INDEX idx_system_health_checked_at ON public.system_health(checked_at DESC);

-- Enable Row Level Security
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view system_health"
ON public.system_health
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert system_health"
ON public.system_health
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert system_health"
ON public.system_health
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete system_health"
ON public.system_health
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));