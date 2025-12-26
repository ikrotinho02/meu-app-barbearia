
import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Copy, 
  Check, 
  CheckCircle,
  QrCode, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  Flame
} from 'lucide-react';
import { createAsaasCustomer, createAsaasSubscription, getAsaasPaymentData } from '../services/asaas';
import { supabase } from '../services/dbClient';
import { useAuth } from '../contexts/AuthContext';

// --- MASK HELPERS ---
const maskCpfCnpj = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
        v = v.replace(/(\={11}).*/, "$1");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.replace(/(\d{2})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1/$2");
        v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    return v;
};

const maskCep = (v: string) => {
    return v.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9);
};

interface OwnerSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: { id: string, name: string, price: number };
}

export const OwnerSubscriptionModal: React.FC<OwnerSubscriptionModalProps> = ({ isOpen, onClose, plan }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.name || '',
    email: user?.email || '',
    cpfCnpj: '',
    phone: '',
    cep: ''
  });

  // Payment Result
  const [paymentData, setPaymentData] = useState<any>(null);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Criar Cliente Asaas
      const customer = await createAsaasCustomer({
        name: formData.name,
        email: formData.email,
        cpfCnpj: formData.cpfCnpj,
        phone: formData.phone,
        postalCode: formData.cep
      });

      // 2. Criar Assinatura
      const subscription = await createAsaasSubscription({
        customer: customer.id,
        value: plan.price,
        planName: plan.name
      });

      // 3. Salvar IDs no Supabase (Metadata do lojista)
      await supabase.from('clients').update({
          metadata: {
              ...(user.metadata || {}),
              asaas_customer_id: customer.id,
              asaas_subscription_id: subscription.id,
              app_plan_status: 'PENDING'
          }
      }).eq('id', user.id);

      // 4. Buscar dados de pagamento (Pix)
      const pix = await getAsaasPaymentData(subscription.id);
      
      setPaymentData({
        invoiceUrl: subscription.invoiceUrl,
        pixCode: pix?.payload,
        pixImage: pix?.encodedImage
      });

      setStep('payment');
    } catch (err: any) {
      setError(err.message || 'Erro ao processar assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Header Visual */}
        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Flame size={120} /></div>
           <div className="relative z-10">
              <span className="bg-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/20">Upgrade do Sistema</span>
              <h2 className="text-3xl font-heading font-extrabold mt-3">Plano {plan.name}</h2>
              <p className="text-indigo-100 mt-1 opacity-80">Acesso ilimitado e recursos exclusivos para sua barbearia.</p>
           </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
           {error && (
               <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
                   <AlertCircle size={20} /> {error}
               </div>
           )}

           {step === 'form' ? (
             <form onSubmit={handleCreateSubscription} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo / Razão Social</label>
                        <input 
                            required 
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">CPF ou CNPJ</label>
                        <input 
                            required 
                            placeholder="000.000.000-00"
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                            value={formData.cpfCnpj}
                            onChange={e => setFormData({...formData, cpfCnpj: maskCpfCnpj(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Telefone Celular</label>
                        <input 
                            required 
                            placeholder="(00) 00000-0000"
                            className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-2 flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail de Faturamento</label>
                            <input 
                                required 
                                type="email"
                                className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="w-40">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">CEP</label>
                            <input 
                                required 
                                placeholder="00000-000"
                                className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={formData.cep}
                                onChange={e => setFormData({...formData, cep: maskCep(e.target.value)})}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6">
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><ShieldCheck /> Confirmar Assinatura</>}
                    </button>
                    <button type="button" onClick={onClose} className="w-full mt-4 text-slate-400 font-bold hover:text-slate-600">Cancelar</button>
                </div>
             </form>
           ) : (
             <div className="animate-in zoom-in-95 duration-300 space-y-8 text-center py-4">
                <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto border-4 border-emerald-500/20">
                    <Check size={40} strokeWidth={3} />
                </div>
                
                <div>
                   <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Aguardando Pagamento</h3>
                   <p className="text-slate-500 text-sm mt-2">Sua assinatura foi criada com sucesso! Escolha como deseja pagar abaixo.</p>
                </div>

                {/* Pix Section */}
                {paymentData?.pixCode && (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-6">
                        <div className="flex flex-col items-center">
                            <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-100 mb-4">
                                <img src={`data:image/png;base64,${paymentData.pixImage}`} alt="QR Code Pix" className="w-48 h-48" />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escaneie o QR Code acima</span>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-2 text-left">Código Copia e Cola</label>
                            <div className="flex gap-2">
                                <input 
                                    readOnly 
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-600 truncate"
                                    value={paymentData.pixCode}
                                />
                                <button 
                                    onClick={() => copyToClipboard(paymentData.pixCode)}
                                    className={`px-4 rounded-xl transition-all font-bold flex items-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                   <a 
                     href={paymentData?.invoiceUrl} 
                     target="_blank" 
                     className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
                   >
                     Abrir Link de Pagamento (Boleto/Cartão) <ExternalLink size={18} />
                   </a>
                   
                   <button 
                     onClick={() => window.location.reload()}
                     className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                   >
                     Já realizei o pagamento <CheckCircle size={20} />
                   </button>
                </div>

                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Sua conta será liberada assim que o pagamento for compensado.</p>
             </div>
           )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500" /> Pagamento 100% seguro via Asaas
        </div>
      </div>
    </div>
  );
};
