import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            variant: 'destructive',
            title: 'Email já cadastrado',
            description: 'Tente fazer login ou use outro email.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro no cadastro',
            description: error.message,
          });
        }
        return { error };
      }

      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo ao Dutch Online!',
      });

      return { data };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If user doesn't exist, auto-signup
        if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: 'destructive',
            title: 'Credenciais inválidas',
            description: 'Email ou senha incorretos.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro no login',
            description: error.message,
          });
        }
        return { error };
      }

      toast({
        title: 'Login realizado!',
        description: 'Bem-vindo de volta!',
      });

      return { data };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao sair',
        description: error.message,
      });
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
