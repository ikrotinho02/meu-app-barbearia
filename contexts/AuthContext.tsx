
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/dbClient'; 
import { UserRole } from '../types';

interface AuthContextType {
  user: any | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (data: any) => Promise<void>;
  signOut: () => Promise<void>;
  registerCustomer: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      const metadataRole = session?.user?.user_metadata?.role;
      const uiRole = metadataRole === 'owner' ? 'professional' : metadataRole;
      setRole(uiRole as UserRole ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const metadataRole = session?.user?.user_metadata?.role;
      const uiRole = metadataRole === 'owner' ? 'professional' : metadataRole;
      setRole(uiRole as UserRole ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async ({ email, password, isRegister, name, role: targetRole }: any) => {
    try {
      if (isRegister) {
        // Multi-tenant registration: owner metadata
        const metaRole = targetRole === 'professional' ? 'owner' : 'client';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role: metaRole } }
        });

        if (error) throw error;
        
        if (data.user && targetRole === 'professional') {
           const userId = data.user.id;
           const clientOwnerPayload = {
               id: userId, // client_id match auth.uid()
               name: name,
               email: email,
               role: 'owner',
               store_name: name || 'Minha Barbearia',
               metadata: {
                   registration_date: new Date().toISOString(),
                   onboarding_completed: false
               }
           };
           // Criar registro na tabela clients para garantir isolamento
           await supabase.from('clients').insert([clientOwnerPayload]);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUser(null);
  };

  const registerCustomer = async ({ name, phone, email, birth_date, how_did_you_know }: any) => {
    if (!user) throw new Error('Usuário não autenticado.');
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Em SaaS, o cliente deve estar vinculado ao lojista atual
    const payload = {
      client_id: user.id,
      name,
      phone: cleanPhone,
      email: email || null,
      birth_date: birth_date || null,
      how_did_you_know: how_did_you_know || null,
      total_spent: 0,
      visits_count: 0
    };
    await supabase.from('customers').insert([payload]);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut, registerCustomer }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
