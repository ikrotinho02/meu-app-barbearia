
import React, { useState } from 'react';
import { 
  Crown, 
  User, 
  Search, 
  ChevronRight, 
  CheckCircle, 
  ArrowLeft, 
  CreditCard, 
  Lock, 
  Calendar,
  QrCode,
  Fingerprint,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useClients } from '../contexts/ClientContext';
import { createAsaasCustomer, createAsaasSubscription } from '../services/asaas';
import { triggerSyncEdgeFunction } from '../services/AsaasService';
import { useSubscriptions } from '../contexts/SubscriptionContext';

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any | null;
  onConfirm: (data: any) => void;
}

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({ isOpen, onClose, plan, onConfirm }) => {
  const { clients, refreshClients } = useClients();
  const { registerSubscription } = useSubscriptions();
  
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Asaas Data
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSubscriptionId, setLastSubscriptionId] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleFinalize = async () => {
    if (!selectedClient || !plan || !cpfCnpj) {
        setError('Preencha todos os campos obrigatórios.');
        return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
        // 1. Criar ou Vincular Cliente no Asaas
        const asaasCustomerId = await createAsaasCustomer({
            name: selectedClient.name,
            email: selectedClient.email || `${selectedClient.phone}@burnapp.com.br`,
            cpfCnpj: cpfCnpj.replace(/\D/g, '')
        });

        // 2. Criar Assinatura no Asaas
        // Fix: Removed 'nextDueDate' and its redundant calculation as it is not specified in the function type and handled internally by the service
        const subResult = await createAsaasSubscription({
            customer: asaasCustomerId,
            value: plan.price,
            planName: plan.name
        });

        // 3. Salvar no Supabase e avançar para sincronização
        await registerSubscription({
            customerId: selectedClient.id,
            planId: plan.id,
            asaasId: subResult.id,
            amount: plan.price
        });

        setInvoiceUrl(subResult.invoiceUrl || `https://www.asaas.com/i/${subResult.id}`);
        setStep(3); // Avança para o passo de sincronização/pagamento
    } catch (err: any) {
        setError(err.message || 'Erro ao processar assinatura no Asaas.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    if (!selectedClient?.id) return;
    
    setIsSyncing(true);
    try {
        // Chama a Edge Function para verificar o pagamento
        const result = await triggerSyncEdgeFunction(selectedClient.id);
        
        if (result.status === 'active') {
            await refreshClients();
            onConfirm({ client: selectedClient, plan });
        } else {
            setError('Pagamento ainda não detectado. Se você já pagou, aguarde alguns instantes pela compensação do banco.');
        }
    } catch (err: any) {
        setError('Erro na sincronização: ' + err.message);
    } finally {
        setIsSyncing(false);
    }
  };

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-emerald-600 p-6 text-white text-center relative overflow-hidden">
           <div className="relative z-10 flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-md border border-white/30">
                 <Crown size={24} className="text-white" fill="currentColor" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Assinar {plan.name}</h2>
              <div className="mt-4 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 inline-flex items-center gap-2">
                 <span className="font-bold text-lg">R$ {plan.price.toFixed(2)}</span>
                 <span className="text-xs text-emerald-100 uppercase tracking-wide">/ mês</span>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
           {error && (
               <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                   <AlertCircle size={18} /> {error}
               </div>
           )}

           {step === 1 && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-slate-800 dark:text-white mb-2">
                   <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <User size={20} />
                   </div>
                   <h3 className="font-bold text-lg">Selecione o Cliente</h3>
                </div>

                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                   <input 
                     type="text" 
                     placeholder="Buscar por nome..." 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full p-4 pl-12 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all shadow-sm"
                     autoFocus
                   />
                </div>

                <div className="space-y-2 h-56 overflow-y-auto custom-scrollbar pr-2">
                   {filteredClients.map(client => (
                     <button 
                       key={client.id}
                       onClick={() => { setSelectedClient(client); setError(null); }}
                       className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${
                         selectedClient?.id === client.id 
                         ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500' 
                         : 'border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800'
                       }`}
                     >
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                             selectedClient?.id === client.id ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                           }`}>
                              {client.name[0]}
                           </div>
                           <div className="text-left">
                              <p className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-800 dark:text-zinc-200'}`}>
                                {client.name}
                              </p>
                              <p className="text-xs text-slate-500">{client.phone}</p>
                           </div>
                        </div>
                        {selectedClient?.id === client.id && <CheckCircle size={20} className="text-emerald-500" />}
                     </button>
                   ))}
                </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <button onClick={() => setStep(1)} className="text-sm font-medium text-slate-500 hover:text-emerald-600 flex items-center gap-1">
                   <ArrowLeft size={16} /> Voltar
                </button>

                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                   <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Dados do Faturamento</h4>
                   <p className="text-sm text-slate-800 dark:text-white font-bold">{selectedClient?.name}</p>
                   <p className="text-xs text-slate-500">{selectedClient?.email || 'Sem e-mail cadastrado'}</p>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">CPF ou CNPJ do Cliente</label>
                      <div className="relative">
                         <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                         <input 
                            type="text" 
                            className="w-full p-3 pl-10 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
                            placeholder="000.000.000-00"
                            value={cpfCnpj}
                            onChange={(e) => setCpfCnpj(e.target.value)}
                         />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">Necessário para gerar a cobrança oficial no Asaas.</p>
                   </div>
                   
                   <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                         <QrCode size={16} />
                         <span className="text-sm font-bold">Checkout Multi-Meios</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                         O cliente receberá um link para escolher entre **Cartão, Pix ou Boleto**. A assinatura será ativada automaticamente após a confirmação do primeiro pagamento.
                      </p>
                   </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-wider">
                   <Lock size={12} /> Pagamento Seguro via Asaas
                </div>
             </div>
           )}

           {step === 3 && (
             <div className="space-y-8 animate-in zoom-in-95 duration-500 py-4 text-center">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                   <CheckCircle size={48} />
                </div>
                
                <div>
                   <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Assinatura Gerada!</h3>
                   <p className="text-slate-500 text-sm">O link de pagamento foi criado com sucesso para <strong>{selectedClient?.name}</strong>.</p>
                </div>

                <div className="space-y-3">
                   <a 
                     href={invoiceUrl || '#'} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
                   >
                     Abrir Link de Pagamento <ExternalLink size={18} />
                   </a>
                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Enviado também para o e-mail do cliente</p>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-zinc-800">
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Já realizou o pagamento?</p>
                   <button 
                     onClick={handleManualSync}
                     disabled={isSyncing}
                     className="px-6 py-3 border border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                   >
                     {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                     Verificar Ativação Agora
                   </button>
                </div>
             </div>
           )}

        </div>

        <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-4">
           {step < 3 && (
             <button 
               onClick={onClose}
               className="flex-1 py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
             >
               Cancelar
             </button>
           )}
           
           {step === 1 && (
             <button 
               disabled={!selectedClient}
               onClick={() => setStep(2)}
               className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
             >
               Próximo Passo <ChevronRight size={18} />
             </button>
           )}
           
           {step === 2 && (
             <button 
               disabled={isSubmitting || !cpfCnpj}
               onClick={handleFinalize}
               className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
             >
               {isSubmitting ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
               ) : (
                   <><CheckCircle size={18} /> Gerar Assinatura</>
               )}
             </button>
           )}

           {step === 3 && (
              <button 
                onClick={onClose}
                className="w-full py-4 text-slate-500 font-bold hover:text-slate-800 transition-colors"
              >
                Fechar e acompanhar depois
              </button>
           )}
        </div>

      </div>
    </div>
  );
};
