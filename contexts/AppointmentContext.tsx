
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/dbClient';
import { Appointment } from '../types';
import { useAuth } from './AuthContext';

interface AppointmentContextType {
  appointments: Appointment[];
  isLoading: boolean;
  fetchAppointments: (date: Date) => Promise<Appointment[]>;
  fetchFinancialAppointments: (startDate: string, endDate: string) => Promise<{ open: Appointment[], closed: Appointment[] }>;
  fetchClientAppointments: (clientId: string) => Promise<Appointment[]>; 
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  reopenAppointment: (id: string) => Promise<void>;
}

const AppointmentContext = createContext<AppointmentContextType>({} as AppointmentContextType);

export const AppointmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastDateRef = useRef<Date>(new Date());

  const stringifyError = (err: any) => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (err.message && typeof err.message === 'string') return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const isUUID = (str: string | undefined | null) => {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  };

  const mapAppointment = (d: any): Appointment => {
      const metadataItem = d.items?.find((i: any) => i.type === 'metadata');
      const realBarberId = metadataItem ? metadataItem.realBarberId : d.professional_id;
      const cleanItems = d.items?.filter((i: any) => i.type !== 'metadata') || [];

      return {
        id: d.id,
        barberId: realBarberId, 
        clientId: d.customer_id,
        clientName: d.client_name,
        startTime: d.start_time,
        durationMinutes: d.duration_minutes,
        status: d.status,
        totalValue: d.total_value,
        items: cleanItems, 
        notes: d.notes
      };
  };

  const fetchAppointments = useCallback(async (date: Date): Promise<Appointment[]> => {
    if (!user) return []; 
    lastDateRef.current = date;
    
    setIsLoading(true);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      let ownerId = user.id;

      if (user.user_metadata?.role === 'client') {
          const phone = user.email?.split('@')[0];
          let linkedShopId = null;
          if (phone) {
              const { data: customer } = await supabase.from('customers').select('client_id').eq('phone', phone).maybeSingle();
              if (customer && customer.client_id) linkedShopId = customer.client_id;
          }
          ownerId = linkedShopId || (await supabase.from('clients').select('id').limit(1)).data?.[0]?.id || user.id;
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', ownerId) 
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      if (error) throw error;
      const mapped = data ? data.map(mapAppointment) : [];
      setAppointments(mapped);
      return mapped;
    } catch (err: any) {
      console.error('Error fetching appointments:', stringifyError(err));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('appointments_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        fetchAppointments(lastDateRef.current);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAppointments]);

  const addAppointment = async (apptData: Omit<Appointment, 'id'>) => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) throw new Error('Usuário não autenticado.');
    
    if (!apptData.barberId || !isUUID(apptData.barberId)) {
        throw new Error('Identificador de profissional inválido. Por favor, tente selecionar o profissional novamente.');
    }

    let ownerId = currentUser.id;
    let customerId = apptData.clientId;

    if (currentUser.user_metadata?.role === 'client') {
        const phone = currentUser.email?.split('@')[0];
        const { data: customer } = await supabase.from('customers').select('client_id').eq('phone', phone).maybeSingle();
        ownerId = customer?.client_id || (await supabase.from('clients').select('id').limit(1)).data?.[0]?.id || currentUser.id;
        customerId = currentUser.id;
    }

    try {
      const startDate = new Date(apptData.startTime);
      const endDate = new Date(startDate.getTime() + apptData.durationMinutes * 60000);
      
      const itemsWithMetadata = [
        ...(apptData.items || []),
        { type: 'metadata', realBarberId: apptData.barberId, name: '_meta', price: 0 }
      ];

      const dbPayload = {
        client_id: ownerId, 
        professional_id: apptData.barberId, 
        customer_id: (customerId === 'timeoff' || !customerId) ? null : customerId,
        client_name: apptData.clientName,
        start_time: apptData.startTime,
        end_time: endDate.toISOString(),
        duration_minutes: apptData.durationMinutes,
        status: apptData.status,
        total_value: apptData.totalValue,
        items: itemsWithMetadata, 
        notes: apptData.notes || ''
      };

      const { error } = await supabase.from('appointments').insert([dbPayload]);
      if (error) throw error;
      
      await fetchAppointments(lastDateRef.current);

    } catch (error: any) {
      const msg = stringifyError(error);
      console.error('Error adding appointment:', msg);
      throw new Error(msg);
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    try {
      const dbUpdates: any = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.totalValue !== undefined) dbUpdates.total_value = updates.totalValue;
      
      const currentAppt = appointments.find(a => a.id === id);
      
      // Handle professional change (crucial for Drag & Drop between columns)
      if (updates.barberId) {
          dbUpdates.professional_id = updates.barberId;
          // Se houver items, precisamos atualizar o realBarberId no metadado
          const existingItems = updates.items || currentAppt?.items || [];
          const cleanItems = existingItems.filter((i: any) => i.type !== 'metadata');
          dbUpdates.items = [
              ...cleanItems,
              { type: 'metadata', realBarberId: updates.barberId, name: '_meta', price: 0 }
          ];
      } else if (updates.items) {
          dbUpdates.items = updates.items;
      }

      // Handle time changes
      if (updates.startTime) {
          dbUpdates.start_time = updates.startTime;
          const dur = updates.durationMinutes || currentAppt?.durationMinutes || 30;
          const start = new Date(updates.startTime);
          const end = new Date(start.getTime() + dur * 60000);
          dbUpdates.end_time = end.toISOString();
      }
      
      const { error } = await supabase.from('appointments').update(dbUpdates).eq('id', id);
      if (error) throw error;

      await fetchAppointments(lastDateRef.current);
    } catch (error: any) { 
        console.error('Error updating appointment:', stringifyError(error)); 
        throw new Error(stringifyError(error));
    }
  };

  const reopenAppointment = async (id: string) => {
      try { 
          const { error } = await supabase.from('appointments').update({ status: 'CONFIRMED' }).eq('id', id); 
          if (error) throw error;
          await fetchAppointments(lastDateRef.current);
      } catch (e: any) { console.error('Error reopening:', stringifyError(e)); throw new Error(stringifyError(e)); }
  };

  const cancelAppointment = async (id: string) => {
    try { 
        const { error } = await supabase.from('appointments').delete().eq('id', id); 
        if (error) throw error;
        await fetchAppointments(lastDateRef.current);
    } catch (error: any) { console.error('Error canceling:', stringifyError(error)); throw new Error(stringifyError(error)); }
  };

  const fetchFinancialAppointments = async (startDate: string, endDate: string) => {
      if (!user) return { open: [], closed: [] };
      try {
          const { data: openData } = await supabase.from('appointments').select('*').eq('client_id', user.id).in('status', ['SCHEDULED', 'CONFIRMED']).gte('start_time', startDate).lte('start_time', endDate).order('start_time', { ascending: true });
          const { data: closedData } = await supabase.from('appointments').select('*').eq('client_id', user.id).eq('status', 'COMPLETED').gte('start_time', startDate).lte('start_time', endDate).order('start_time', { ascending: false });
          return { open: openData ? openData.map(mapAppointment) : [], closed: closedData ? closedData.map(mapAppointment) : [] };
      } catch (err: any) {
          console.error('Error fetching financial appts:', stringifyError(err));
          return { open: [], closed: [] };
      }
  };

  const fetchClientAppointments = async (clientId: string) => {
      try {
          const { data } = await supabase.from('appointments').select('*').eq('customer_id', clientId).order('start_time', { ascending: false });
          return data ? data.map(mapAppointment) : [];
      } catch (e) { return []; }
  };

  return (
    <AppointmentContext.Provider value={{ 
      appointments, isLoading, fetchAppointments, fetchFinancialAppointments, fetchClientAppointments, addAppointment, updateAppointment, reopenAppointment, cancelAppointment 
    }}>
      {children}
    </AppointmentContext.Provider>
  );
};

export const useAppointments = () => useContext(AppointmentContext);
