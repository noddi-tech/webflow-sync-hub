import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Admin check timeout')), 5000)
      );
      
      const rpcPromise = supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      return data === true;
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  }, []);

  const applySession = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    
    if (newSession?.user) {
      const adminStatus = await checkAdminRole(newSession.user.id);
      setIsAdmin(adminStatus);
    } else {
      setIsAdmin(false);
    }
    
    setIsLoading(false);
  }, [checkAdminRole]);

  useEffect(() => {
    // Get initial session FIRST - this always resolves loading
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    }).catch(() => {
      setIsLoading(false);
    });

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION as we handle it above
        if (event === 'INITIAL_SESSION') return;
        applySession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, isLoading, isAdmin, signOut };
}
