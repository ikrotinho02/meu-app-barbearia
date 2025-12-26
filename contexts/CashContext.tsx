
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/dbClient';
import { CashTransaction, DailyCash, PaymentMethodType } from '../types';
import { useAuth } from './AuthContext';

interface CashContextType {
  dailyCash: DailyCash;
  openCash: (initialAmount: number, responsibleName: string, observation: string) => Promise<void>;
  closeCash: (physicalCash: number) => Promise<void>;
  addTransaction: (
    amount: number, 
    method: PaymentMethodType, 
    description: string, 
    type: 'IN' | 'OUT', 
    professionalId?: string, 
    feeAmount?: number,
    category?: string,
    date?: string,
    status?: 'PAID' | 'PENDING',
    customerName?: string,
    appointmentId?: string
  ) => Promise<string | null>;
  deleteTransactionByDetails: (description: string, amount: number, date?: string) => Promise<void>;
  deleteTransactionByAppointmentId: (appointmentId: string) => Promise<void>;
  deleteTransactionById: (id: string) => Promise<void>;
  refreshCashStatus: () => Promise<void>;
  isCashOpen: boolean;
  isLoading: boolean;
  activeSessionId: string | null;
  summary: {
    totalIn: number;
    totalOut: number;
    currentBalance: number;
    byMethod: Record<string, number>;
    cashInHand: number; 
  };
}

const INITIAL_CASH: DailyCash = {
  isOpen: false,
  openedAt: null,
  closedAt: null,
  openingBalance: 0,
  closingBalance: null,
  transactions: []
};

const CashContext = createContext<CashContextType>({} as CashContextType);

