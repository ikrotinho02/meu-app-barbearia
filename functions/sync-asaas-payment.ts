
/**
 * SUPABASE EDGE FUNCTION: sync-asaas-payment
 * Este código deve ser implantado no Supabase via CLI:
 * supabase functions deploy sync-asaas-payment
 */

/* Fix: Declare Deno global for environments where Deno types are not automatically loaded */
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3' // Use sandbox para testes
/* Fix: Using Deno.env to access environment variables in Supabase Edge Functions */
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') // Configurado no Supabase Dashboard

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subscription_id } = await req.json()

    // 1. Inicializa cliente Supabase com a role Service Role (para bypass de RLS se necessário)
    const supabaseClient = createClient(
      /* Fix: Using Deno.env for Supabase configuration variables */
      Deno.env.get('SUPABASE_URL') ?? '',
      /* Fix: Using Deno.env for Supabase configuration variables */
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Busca o asaas_id no nosso banco
    const { data: subData, error: fetchError } = await supabaseClient
      .from('subscriptions')
      .select('asaas_id, customer_id')
      .eq('id', subscription_id)
      .single()

    if (fetchError || !subData?.asaas_id) {
      throw new Error('Assinatura não encontrada ou sem ID do Asaas.')
    }

    // 3. Consulta pagamentos da assinatura no Asaas
    const asaasResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${subData.asaas_id}/payments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY || ''
      }
    })

    const payments = await asaasResponse.json()
    
    // 4. Verifica se existe algum pagamento recebido ou confirmado
    const hasPaid = payments.data?.some((p: any) => 
      p.status === 'RECEIVED' || p.status === 'CONFIRMED'
    )

    if (hasPaid) {
      // 5. Atualiza Subscriptions para 'active'
      await supabaseClient
        .from('subscriptions')
        .update({ 
          status: 'active', 
          last_payment_status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription_id)

      // 6. Atualiza o Cliente (Customers) para 'ACTIVE'
      await supabaseClient
        .from('customers')
        .update({ subscription_status: 'ACTIVE' })
        .eq('id', subData.customer_id)

      return new Response(JSON.stringify({ status: 'active', message: 'Pagamento confirmado e conta ativada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ status: 'pending', message: 'Nenhum pagamento confirmado até o momento.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
