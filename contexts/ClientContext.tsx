
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/dbClient';
import { Client } from '../types';
import { useAuth } from './AuthContext';

interface ClientContextData {
  clients: Client[];
  isLoading: boolean;
  addClient: (client: Omit<Client, 'id' | 'total_spent' | 'visits_count'>) => Promise<Client | null>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  refreshClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextData>({} as ClientContextData);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAvatarUrl = (name: string, currentUrl?: string) => {
    if (currentUrl && currentUrl.trim() !== '') return currentUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&bold=true`;
  };

  const mapClientFromDb = (c: any): Client => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    avatar_url: c.avatar_url,
    total_spent: c.total_spent || 0,
    visits_count: c.visits_count || 0,
    last_visit: c.last_visit,
    notes: c.notes,
    birth_date: c.birth_date,
    how_did_you_know: c.how_did_you_know,
    created_at: c.created_at,
    subscriptionStatus: c.subscription_status || 'NONE',
    cashback_balance: c.cashback_balance || 0,
    credit_balance: c.credit_balance || 0
  });

  const fetchClients = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setClients((data || []).map(mapClientFromDb));
    } catch (err: any) {
      console.error('Error fetching clients:', err.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const addClient = async (clientData: Omit<Client, 'id' | 'total_spent' | 'visits_count'>): Promise<Client | null> => {
    if (!user) return null;

    const tempId = crypto.randomUUID();
    const newClient: Client = {
      ...clientData,
      id: tempId,
      total_spent: 0,
      visits_count: 0,
      credit_balance: 0,
      cashback_balance: 0,
      avatar_url: getAvatarUrl(clientData.name, clientData.avatar_url),
      created_at: new Date().toISOString()
    };

    setClients((prev) => [newClient, ...prev].sort((a, b) => a.name.localeCompare(b.name)));

    try {
      const dbPayload: any = {
        id: tempId,
        client_id: user.id,
        name: newClient.name,
        phone: newClient.phone,
        email: newClient.email || null,
        avatar_url: newClient.avatar_url || null,
        notes: newClient.notes || null,
        birth_date: newClient.birth_date || null,
        how_did_you_know: newClient.how_did_you_know || null,
      };

      // Tenta incluir subscription_status apenas se necessário
      if (newClient.subscriptionStatus) {
        dbPayload.subscription_status = newClient.subscriptionStatus;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([dbPayload])
        .select()
        .single();

      if (error) throw error;
      if (data) {
          const mapped = mapClientFromDb(data);
          setClients((prev) => prev.map((c) => (c.id === tempId ? mapped : c)));
          return mapped;
      }
      return newClient;
    } catch (error: any) {
      setClients((prev) => prev.filter((c) => c.id !== tempId));
      console.error('Error adding client:', error.message || error);
      return null;
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const previousClients = [...clients];
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));

    try {
      const dbUpdates: any = { ...updates };
      
      if (dbUpdates.subscriptionStatus) {
        dbUpdates.subscription_status = dbUpdates.subscriptionStatus;
        delete dbUpdates.subscriptionStatus;
      }
      
      ['email', 'birth_date', 'avatar_url', 'notes', 'how_did_you_know'].forEach(key => {
        if (dbUpdates[key] === '') dbUpdates[key] = null;
      });

      const { error } = await supabase
        .from('customers')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
          // Se o erro for especificamente a falta da coluna, tenta atualizar sem ela
          if (error.message.includes('subscription_status')) {
              console.warn('Column subscription_status missing in DB. Updating without it.');
              delete dbUpdates.subscription_status;
              const { error: retryError } = await supabase.from('customers').update(dbUpdates).eq('id', id);
              if (retryError) throw retryError;
          } else {
              throw error;
          }
      }
    } catch (error: any) {
      console.error('Error updating client:', error.message || error);
      setClients(previousClients);
    }
  };

  const deleteClient = async (id: string) => {
    const previousClients = [...clients];
    setClients((prev) => prev.filter((c) => c.id !== id));
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting client:', error.message || error);
      setClients(previousClients);
    }
  };

  return (
    <ClientContext.Provider value={{ clients, isLoading, addClient, updateClient, deleteClient, refreshClients: fetchClients }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClients = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClients must be used within a ClientProvider');
  return context;
};
