
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Crown, Check, X, Plus, Users, Settings, BarChart3, Search, 
  Infinity, Play, Pause, AlertCircle, Save, Calculator, 
  TrendingUp, TrendingDown, Calendar, Zap, Activity, AlertTriangle,
  History, DollarSign, Wallet, ArrowRight, Loader2, Edit3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { useClients } from '../contexts/ClientContext'; 
import { useSubscriptions, SubscriptionPlan } from '../contexts/SubscriptionContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { SubscriptionCheckoutModal } from './SubscriptionCheckoutModal';
import { useAuth } from '../contexts/AuthContext';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const Subscriptions: React.FC = () => {
  const { user } = useAuth();
  const { clients, updateClient } = useClients(); 
  const { plans, saasMetrics, delinquency, fetchMetrics } = useSubscriptions();
  const { professionals, addTransaction } = useProfessionals();

  const [activeTab, setActiveTab] = useState<'plans' | 'subscribers' | 'reports' | 'config'>('plans');
  
  // Pot Distribution State
  const [selectedProId, setSelectedProId] = useState<string>('');
  const [shopPercent, setShopPercent] = useState<number>(50);
  const [proPercent, setProPercent] = useState<number>(50);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  
  // Manual Pot State
  const [manualPotValue, setManualPotValue] = useState<string>('');
  const [isEditingPot, setIsEditingPot] = useState(false);

  useEffect(() => { 
    if (activeTab === 'reports' || activeTab === 'config') fetchMetrics(); 
  }, [activeTab, fetchMetrics]);

  // Sync manual value with MRR initially
  useEffect(() => {
    if (saasMetrics?.mrr !== undefined && !isEditingPot && manualPotValue === '') {
        setManualPotValue(saasMetrics.mrr.toString());
    }
  }, [saasMetrics, isEditingPot]);

  useEffect(() => {
    if (professionals.length > 0 && !selectedProId) {
        setSelectedProId(professionals[0].id);
    }
  }, [professionals, selectedProId]);

  const subscribers = useMemo(() => clients.filter(c => ['ACTIVE', 'PAUSED', 'PENDING_PAYMENT'].includes(c.subscriptionStatus || '')), [clients]);

  const usageData = useMemo(() => [
    { name: 'Assinantes', visits: saasMetrics?.usageComparison.subscriberVisits || 0, fill: '#f59e0b' },
    { name: 'Avulsos', visits: saasMetrics?.usageComparison.regularVisits || 0, fill: '#6366f1' }
  ], [saasMetrics]);

  const handleUpdateShopPercent = (val: number) => {
    setShopPercent(val);
    setProPercent(100 - val);
  };

  const handleUpdateProPercent = (val: number) => {
    setProPercent(val);
    setShopPercent(100 - val);
  };

  const totalPotValue = parseFloat(manualPotValue) || 0;
  const proShareValue = (totalPotValue * proPercent) / 100;

  const handlePaySubscriptionCommission = async () => {
    if (!selectedProId || proShareValue <= 0) return;
    
    setIsProcessingPayout(true);
    try {
        const proName = professionals.find(p => p.id === selectedProId)?.name || 'Profissional';
        
        await addTransaction({
            id: crypto.randomUUID(),
            professionalId: selectedProId,
            type: 'BONUS',
            serviceName: 'Comissão de Assinaturas (Pote)',
            clientName: 'Rateio Mensal',
            date: new Date().toISOString(),
            price: proShareValue,
            commissionRateSnapshot: 100,
            commissionAmountSnapshot: proShareValue,
            status: 'PENDING',
            category: 'other',
            metadata: { type: 'SUBSCRIPTION_PAYOUT', potTotal: totalPotValue }
        });

        alert(`Comissão de ${formatCurrency(proShareValue)} enviada para as contas de ${proName}!`);
        setIsEditingPot(false);
    } catch (err) {
        alert("Erro ao processar rateio.");
    } finally {
        setIsProcessingPayout(false);
    }
  };

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit">
          {[
            { id: 'plans', label: 'Planos', icon: Crown },
            { id: 'subscribers', label: 'Assinantes', icon: Users },
            { id: 'reports', label: 'Dashboard SaaS', icon: BarChart3 },
            { id: 'config', label: 'Distribuição Pote', icon: Calculator },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/20' : 'text-slate-500 hover:text-white'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
           <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <MetricCard label="MRR Atual" value={formatCurrency(saasMetrics?.mrr || 0)} icon={TrendingUp} sub={`${saasMetrics?.activeCount} Ativos`} color="text-emerald-400" />
              <MetricCard label="Churn Rate" value={`${saasMetrics?.churnRate?.toFixed(1) || 0}%`} icon={TrendingDown} sub="Cancelamentos" color="text-red-400" />
              <MetricCard label="Média de Vindas" value={saasMetrics?.avgVisitsPerSubscriber || 0} icon={History} sub="Por Assinante" color="text-amber-400" />
              <MetricCard label="Faturamento 30d" value={formatCurrency(saasMetrics?.cashForecast30d || 0)} icon={Calendar} sub="Projeção" color="text-indigo-400" />
              <MetricCard label="Inadimplência" value={saasMetrics?.delinquencyCount || 0} icon={AlertTriangle} sub="Pendentes" color="text-amber-500" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Activity size={22} className="text-amber-500" /> Fidelização vs. Avulsos</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total de Visitas no Período</p>
                 </div>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={usageData} layout="vertical" margin={{ left: 20, right: 40 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} fontStyle="bold" width={100} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px'}} />
                          <Bar dataKey="visits" radius={[0, 12, 12, 0]} barSize={40}>
                             {usageData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800">
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Visitas por Assinantes</p>
                       <p className="text-2xl font-bold text-amber-500">{saasMetrics?.usageComparison.subscriberVisits}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Visitas por Avulsos</p>
                       <p className="text-2xl font-bold text-indigo-400">{saasMetrics?.usageComparison.regularVisits}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col shadow-sm">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><AlertCircle size={22} className="text-red-500" /> Alertas de Cobrança</h3>
                 <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {delinquency.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 italic text-sm text-center">
                         <Check size={32} className="mb-2 text-emerald-500" /> Sem pendências financeiras.
                      </div>
                    ) : delinquency.map(d => (
                       <div key={d.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center group transition-all hover:border-red-500/30">
                          <div><p className="font-bold text-white text-sm">{d.clientName}</p><p className="text-[9px] text-slate-500 uppercase font-black">{d.planName}</p></div>
                          <div className="text-right"><p className="text-red-400 font-bold text-sm">{formatCurrency(d.amount)}</p><span className="text-[8px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-black uppercase">Vencido</span></div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5"><Calculator size={200}/></div>
                
                <div className="relative z-10 mb-10 text-center">
                    <h2 className="text-3xl font-heading font-extrabold text-white mb-2">Rateio do Pote de Assinaturas</h2>
                    <p className="text-slate-500">Distribua a receita mensal recorrente entre a casa e os profissionais.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">1. Selecionar Profissional</label>
                            <select 
                                value={selectedProId} 
                                onChange={(e) => setSelectedProId(e.target.value)} 
                                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all"
                            >
                                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">2. Definir Percentuais</label>
                            <div className="space-y-6 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                        <span>Barbearia (Casa)</span>
                                        <span className="text-white">{shopPercent}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={shopPercent} 
                                        onChange={(e) => handleUpdateShopPercent(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                        <span>Profissional</span>
                                        <span className="text-white">{proPercent}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={proPercent} 
                                        onChange={(e) => handleUpdateProPercent(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-inner">
                        <div className="mb-6 w-full">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Valor Disponível no Pote</p>
                            <div className="flex items-center justify-center gap-3 group">
                                {isEditingPot ? (
                                    <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                        <span className="text-2xl font-black text-white">R$</span>
                                        <input 
                                            type="number" 
                                            autoFocus
                                            value={manualPotValue} 
                                            onChange={(e) => setManualPotValue(e.target.value)}
                                            onBlur={() => setIsEditingPot(false)}
                                            className="w-40 bg-slate-900 border border-indigo-500 p-2 rounded-xl text-2xl font-black text-white outline-none text-center"
                                        />
                                        <button onClick={() => setIsEditingPot(false)} className="bg-emerald-500 p-2 rounded-lg text-slate-950"><Check size={18} /></button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <h3 className="text-4xl font-black text-white">{formatCurrency(totalPotValue)}</h3>
                                        <button 
                                            onClick={() => setIsEditingPot(true)}
                                            className="mt-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-indigo-300 transition-colors bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-400/20"
                                        >
                                            <Edit3 size={12}/> Ajustar Pote Manualmente
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="w-full h-px bg-slate-800 mb-8"></div>
                        
                        <div className="animate-in fade-in duration-500">
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Comissão do Profissional</p>
                            <h4 className="text-5xl font-black text-emerald-400 mb-8">{formatCurrency(proShareValue)}</h4>
                        </div>
                        
                        <button 
                            onClick={handlePaySubscriptionCommission}
                            disabled={proShareValue <= 0 || isProcessingPayout}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            {isProcessingPayout ? <Loader2 className="animate-spin" /> : <><Wallet size={20}/> Pagar Comissão</>}
                        </button>
                        <p className="text-[9px] text-slate-500 mt-4 italic">* O valor será adicionado às comissões em aberto do profissional selecionado como "Comissões da assinatura".</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-4">
            {plans.map(plan => (
                <div key={plan.id} className={`bg-slate-900 border border-slate-800 rounded-[2rem] p-8 transition-all hover:-translate-y-2 group ${plan.isHighlighted ? 'ring-2 ring-amber-500 ring-offset-4 ring-offset-slate-950' : ''}`}>
                    <div className="flex justify-between items-start mb-8">
                        <div className={`p-4 rounded-2xl ${plan.isHighlighted ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}><Crown size={28} /></div>
                        {plan.isHighlighted && <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-amber-500/20">Destaque</span>}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-8"><span className="text-4xl font-black text-white">R$ {plan.price.toFixed(2)}</span><span className="text-slate-500 font-bold">/mês</span></div>
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm text-slate-300 font-medium"><Check size={18} className="text-emerald-500" /> <span>{plan.maxServices === 9999 ? 'Uso Ilimitado' : `${plan.maxServices} Serviços p/ mês`}</span></div>
                        {plan.bonuses.map((b, i) => <div key={i} className="flex items-center gap-3 text-sm text-slate-400"><Check size={18} className="text-emerald-500" /> <span>{b}</span></div>)}
                    </div>
                    <button onClick={() => { setCheckoutPlan(plan); setIsCheckoutOpen(true); }} className="w-full bg-white hover:bg-slate-100 text-slate-950 font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl">Vender Assinatura</button>
                </div>
            ))}
        </div>
      )}
      
      {activeTab === 'subscribers' && (
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden flex-1 flex flex-col shadow-sm animate-in fade-in">
             <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-indigo-500" /> Base de Assinantes</h3>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-black uppercase">{subscribers.length} Membros</span>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                   <thead className="bg-slate-950 text-[10px] uppercase font-black text-slate-500 tracking-widest sticky top-0 z-10">
                      <tr>
                         <th className="p-4">Cliente</th>
                         <th className="p-4">Status</th>
                         <th className="p-4">Última Visita</th>
                         <th className="p-4 text-right">Saldo Cashback</th>
                         <th className="p-4 text-center">Ações</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                      {subscribers.map(sub => (
                         <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 flex items-center gap-3">
                               <img src={sub.avatar_url || `https://ui-avatars.com/api/?name=${sub.name}`} className="w-10 h-10 rounded-xl object-cover" />
                               <span className="font-bold text-white">{sub.name}</span>
                            </td>
                            <td className="p-4">
                               <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                                  sub.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                  sub.subscriptionStatus === 'PENDING_PAYMENT' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                  'bg-slate-800 text-slate-400 border-slate-700'
                               }`}>
                                  {sub.subscriptionStatus === 'ACTIVE' ? 'Ativo' : 'Pendente'}
                               </span>
                            </td>
                            <td className="p-4 text-slate-400 font-medium">{sub.last_visit ? new Date(sub.last_visit).toLocaleDateString('pt-BR') : 'Sem visitas'}</td>
                            <td className="p-4 text-right font-black text-amber-500">{sub.cashback_balance || 0} BurnCoins</td>
                            <td className="p-4 text-center">
                               <button className="text-slate-500 hover:text-white transition-colors"><Settings size={16}/></button>
                            </td>
                         </tr>
                      ))}
                      {subscribers.length === 0 && (
                          <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">Nenhum assinante encontrado.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
      )}

      <SubscriptionCheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} plan={checkoutPlan} onConfirm={async (data) => { if (data.client?.id) { await updateClient(data.client.id, { subscriptionStatus: 'ACTIVE' }); fetchMetrics(); } setIsCheckoutOpen(false); }} />
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, sub, color }: any) => (
  <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm">
     <div className="p-3 bg-slate-800 rounded-2xl text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors w-fit mb-4"><Icon size={20} /></div>
     <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
     <h3 className={`text-2xl font-black ${color}`}>{value}</h3>
     <p className="text-[10px] text-slate-600 font-bold mt-2 uppercase tracking-tighter">{sub}</p>
  </div>
);
