
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/dbClient'; 
import { useAuth } from './AuthContext';
import { WorkSchedule, Goal, ServiceTransaction, Professional } from '../types';

export type ProfessionalStatus = 'ACTIVE' | 'VACATION';

interface ExtendedServiceTransaction extends ServiceTransaction {
  commissionPaid: boolean;
}

interface ProfessionalContextType {
  professionals: Professional[];
  transactions: ExtendedServiceTransaction[]; // Pendentes (Comissão não paga)
  allTransactions: ExtendedServiceTransaction[]; // Transações do período selecionado
  paidTransactions: ExtendedServiceTransaction[];
  goals: Goal[];
  addProfessional: (pro: Omit<Professional, 'id'>) => Promise<Professional | null>;
  updateProfessional: (id: string, data: Partial<Professional>) => Promise<void>;
  deleteProfessional: (id: string) => Promise<void>;
  addTransaction: (transaction: ServiceTransaction, feeAmount?: number) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<ExtendedServiceTransaction>) => Promise<void>;
  recalculateCommissions: (proId: string, rate: number) => Promise<void>;
  payCommission: (id: string, payoutId?: string) => Promise<void>;
  payMultipleCommissions: (ids: string[], payoutId: string) => Promise<void>;
  undoCommissionPayout: (payoutId: string) => Promise<void>;
  updateGoal: (type: Goal['type'], targetValue: number, professionalId?: string) => void;
  refreshTransactions: () => Promise<void>;
  fetchPaidHistory: () => Promise<void>;
  fetchTransactionsForPeriod: (month: number, year: number) => Promise<void>;
}

const ProfessionalContext = createContext<ProfessionalContextType>({} as ProfessionalContextType);

