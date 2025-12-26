
import React, { useState, useMemo, useEffect } from 'react';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { Professional, ServiceTransaction } from '../types';
import { useProducts } from '../contexts/ProductContext';
import { useCash } from '../contexts/CashContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/dbClient';
import { 
  Users, DollarSign, CheckCircle2, Plus, Edit2, Trash2, 
  RefreshCcw, Gift, X, FileText, ShoppingBag, ShoppingCart,
  Check, Loader2, RotateCcw, ArrowUpRight, Banknote, Building2, AlertTriangle
} from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (isoString: string) => {
  return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const Professionals: React.FC = () => {
  const { user } = useAuth();
  const { 
    professionals, transactions, paidTransactions, addProfessional, updateProfessional, deleteProfessional, 
    addTransaction, updateTransaction, recalculateCommissions, undoCommissionPayout, 
    refreshTransactions, fetchPaidHistory
  } = useProfessionals();

  const { products } = useProducts();
  const { refreshCashStatus, addTransaction: addCashTx } = useCash();

  const [viewMode, setViewMode] = useState<'team' | 'open' | 'paid'>('team');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<Partial<Professional> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedProId, setSelectedProId] = useState<string>('');
  const [globalRecalculateRate, setGlobalRecalculateRate] = useState<string>('');
  const [bonusAmount, setBonusAmount] = useState<string>('');
  
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [purchaseType, setPurchaseType] = useState<'cost' | 'custom'>('cost');
  const [purchaseValue, setPurchaseValue] = useState<string>('');

  // Payout choice state
  const [payoutTarget, setPayoutTarget] = useState<{ proId: string, amount: number } | null>(null);

  useEffect(() => {
    if (professionals.length > 0 && !selectedProId) {
      setSelectedProId(professionals[0].id);
    }
  }, [professionals, selectedProId]);

  useEffect(() => {
    if (viewMode === 'paid') fetchPaidHistory();
  }, [viewMode, fetchPaidHistory]);

  const handleSaveProfessional = async () => {
    if (isSaving || !editingPro?.name) return;
    setIsSaving(true);
    try {
        const schedule = { start: "09:00", end: "20:00", lunchStart: "12:00", lunchEnd: "13:00" };
        if (editingPro?.id) {
          await updateProfessional(editingPro.id, { ...editingPro, workSchedule: schedule });
        } else {
          await addProfessional({
            name: editingPro?.name!,
            role: editingPro?.role || 'Barbeiro',
            commissionRate: editingPro?.commissionRate || 50,
            status: 'ACTIVE',
            avatarUrl: editingPro?.avatarUrl || `https://ui-avatars.com/api/?name=${editingPro?.name}&background=random`,
            specialties: editingPro?.specialties || ['Geral'],
            workSchedule: schedule
          });
        }
        setIsModalOpen(false);
        setEditingPro(null);
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !selectedProId) return;
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return;

    let finalPrice = purchaseType === 'cost' ? prod.cost : parseFloat(purchaseValue);
    if (isNaN(finalPrice)) return;

    await addTransaction({
        id: crypto.randomUUID(),
        professionalId: selectedProId,
        type: 'EMPLOYEE_PURCHASE',
        serviceName: `Consumo: ${prod.name}`,
        clientName: 'Desconto em Folha',
        date: new Date().toISOString(),
        price: -finalPrice,
        commissionRateSnapshot: 100,
        commissionAmountSnapshot: -finalPrice,
        status: 'PENDING',
        category: 'other'
    });
    setIsPurchaseModalOpen(false);
    setSelectedProduct('');
    setPurchaseValue('');
  };

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.professionalId === selectedProId);
  }, [transactions, selectedProId]);

  const pendingTotal = useMemo(() => {
    return pendingTransactions.reduce((acc, t) => {
        return acc + (t.price * (t.commissionRateSnapshot / 100));
    }, 0);
  }, [pendingTransactions]);

  const payoutsHistory = useMemo(() => {
    const payouts: Record<string, any> = {};
    paidTransactions.filter(t => t.professionalId === selectedProId).forEach(t => {
        const payoutId = t.metadata?.payoutId;
        if (payoutId) {
            if (!payouts[payoutId]) {
                payouts[payoutId] = {
                    id: payoutId,
                    date: t.date,
                    description: `Comissão - ${professionals.find(p => p.id === selectedProId)?.name}`,
                    amount: 0,
                    itemsCount: 0
                };
            }
            payouts[payoutId].amount += (t.price * (t.commissionRateSnapshot / 100));
            payouts[payoutId].itemsCount += 1;
        }
    });
    return Object.values(payouts).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [paidTransactions, selectedProId, professionals]);

  const handlePayCommission = async (origin: 'cash' | 'bank') => {
    if (!selectedProId || pendingTotal <= 0 || !user) return;

    const pro = professionals.find(p => p.id === selectedProId);
    if (!pro) return;

    const totalToPay = pendingTotal;
    setIsProcessing(true);
    
    try {
        const idsToPay = pendingTransactions.map(t => t.id);

        // Se escolher CAIXA, o addTransaction do CashContext já insere na tabela 'transactions'
        // Mas para manter a consistência com a lógica de comissões, vamos inserir manualmente aqui
        // e se for cash, apenas disparar o refresh do status do caixa.
        const { data: payoutData, error: payoutError } = await supabase
            .from('transactions')
            .insert([{
                client_id: user.id,
                professional_id: pro.id,
                description: `Pagamento comissão: ${pro.name} [via ${origin === 'cash' ? 'CAIXA' : 'BANCO'}]`,
                amount: -Math.abs(totalToPay), 
                type: 'EXPENSE',
                category: 'COMMISSION',
                payment_method: origin === 'cash' ? 'cash' : 'pix',
                status: 'PAID',
                date: new Date().toISOString()
            }])
            .select()
            .single();

        if (payoutError) throw payoutError;
        const payoutId = payoutData.id;

        const { error: updateError } = await supabase
            .from('service_transactions')
            .update({ 
                status: 'PAID', 
                commission_paid: true, 
                metadata: { payoutId, origin } 
            })
            .in('id', idsToPay);

        if (updateError) throw updateError;

        await refreshTransactions(); 
        if (origin === 'cash') {
            await refreshCashStatus();
        }

        setPayoutTarget(null);
        alert(`Pagamento via ${origin === 'cash' ? 'Caixa' : 'Banco'} concluído!`);
        
    } catch (err: any) {
        console.error('❌ Falha ao pagar:', err);
        alert("Erro técnico: " + (err.message || 'Erro de rede.'));
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUndoPayment = async (id: string) => {
    alert("Iniciando estorno para ID: " + id);
    try {
      const { error: error1 } = await supabase.from('transactions').delete().match({ id: id });
      if (error1) throw new Error("Erro ao deletar registro no DRE: " + error1.message);

      const { error: error2 } = await supabase.from('service_transactions')
        .update({ commission_paid: false, status: 'PENDING' })
        .filter('metadata->>payoutId', 'eq', id);
      
      if (error2) alert("DRE removido, mas houve um alerta ao reverter itens: " + error2.message);
      
      setTimeout(async () => {
          try {
            await refreshTransactions(); 
            await fetchPaidHistory();    
            await refreshCashStatus();
            alert("ESTORNO CONCLUÍDO COM SUCESSO!");
          } catch (syncErr) {
            console.error("Erro na sincronização pós-estorno:", syncErr);
          }
      }, 600);

    } catch (err: any) {
      alert("FALHA CRÍTICA NO ESTORNO: " + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col p-1 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">Equipe & Comissões</h2>
          <p className="text-slate-400 text-sm">Controle financeiro e performance da equipe.</p>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'team', label: 'Equipe', icon: Users },
            { id: 'open', label: 'Comissões', icon: DollarSign },
            { id: 'paid', label: 'Histórico Pagos', icon: CheckCircle2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'team' && (
        <div className="flex-1 space-y-6 animate-in fade-in">
           <div className="flex justify-end">
              <button onClick={() => { setEditingPro({ commissionRate: 50 }); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
                <Plus size={18}/> Novo Profissional
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {professionals.map(pro => (
                <div key={pro.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 hover:border-slate-700 group transition-all">
                   <div className="flex items-center gap-4 mb-6">
                      <img src={pro.avatarUrl || `https://ui-avatars.com/api/?name=${pro.name}`} className="w-16 h-16 rounded-2xl object-cover" />
                      <div className="flex-1">
                         <h3 className="font-bold text-white text-lg">{pro.name}</h3>
                         <p className="text-slate-500 text-sm">{pro.role}</p>
                      </div>
                      <button onClick={() => { setEditingPro(pro); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:text-indigo-400"><Edit2 size={18}/></button>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                         <span className="text-[10px] text-slate-500 font-black uppercase block">Comissão</span>
                         <span className="text-lg font-bold text-white">{pro.commissionRate}%</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                         <span className="text-[10px] text-slate-500 font-black uppercase block">Status</span>
                         <span className={`text-xs font-bold ${pro.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500'}`}>{pro.status === 'ACTIVE' ? 'ATIVO' : 'FÉRIAS'}</span>
                      </div>
                   </div>
                   <button onClick={() => { if(confirm('Excluir este profissional?')) deleteProfessional(pro.id); }} className="w-full mt-4 py-2 text-slate-600 hover:text-red-500 text-xs font-bold uppercase transition-colors">Remover</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {viewMode === 'open' && (
        <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">Selecionar Profissional</label>
                  <select value={selectedProId} onChange={(e) => setSelectedProId(e.target.value)} className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-800 outline-none focus:border-indigo-500 font-bold">
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                   <button onClick={() => setIsPurchaseModalOpen(true)} className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-xs px-6 py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                     <ShoppingCart size={16}/> Lançar Consumo
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><RefreshCcw size={14}/> Ajuste Global</h4>
                   <div className="flex gap-2">
                     <input type="number" placeholder="%" value={globalRecalculateRate} onChange={e => setGlobalRecalculateRate(e.target.value)} className="w-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-center font-bold" />
                     <button onClick={() => recalculateCommissions(selectedProId, Number(globalRecalculateRate))} className="flex-1 bg-slate-800 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs">Aplicar</button>
                   </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><Gift size={14}/> Lançar Bônus</h4>
                   <div className="flex gap-2">
                     <input type="number" placeholder="R$" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} className="w-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold" />
                     <button onClick={() => { 
                       addTransaction({ id: crypto.randomUUID(), professionalId: selectedProId, type: 'BONUS', serviceName: 'Bônus Extra', clientName: 'Admin', date: new Date().toISOString(), price: Number(bonusAmount), commissionRateSnapshot: 100, commissionAmountSnapshot: Number(bonusAmount), status: 'PENDING', category: 'other' });
                       setBonusAmount('');
                     }} className="flex-1 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white font-bold rounded-xl text-xs">Adicionar</button>
                   </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group shadow-xl">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Saldo Líquido a Pagar</p>
              <h2 className={`text-5xl font-black mb-6 ${pendingTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(pendingTotal)}</h2>
              <button 
                onClick={() => setPayoutTarget({ proId: selectedProId, amount: pendingTotal })} 
                disabled={pendingTotal <= 0 || isProcessing} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black uppercase rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : 'Liquidar Saldo Agora'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden flex-1 flex flex-col shadow-sm">
             <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2"><FileText size={18}/> Extrato de Comissões Pendentes</h3>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-black uppercase">{pendingTransactions.length} Lançamentos</span>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                   <thead className="bg-slate-950 text-[10px] uppercase font-black text-slate-500 tracking-widest sticky top-0 z-10">
                      <tr>
                         <th className="p-4">Data</th>
                         <th className="p-4">Descrição</th>
                         <th className="p-4 text-center">Taxa %</th>
                         <th className="p-4 text-right">Líquido</th>
                         <th className="p-4 text-center">Ação</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                      {pendingTransactions.map(t => {
                        const net = t.price * (t.commissionRateSnapshot / 100);
                        return (
                          <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                             <td className="p-4 text-slate-500 text-xs font-bold">{formatDate(t.date)}</td>
                             <td className="p-4">
                                <p className="text-sm font-bold text-white">{t.serviceName}</p>
                                <p className="text-[10px] text-slate-500 uppercase">{t.clientName}</p>
                             </td>
                             <td className="p-4 text-center">
                                <div className="inline-flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                                   <input type="number" className="w-8 bg-transparent text-white text-xs font-bold text-center outline-none" value={t.commissionRateSnapshot} onChange={(e) => updateTransaction(t.id, { commissionRateSnapshot: Number(e.target.value) })} />
                                   <span className="text-slate-600 text-[10px]">%</span>
                                </div>
                             </td>
                             <td className={`p-4 text-right font-black ${net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(net)}</td>
                             <td className="p-4 text-center">
                                <button onClick={() => updateTransaction(t.id, { status: 'PAID', commissionPaid: true })} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg" title="Marcar como Pago"><Check size={16}/></button>
                             </td>
                          </tr>
                        );
                      })}
                      {pendingTransactions.length === 0 && (
                          <tr>
                              <td colSpan={5} className="p-10 text-center text-slate-500 italic">Tudo em dia! Nenhum saldo pendente.</td>
                          </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {viewMode === 'paid' && (
        <div className="flex-1 flex flex-col gap-6 animate-in fade-in">
           <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden flex-1 flex flex-col shadow-sm">
               <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500" /> Pagamentos Concluídos (Histórico DRE)</h3>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-black uppercase">{payoutsHistory.length} Lotes</span>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                      <tr>
                        <th className="p-4">Data Pagto</th>
                        <th className="p-4">Lançamento DRE</th>
                        <th className="p-4 text-center">Itens</th>
                        <th className="p-4 text-right">Valor Líquido</th>
                        <th className="p-4 text-center">Controle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {payoutsHistory.map(payout => (
                        <tr key={payout.id} className="hover:bg-slate-800/30 group transition-colors">
                          <td className="p-4 text-slate-500 text-xs font-bold">{formatDate(payout.date)}</td>
                          <td className="p-4">
                              <p className="text-sm font-bold text-white">{payout.description}</p>
                              <div className="flex items-center gap-1 text-[9px] text-indigo-400 font-bold uppercase mt-0.5">
                                  <ArrowUpRight size={10}/> ID: {payout.id.split('-')[0]}
                              </div>
                          </td>
                          <td className="p-4 text-center text-slate-400 text-xs">{payout.itemsCount} registros</td>
                          <td className="p-4 text-right font-black text-emerald-400">{formatCurrency(payout.amount)}</td>
                          <td className="p-4 text-center">
                             <button 
                                onClick={() => handleUndoPayment(payout.id)} 
                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-lg transition-all active:scale-95"
                             >
                               Estornar
                             </button>
                          </td>
                        </tr>
                      ))}
                      {payoutsHistory.length === 0 && (
                          <tr>
                              <td colSpan={5} className="p-10 text-center text-slate-500 italic">Nenhum pagamento registrado.</td>
                          </tr>
                      )}
                    </tbody>
                  </table>
               </div>
           </div>
        </div>
      )}

      {/* CONFIRM PAYOUT CHOICE MODAL */}
      {payoutTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-white font-bold flex items-center gap-2"><DollarSign size={20} className="text-emerald-500"/> Confirmar Saída</h3>
                      <button onClick={() => setPayoutTarget(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 text-center">
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Valor do Pagamento</p>
                      <h2 className="text-4xl font-black text-white mb-6">{formatCurrency(payoutTarget.amount)}</h2>
                      <p className="text-slate-300 text-sm mb-8">Escolha de onde sairá o dinheiro para o profissional <strong>{professionals.find(p => p.id === payoutTarget.proId)?.name}</strong>.</p>
                      
                      <div className="grid grid-cols-1 gap-3">
                          <button 
                            disabled={isProcessing}
                            onClick={() => handlePayCommission('cash')}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <><Banknote size={20}/> Retirar do Efetivo (Caixa)</>}
                          </button>
                          <button 
                            disabled={isProcessing}
                            onClick={() => handlePayCommission('bank')}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <><Building2 size={20}/> Conta Bancária (DRE)</>}
                          </button>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-950/50 text-center flex items-center justify-center gap-2">
                     <AlertTriangle size={12} className="text-amber-500"/>
                     <p className="text-[9px] text-slate-500 uppercase font-bold">Atenção: Esta ação atualizará o DRE instantaneamente.</p>
                  </div>
              </div>
          </div>
      )}

      {isPurchaseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold text-white">Lançar Consumo Profissional</h3>
                   <button onClick={() => setIsPurchaseModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Produto do Estoque</label>
                      <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none">
                         <option value="">Selecione um produto...</option>
                         {products.map(p => <option key={p.id} value={p.id}>{p.name} (Saldo: {p.stock})</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor do Desconto</label>
                      <div className="flex gap-2 mb-2">
                         <button onClick={() => setPurchaseType('cost')} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${purchaseType === 'cost' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-500'}`}>Preço Custo</button>
                         <button onClick={() => setPurchaseType('custom')} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${purchaseType === 'custom' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-500'}`}>Personalizado</button>
                      </div>
                      {purchaseType === 'custom' && (
                         <input type="number" value={purchaseValue} onChange={e => setPurchaseValue(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" />
                      )}
                      {purchaseType === 'cost' && selectedProduct && (
                          <div className="p-3 bg-slate-950 rounded-lg text-sm text-slate-400 border border-slate-800">
                              Valor a descontar: <strong className="text-white">{formatCurrency(products.find(p => p.id === selectedProduct)?.cost || 0)}</strong>
                          </div>
                      )}
                   </div>
                </div>
                <button onClick={handleConfirmPurchase} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-xs px-6 py-4 rounded-xl mt-6 shadow-lg">Confirmar Lançamento</button>
             </div>
          </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold text-white">{editingPro?.id ? 'Editar' : 'Novo'} Profissional</h3>
                   <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="space-y-4">
                   <input type="text" value={editingPro?.name || ''} onChange={e => setEditingPro({...editingPro, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" placeholder="Nome Completo" />
                   <input type="text" value={editingPro?.role || ''} onChange={e => setEditingPro({...editingPro, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" placeholder="Função (Ex: Barbeiro)" />
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Comissão Padrão %</label>
                          <input type="number" value={editingPro?.commissionRate || 0} onChange={e => setEditingPro({...editingPro, commissionRate: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Status na Equipe</label>
                          <select value={editingPro?.status || 'ACTIVE'} onChange={e => setEditingPro({...editingPro, status: e.target.value as any})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none">
                             <option value="ACTIVE">Ativo</option>
                             <option value="VACATION">Férias</option>
                          </select>
                      </div>
                   </div>
                </div>
                <button onClick={handleSaveProfessional} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-6 shadow-lg">
                   {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar Dados'}
                </button>
             </div>
          </div>
      )}
    </div>
  );
};
