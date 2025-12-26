
import { supabase } from './dbClient';

const ASAAS_API_URL = 'https://www.asaas.com/api/v3';
const ASAAS_API_KEY = '$a3p$0123456789...'; 

/**
 * Interface simplificada para o retorno de assinatura do Asaas
 */
interface AsaasSubscriptionResponse {
  id: string;
  status: 'ACTIVE' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'EXPIRED' | 'CANCELED';
  value: number;
  nextDueDate: string;
  cycle: string;
}

/**
 * Dispara a chamada para a Edge Function de sincronização
 * @param subscriptionId ID interno da nossa tabela 'subscriptions'
 */
export const triggerSyncEdgeFunction = async (subscriptionId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('sync-asaas-payment', {
      body: { subscription_id: subscriptionId }
    });

    if (error) throw error;
    return data; // { status: 'active' | 'pending', message: string }
  } catch (err: any) {
    console.error('Erro ao chamar Edge Function:', err);
    throw err;
  }
};

/**
 * Consulta o status atual no Asaas e sincroniza com o banco local
 * @param asaasSubscriptionId ID da assinatura no Asaas (começa com sub_)
 */
export const syncSubscriptionStatus = async (asaasSubscriptionId: string) => {
  try {
    const response = await fetch(`${ASAAS_API_URL}/subscriptions/${asaasSubscriptionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro Asaas API: ${errorData.errors?.[0]?.description || 'Erro desconhecido'}`);
    }

    const asaasData: AsaasSubscriptionResponse = await response.json();

    const isActiveStatus = ['ACTIVE', 'RECEIVED', 'CONFIRMED'].includes(asaasData.status);

    if (isActiveStatus) {
      const nextRenewal = new Date();
      nextRenewal.setDate(nextRenewal.getDate() + 30);

      const { error: dbError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          next_renewal_at: nextRenewal.toISOString(),
          last_payment_status: asaasData.status.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('asaas_id', asaasSubscriptionId);

      if (dbError) throw dbError;

      return { success: true, status: 'active', nextRenewal };
    } else {
      const newLocalStatus = asaasData.status === 'OVERDUE' ? 'past_due' : 'canceled';
      
      const { error: dbError } = await supabase
        .from('subscriptions')
        .update({
          status: newLocalStatus,
          last_payment_status: asaasData.status.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('asaas_id', asaasSubscriptionId);

      if (dbError) throw dbError;

      return { success: true, status: newLocalStatus };
    }

  } catch (error: any) {
    console.error(`[AsaasSyncError] Falha ao sincronizar assinatura ${asaasSubscriptionId}:`, error.message);
    return { success: false, error: error.message };
  }
};