export const ProfessionalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [transactions, setTransactions] = useState<ExtendedServiceTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<ExtendedServiceTransaction[]>([]);
  const [paidTransactions, setPaidTransactions] = useState<ExtendedServiceTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([
      { id: 'g1', type: 'SHOP_REVENUE', targetValue: 30000, period: 'monthly' }
  ]);

  const mapTransaction = (t: any): ExtendedServiceTransaction => ({
    id: t.id,
    professionalId: t.professional_id,
    appointmentId: t.appointment_id,
    type: (t.type === 'Entrada' || t.transaction_type === 'Entrada' || t.type === 'SERVICE') ? 'SERVICE' : t.type,
    serviceName: t.service_name,
    clientName: t.customer_name,
    date: t.date,
    price: Number(t.price) || Number(t.amount) || Number(t.total_amount) || 0,
    commissionRateSnapshot: Number(t.commission_rate_snapshot) || 0,
    commissionAmountSnapshot: Number(t.commission_amount_snapshot) || 0,
    status: t.status,
    category: t.category,
    metadata: t.metadata,
    commissionPaid: !!t.commission_paid
  });

  const fetchTransactionsForPeriod = useCallback(async (month: number, year: number) => {
    if (!user || role === 'client') return;
    try {
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('service_transactions')
        .select('*')
        .eq('client_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      setAllTransactions((data || []).map(mapTransaction));
    } catch (e) {
      console.error('Error fetching period transactions:', e);
    }
  }, [user, role]);

  const fetchTransactions = useCallback(async () => {
    if (!user || role === 'client') return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 1. Transações Pendentes (Para o fluxo de pagamento de comissão)
      const { data: pendingData } = await supabase
        .from('service_transactions')
        .select('*')
        .eq('client_id', user.id)
        .eq('commission_paid', false) 
        .order('date', { ascending: false });

      setTransactions((pendingData || []).map(mapTransaction));
      
      // Carrega o mês atual por padrão em allTransactions
      await fetchTransactionsForPeriod(now.getMonth(), now.getFullYear());
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  }, [user, role, fetchTransactionsForPeriod]);

  const fetchPaidHistory = useCallback(async () => {
    if (!user || role === 'client') return;
    try {
      const { data, error } = await supabase
        .from('service_transactions')
        .select('*')
        .eq('client_id', user.id)
        .eq('commission_paid', true)
        .order('date', { ascending: false })
        .limit(200);

      if (error) throw error;
      setPaidTransactions((data || []).map(mapTransaction));
    } catch (e) {
      console.error('Error fetching paid history:', e);
    }
  }, [user, role]);

  useEffect(() => {
    if (!user) {
      setProfessionals([]);
      setTransactions([]);
      setAllTransactions([]);
      setPaidTransactions([]);
      return;
    }

    const fetchData = async () => {
      try {
        let ownerId = user.id;
        const { data: proData } = await supabase.from('professionals').select('*').eq('client_id', ownerId);
        if (proData) {
          setProfessionals(proData.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            avatarUrl: p.avatar_url,
            commissionRate: Number(p.commission_rate) || 0,
            status: p.status as 'ACTIVE' | 'VACATION',
            specialties: Array.isArray(p.specialties) ? p.specialties : [],
            workSchedule: p.metadata?.workSchedule || { start: "09:00", end: "20:00", lunchStart: "12:00", lunchEnd: "13:00" }
          })));
        }
        await fetchTransactions();
      } catch (err) {
        console.error('Unexpected error fetching professional data:', err);
      }
    };
    fetchData();
  }, [user, role, fetchTransactions]);

  const addProfessional = async (proData: Omit<Professional, 'id'>): Promise<Professional | null> => {
    if (!user) throw new Error("Não autenticado.");
    const tempId = crypto.randomUUID();
    try {
      const dbPayload = {
        id: tempId,
        client_id: user.id, 
        name: proData.name,
        role: proData.role,
        avatar_url: proData.avatarUrl || null,
        commission_rate: Number(proData.commissionRate) || 0,
        status: proData.status,
        specialties: proData.specialties || [],
        metadata: { workSchedule: proData.workSchedule }
      };
      const { data, error } = await supabase.from('professionals').insert([dbPayload]).select().single();
      if (error) throw error;
      const mapped = {
          id: data.id,
          name: data.name,
          role: data.role,
          avatarUrl: data.avatar_url,
          commissionRate: Number(data.commission_rate) || 0,
          status: data.status as 'ACTIVE' | 'VACATION',
          specialties: data.specialties,
          workSchedule: data.metadata?.workSchedule
      };
      setProfessionals(prev => [...prev, mapped]);
      return mapped;
    } catch (error: any) {
      throw error;
    }
  };

  const updateProfessional = async (id: string, updates: Partial<Professional>) => {
    setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.role) dbUpdates.role = updates.role;
      if (updates.commissionRate !== undefined) dbUpdates.commission_rate = Number(updates.commissionRate) || 0;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      if (updates.workSchedule) dbUpdates.metadata = { workSchedule: updates.workSchedule };
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.specialties) dbUpdates.specialties = updates.specialties;
      const { error } = await supabase.from('professionals').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (error: any) { throw error; }
  };

  const deleteProfessional = async (id: string) => {
    setProfessionals(prev => prev.filter(p => p.id !== id));
    try { await supabase.from('professionals').delete().eq('id', id); } catch(e) { throw e; }
  };

  const addTransaction = async (transaction: ServiceTransaction, feeAmount: number = 0) => {
    if (!user) return;
    try {
        const val = Number(transaction.price) || 0;
        const payload = {
            id: transaction.id,
            client_id: user.id,
            professional_id: transaction.professionalId,
            appointment_id: transaction.appointmentId || null,
            type: (transaction.type === 'SERVICE') ? 'Entrada' : transaction.type,
            transaction_type: (transaction.type === 'SERVICE') ? 'Entrada' : transaction.type,
            service_name: transaction.serviceName,
            customer_name: transaction.clientName,
            date: transaction.date,
            price: val,
            amount: val,
            total_amount: val,
            commission_rate_snapshot: Number(transaction.commissionRateSnapshot) || 0,
            commission_amount_snapshot: Number(transaction.commissionAmountSnapshot) || 0,
            status: transaction.status,
            category: transaction.category || null,
            fee_amount: Number(feeAmount) || 0,
            metadata: transaction.metadata || {},
            commission_paid: false
        };
        const { error } = await supabase.from('service_transactions').insert([payload]);
        if (error) throw error;
        await fetchTransactions();
    } catch (e) {
        console.error('Error saving transaction:', e);
        throw e;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<ExtendedServiceTransaction>) => {
    try {
        const dbUpdates: any = {};
        if (updates.commissionRateSnapshot !== undefined) dbUpdates.commission_rate_snapshot = Number(updates.commissionRateSnapshot) || 0;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.metadata) dbUpdates.metadata = updates.metadata;
        if (updates.commissionPaid !== undefined) dbUpdates.commission_paid = updates.commissionPaid;
        const { error } = await supabase.from('service_transactions').update(dbUpdates).eq('id', id);
        if (error) throw error;
        await fetchTransactions();
    } catch(e) { console.error('Error updating transaction:', e); }
  };

  const recalculateCommissions = async (proId: string, rate: number) => {
    const affected = transactions.filter(t => t.professionalId === proId && !t.commissionPaid);
    for (const t of affected) { await updateTransaction(t.id, { commissionRateSnapshot: rate }); }
  };

  const payCommission = async (id: string, payoutId?: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const newMetadata = { ...(tx.metadata || {}), payoutId };
    await updateTransaction(id, { status: 'PAID', commissionPaid: true, metadata: newMetadata });
    await fetchTransactions();
    await fetchPaidHistory();
  };

  const payMultipleCommissions = async (ids: string[], payoutId: string) => {
      if (!user || ids.length === 0) return;
      try {
          await supabase.from('service_transactions')
            .update({ status: 'PAID', commission_paid: true, metadata: { payoutId } })
            .in('id', ids);
          await fetchTransactions();
          await fetchPaidHistory();
      } catch (e) { console.error('Error paying multiple:', e); throw e; }
  };

  const undoCommissionPayout = async (payoutId: string) => {
    if (!user) return;
    try {
        const { error } = await supabase
            .from('service_transactions')
            .update({ 
                status: 'PENDING', 
                commission_paid: false 
            })
            .eq('client_id', user.id)
            .filter('metadata->>payoutId', 'eq', payoutId);
        
        if (error) throw error;
        
        await fetchTransactions();
        await fetchPaidHistory();
    } catch (e) { console.error('Error undoing payout:', e); throw e; }
  };

  const updateGoal = (type: Goal['type'], targetValue: number, professionalId?: string) => {
    setGoals(prev => {
        const filtered = prev.filter(g => {
            if (professionalId) return !(g.type === type && g.professionalId === professionalId);
            return g.type !== type;
        });
        return [...filtered, { id: crypto.randomUUID(), type, targetValue: Number(targetValue) || 0, professionalId, period: 'monthly' }];
    });
  };

  return (
    <ProfessionalContext.Provider value={{
      professionals, transactions, allTransactions, paidTransactions, goals, addProfessional, updateProfessional, deleteProfessional,
      addTransaction, updateTransaction, recalculateCommissions, payCommission, payMultipleCommissions, 
      undoCommissionPayout, updateGoal, refreshTransactions: fetchTransactions, fetchPaidHistory, fetchTransactionsForPeriod
    }}>
      {children}
    </ProfessionalContext.Provider>
  );
};

export const useProfessionals = () => {
  const context = useContext(ProfessionalContext);
  if (!context) throw new Error('useProfessionals must be used within a ProfessionalProvider');
  return context;
};
