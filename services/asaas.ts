
/**
 * Nota: Chamadas diretas para a API do Asaas a partir do navegador podem falhar devido ao CORS.
 * Em produção, estas chamadas devem ser feitas via Supabase Edge Functions.
 */

const ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3'; // Usando sandbox para testes
const ASAAS_API_KEY = '$a3p$0123456789...'; 

export const createAsaasCustomer = async (data: { 
  name: string, 
  email: string, 
  cpfCnpj: string, 
  phone?: string,
  postalCode?: string 
}) => {
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: data.phone?.replace(/\D/g, ''),
      postalCode: data.postalCode?.replace(/\D/g, ''),
      notificationDisabled: false
    })
  });

  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].description);
  return result; // Retorna o objeto completo do cliente
};

export const createAsaasSubscription = async (data: { 
  customer: string, 
  value: number, 
  planName: string 
}) => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    },
    body: JSON.stringify({
      customer: data.customer,
      billingType: 'UNDEFINED', // Deixa o cliente escolher no checkout do Asaas
      value: data.value,
      nextDueDate: nextMonth.toISOString().split('T')[0],
      cycle: 'MONTHLY',
      description: `Assinatura Burn App: ${data.planName}`,
      updatePendingPayments: true
    })
  });

  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].description);
  return result;
};

export const getAsaasPaymentData = async (subscriptionId: string) => {
    // Busca a cobrança atual da assinatura para obter dados de Pix/QR Code
    const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments`, {
        method: 'GET',
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const payments = await response.json();
    const latestPayment = payments.data?.[0];

    if (latestPayment) {
        const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${latestPayment.id}/pixQrCode`, {
            method: 'GET',
            headers: { 'access_token': ASAAS_API_KEY }
        });
        return await pixResponse.json();
    }
    return null;
};
