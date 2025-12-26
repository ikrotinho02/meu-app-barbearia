
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/dbClient'; 
import { Service } from '../types';
import { useAuth } from './AuthContext';

interface ServiceContextType {
  services: Service[];
  isLoading: boolean;
  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  refreshServices: () => Promise<void>;
}

const ServiceContext = createContext<ServiceContextType>({} as ServiceContextType);

export const ServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    if (!user) {
        setServices([]);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('client_id', user.id)
        .order('name', { ascending: true });

      if (!error && data) {
        setServices(data.map((s: any) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          durationMinutes: s.duration_minutes,
          description: s.description,
          category: s.category || 'Outros',
          commissionType: s.commission_type || 'default',
          customCommissionRate: s.custom_commission_rate,
          cashbackReward: s.cashback_reward || 0
        })));
      } else {
        setServices([]);
      }
    } catch (err) {
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const addService = async (serviceData: Omit<Service, 'id'>) => {
    if (!user) return;
    const tempId = crypto.randomUUID();
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          id: tempId,
          client_id: user.id,
          name: serviceData.name,
          price: serviceData.price,
          duration_minutes: serviceData.durationMinutes,
          description: serviceData.description || null,
          category: serviceData.category || 'Outros',
          commission_type: serviceData.commissionType || 'default',
          custom_commission_rate: serviceData.customCommissionRate || null,
          cashback_reward: serviceData.cashbackReward || 0
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchServices();
    } catch (error: any) {
      throw error;
    }
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    try {
      const dbUpdates: any = { ...updates };
      if (updates.durationMinutes) dbUpdates.duration_minutes = updates.durationMinutes;
      const { error } = await supabase.from('services').update(dbUpdates).eq('id', id);
      if (error) throw error;
      await fetchServices();
    } catch (error: any) {
      throw error;
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
    } catch (error: any) {
      throw error;
    }
  };

  return (
    <ServiceContext.Provider value={{ services, isLoading, addService, updateService, deleteService, refreshServices: fetchServices }}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = () => useContext(ServiceContext);