export const CashProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [dailyCash, setDailyCash] = useState<DailyCash>(INITIAL_CASH);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadCashState = useCallback(async () => {
    if (!user) {
      setDailyCash(INITIAL_CASH);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (sessionData) {
        const { data: transData } = await supabase
          .from('transactions')
          .select('*')
          .eq('client_id', user.id)
          .eq('status', 'PAID')
          .gte('date', sessionData.opened_at)
          .order('date', { ascending: false });

        const mappedTransactions: CashTransaction[] = (transData || []).map(t => ({
          id: t.id,
          timestamp: t.date,
          amount: Math.abs(Number(t.price) || Number(t.amount) || Number(t.total_amount) || 0),
          method: t.payment_method,
          description: t.description,
          type: (t.type === 'INCOME' || t.transaction_type === 'INCOME' || t.amount >= 0 || t.price >= 0) ? 'IN' : 'OUT',
          feeAmount: Number(t.fee_amount) || 0,
          appointmentId: t.appointment_id
        }));

        setDailyCash({
          isOpen: true,
          openedAt: sessionData.opened_at,
          closedAt: null,
          openingBalance: sessionData.opening_balance,
          closingBalance: null,
          transactions: mappedTransactions,
          responsibleName: sessionData.responsible_name,
          observations: sessionData.observations
        });
        setActiveSessionId(sessionData.id);
      } else {
        setDailyCash(INITIAL_CASH);
        setActiveSessionId(null);
      }
    } catch (e) {
      console.error('❌ [CashContext] Erro ao sincronizar caixa:', e);
      setDailyCash(INITIAL_CASH);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCashState();
  }, [loadCashState]);

  const summary = useMemo(() => {
    const transactions = dailyCash.transactions || [];
    const totalIn = transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.amount, 0);
    const byMethod: Record<string, number> = {};
    
    transactions.forEach(t => {
      const val = t.type === 'IN' ? t.amount : -t.amount;
      byMethod[t.method] = (byMethod[t.method] || 0) + val;
    });

    return {
      totalIn,
      totalOut,
      currentBalance: (dailyCash.openingBalance || 0) + totalIn - totalOut,
      byMethod,
      cashInHand: (dailyCash.openingBalance || 0) + (byMethod['cash'] || 0)
    };
  }, [dailyCash]);

  const openCash = async (initialAmount: number, resName: string, obs: string) => {
    if (!user) return;
    try {
      const openedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert([{
          client_id: user.id,
          opened_at: openedAt,
          opening_balance: initialAmount,
          responsible_name: resName,
          observations: obs,
          status: 'open'
        }])
        .select()
        .single();
      if (error) throw error;
      setDailyCash({ 
          isOpen: true, 
          openedAt, 
          openingBalance: initialAmount, 
          responsibleName: resName, 
          observations: obs,
          transactions: [],
          closedAt: null,
          closingBalance: null
      });
      setActiveSessionId(data.id);
    } catch (err) {
      alert("Erro ao abrir caixa: " + stringifyError(err));
    }
  };

  const closeCash = async (physical: number) => {
    if (!user || !activeSessionId) return;
    try {
      const closedAt = new Date().toISOString();
      const { error } = await supabase
        .from('cash_sessions')
        .update({ status: 'closed', closed_at: closedAt, closing_balance: physical })
        .eq('id', activeSessionId);
      if (error) throw error;
      setDailyCash(INITIAL_CASH);
      setActiveSessionId(null);
    } catch (err) {
      alert("Erro ao fechar caixa: " + stringifyError(err));
    }
  };

  const addTransaction = async (
    amountValue: number, 
    method: PaymentMethodType, 
    desc: string, 
    type: 'IN' | 'OUT', 
    proId?: string, 
    fee: number = 0, 
    cat: string = 'OTHER',
    date?: string,
    status: 'PAID' | 'PENDING' = 'PAID',
    customerName?: string,
    appointmentId?: string
  ): Promise<string | null> => {
    if (!dailyCash.isOpen && method !== 'discount') {
        alert('O caixa está fechado.');
        return null;
    }
    
    const finalDate = date || new Date().toISOString();
    const rawVal = Number(amountValue) || 0;
    const transactionValue = type === 'IN' ? rawVal : -rawVal;
    const finalType = type === 'IN' ? 'INCOME' : 'EXPENSE';
    
    if (user) {
      try {
        const payload: any = { 
            client_id: user.id, 
            appointment_id: appointmentId || null,
            description: desc, 
            amount: transactionValue, 
            price: transactionValue,
            total_amount: transactionValue,
            fee_amount: Number(fee) || 0, 
            type: finalType,
            transaction_type: finalType,
            category: cat, 
            payment_method: method, 
            status: status, 
            customer_name: customerName || 'Cliente Avulso', 
            date: finalDate
        };

        // CORREÇÃO: Somente envia professional_id se houver um valor definido.
        // Se for uma despesa fixa sem profissional, enviamos null ou omitimos a chave.
        if (proId && proId.trim() !== '') {
            payload.professional_id = proId;
        } else {
            payload.professional_id = null;
        }

        const { data: insertData, error: insertError } = await supabase
            .from('transactions')
            .insert([payload])
            .select()
            .single();

        if (insertError) {
            // Tratamento de erro de constraint amigável
            if (insertError.code === '23502') {
                alert("Erro: Esta despesa precisa de um profissional vinculado ou o banco precisa ser ajustado para aceitar despesas gerais (professional_id não pode ser nulo).");
            }
            throw insertError;
        }

        if (status === 'PAID') {
            const newTx: CashTransaction = { 
                id: insertData.id, 
                timestamp: finalDate, 
                amount: rawVal, 
                method, 
                description: desc, 
                type, 
                feeAmount: Number(fee) || 0,
                appointmentId
            };
            setDailyCash(prev => ({ ...prev, transactions: [newTx, ...(prev.transactions || [])] }));
        }
        return insertData.id;
      } catch (err) {
        console.error("❌ Erro na transação (tabela transactions):", err);
        return null;
      }
    }
    return null;
  };

  const deleteTransactionById = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('client_id', user.id);
      if (error) throw error;
      setDailyCash(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id)
      }));
    } catch (e) {
      console.error('Error deleting transaction by id:', e);
    }
  };

  const deleteTransactionByDetails = async (description: string, amount: number) => {
      if (!user) return;
      try {
          const val = Number(amount) || 0;
          const { error } = await supabase.from('transactions')
              .delete()
              .eq('client_id', user.id)
              .eq('description', description)
              .or(`price.eq.${val},price.eq.${-val},amount.eq.${val},amount.eq.${-val},total_amount.eq.${val}`);
          if (error) throw error;
          setDailyCash(prev => ({
              ...prev,
              transactions: prev.transactions.filter(t => !(t.description === description && (t.amount === val || t.amount === -val)))
          }));
      } catch (e) {
          console.error('Error deleting transaction by details:', e);
      }
  };

  const deleteTransactionByAppointmentId = async (appointmentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('client_id', user.id)
        .eq('appointment_id', appointmentId);
      if (error) throw error;
      setDailyCash(prev => ({
        ...prev,
        transactions: (prev.transactions || []).filter(t => t.appointmentId !== appointmentId)
      }));
    } catch (e) {
      console.error('Error deleting transaction by appt id:', e);
    }
  };

  const refreshCashStatus = useCallback(async () => {
    await loadCashState();
  }, [loadCashState]);

  return (
    <CashContext.Provider value={{
      dailyCash,
      openCash,
      closeCash,
      addTransaction,
      deleteTransactionByDetails,
      deleteTransactionByAppointmentId,
      deleteTransactionById,
      refreshCashStatus,
      isCashOpen: dailyCash.isOpen,
      isLoading,
      activeSessionId,
      summary
    }}>
      {children}
    </CashContext.Provider>
  );
};

export const useCash = () => {
  const context = useContext(CashContext);
  if (!context) throw new Error('useCash must be used within a CashProvider');
  return context;
};
