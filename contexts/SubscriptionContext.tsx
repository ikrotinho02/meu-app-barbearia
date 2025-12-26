
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/dbClient';
import { SaaSMetrics, DelinquencyRecord } from '../types';
import { useAuth } from './AuthContext';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  validityDays: number;
  maxServices: number; // 9999 = unlimited
  bonuses: string[];
  includedServices: string[]; // IDs of services
  isHighlighted: boolean;
  isActive: boolean;
}

interface SubscriptionContextType {
  plans: SubscriptionPlan[];
  isLoading: boolean;
  saasMetrics: SaaSMetrics & { avgVisitsPerSubscriber: number } | null;
  delinquency: DelinquencyRecord[];
  addPlan: (plan: Omit<SubscriptionPlan, 'id'>) => Promise<void>;
  updatePlan: (id: string, updates: Partial<SubscriptionPlan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  refreshPlans: () => Promise<void>;
  fetchMetrics: () => Promise<void>;
  registerSubscription: (data: { customerId: string, planId: string, asaasId: string, amount: number }) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({} as SubscriptionContextType);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saasMetrics, setSaasMetrics] = useState<any>(null);
  const [delinquency, setDelinquency] = useState<DelinquencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;

      if (data) {
        const mappedPlans = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            validityDays: p.validity_days || 30,
            maxServices: p.max_services || 4,
            bonuses: p.bonuses || [],
            includedServices: p.included_services || [],
            isHighlighted: p.is_highlighted || false,
            isActive: p.is_active !== false
        }));
        setPlans(mappedPlans);
      }
    } catch (e: any) {
      console.error('Error loading plans:', e.message || e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetrics = useCallback(async () => {
    if (!user) return;
    
    try {
      const shopId = user.id;

      const { data: subs, error: subError } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(name, price)')
        .eq('client_id', shopId);

      if (subError) throw subError;

      const activeSubs = subs?.filter(s => s.status === 'active') || [];
      const mrr = activeSubs.reduce((acc, s) => acc + (s.amount || 0), 0);
      
      const next30d = new Date();
      next30d.setDate(next30d.getDate() + 30);
      const cashForecast = activeSubs
        .filter(s => new Date(s.next_renewal_at) <= next30d)
        .reduce((acc, s) => acc + (s.amount || 0), 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);

      const canceledCount = subs?.filter(s => s.status === 'canceled' && new Date(s.canceled_at) >= startOfMonth).length || 0;
      const initialCount = subs?.filter(s => s.status === 'active' && new Date(s.created_at) < startOfMonth).length || 0;
      const churnRate = initialCount > 0 ? (canceledCount / initialCount) * 100 : 0;

      const { data: appts } = await supabase
        .from('appointments')
        .select('id, customer_id, subscription_id')
        .eq('client_id', shopId)
        .eq('status', 'COMPLETED');

      const subscriberVisits = appts?.filter(a => a.subscription_id !== null).length || 0;
      const regularVisits = appts?.filter(a => a.subscription_id === null).length || 0;

      // Cálculo de média de vindas por assinante
      const avgVisitsPerSubscriber = activeSubs.length > 0 ? subscriberVisits / activeSubs.length : 0;

      const failedSubs = subs?.filter(s => s.last_payment_status === 'failed' || s.last_payment_status === 'past_due') || [];
      const delinqRecords: DelinquencyRecord[] = failedSubs.map(s => ({
        id: s.id,
        clientName: s.customer_name || 'Cliente',
        planName: s.subscription_plans?.name || 'Plano',
        lastAttempt: s.updated_at,
        amount: s.amount,
        status: s.last_payment_status
      }));

      setSaasMetrics({
        mrr,
        churnRate,
        cashForecast30d: cashForecast,
        activeCount: activeSubs.length,
        usageComparison: { subscriberVisits, regularVisits },
        delinquencyCount: delinqRecords.length,
        avgVisitsPerSubscriber: parseFloat(avgVisitsPerSubscriber.toFixed(1))
      });

      setDelinquency(delinqRecords);

    } catch (err: any) {
      console.error('Error fetching SaaS metrics:', err.message || err);
    }
  }, [user]);

  const registerSubscription = async (data: { customerId: string, planId: string, asaasId: string, amount: number }) => {
    if (!user) return;
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);

    const payload = {
        client_id: user.id,
        customer_id: data.customerId,
        plan_id: data.planId,
        asaas_id: data.asaasId,
        status: 'active',
        amount: data.amount,
        next_renewal_at: nextRenewal.toISOString(),
        last_payment_status: 'confirmed'
    };

    const { error } = await supabase.from('subscriptions').insert([payload]);
    if (error) throw error;
    fetchMetrics();
  };

  useEffect(() => {
    fetchPlans();
    if (user) fetchMetrics();
  }, [user, fetchMetrics]);

  const addPlan = async (planData: Omit<SubscriptionPlan, 'id'>) => {
    const tempId = crypto.randomUUID();
    setPlans(prev => [...prev, { ...planData, id: tempId }]);
    try {
        const payload = {
            name: planData.name,
            description: planData.description,
            price: planData.price,
            validity_days: planData.validityDays,
            max_services: planData.maxServices,
            bonuses: planData.bonuses,
            included_services: planData.includedServices,
            is_highlighted: planData.isHighlighted,
            is_active: planData.isActive
        };
        const { data, error } = await supabase.from('subscription_plans').insert([payload]).select().single();
        if (error) throw error;
        if (data) setPlans(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id } : p));
    } catch (e: any) {
        console.error('Error adding plan:', e.message || e);
        setPlans(prev => prev.filter(p => p.id !== tempId));
    }
  };

  const updatePlan = async (id: string, updates: Partial<SubscriptionPlan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        const { error } = await supabase.from('subscription_plans').update(payload).eq('id', id);
        if (error) throw error;
    } catch (e: any) { console.error('Error updating plan:', e.message || e); }
  };

  const deletePlan = async (id: string) => {
    const prev = [...plans];
    setPlans(prev => prev.filter(p => p.id !== id));
    try { 
        const { error } = await supabase.from('subscription_plans').delete().eq('id', id); 
        if (error) throw error;
    } catch (e: any) { 
        console.error('Error deleting plan:', e.message || e); 
        setPlans(prev);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      plans, 
      isLoading, 
      saasMetrics, 
      delinquency,
      addPlan, 
      updatePlan, 
      deletePlan, 
      refreshPlans: fetchPlans,
      fetchMetrics,
      registerSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptions = () => useContext(SubscriptionContext);
