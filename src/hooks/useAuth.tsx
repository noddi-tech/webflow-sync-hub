import { useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const checkAdminRole = async (userId: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });
        
        if (error) {
          console.error('Error checking admin role:', error);
          return false;
        }
        return data === true;
      } catch (err) {
        console.error('Error checking admin role:', err);
        return false;
      }
    };

    const applySession = async (newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        const adminStatus = await checkAdminRole(newSession.user.id);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      
      setIsLoading(false);
    };

    // Get initial session - this always resolves loading
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    }).catch(() => {
      setIsLoading(false);
    });

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        applySession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, isLoading, isAdmin, signOut };
}
