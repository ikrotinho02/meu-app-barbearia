
import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Minus, 
  Smartphone, 
  CreditCard, 
  DollarSign, 
  History,
  User,
  Tag,
  Lock,
  Search,
  X,
  Filter,
  TrendingDown
} from 'lucide-react';
import { useCash } from '../contexts/CashContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { CloseCashModal } from './CloseCashModal';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const CashFlow: React.FC = () => {
  const { summary, dailyCash, addTransaction, isCashOpen } = useCash();
  const { professionals } = useProfessionals();
  
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [txType, setTxType] = useState<'IN' | 'OUT'>('IN');
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('cash');
  const [selectedPro, setSelectedPro] = useState('');
  const [category, setCategory] = useState('OTHER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    const finalDescription = `${description} [CAIXA]`;
    
    /* Fix: add explicit 0 for the optional feeAmount parameter to match signature (amount, method, description, type, professionalId, feeAmount, category) */
    await addTransaction(val, method as any, finalDescription, txType, selectedPro, 0, category);
    
    setAmount('');
    setDescription('');
    setShowForm(false);
  };

  const filteredTransactions = dailyCash.transactions.filter(tx => {
    if (filterType === 'ALL') return true;
    return tx.type === filterType;
  });

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BalanceCard label="Dinheiro (Gaveta)" value={summary.cashInHand} icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" />
        <BalanceCard label="Total de Saídas" value={summary.totalOut} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" />
        <BalanceCard label="Cartão / Pix" value={(summary.byMethod['credit'] || 0) + (summary.byMethod['debit'] || 0) + (summary.byMethod['pix'] || 0)} icon={CreditCard} color="text-indigo-500" bg="bg-indigo-500/10" />
        <BalanceCard label="Saldo Líquido" value={summary.currentBalance} icon={Wallet} color="text-white" bg="bg-indigo-600" isHighlight />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        <div className="flex-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="text-indigo-500" /> Operações Rápidas
              </h3>
              <button 
                onClick={() => setIsCloseModalOpen(true)}
                className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-red-600/20"
              >
                <Lock size={14} /> Fechar Caixa
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => { setTxType('IN'); setShowForm(true); }}
                className="flex flex-col items-center justify-center p-6 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all group"
              >
                <Plus className="mb-2 group-hover:scale-125 transition-transform" />
                <span className="font-bold uppercase text-xs">Nova Entrada</span>
              </button>
              <button 
                onClick={() => { setTxType('OUT'); setShowForm(true); }}
                className="flex flex-col items-center justify-center p-6 bg-rose-600/10 border border-rose-500/20 rounded-2xl hover:bg-rose-600 hover:text-white transition-all group"
              >
                <Minus className="mb-2 group-hover:scale-125 transition-transform" />
                <span className="font-bold uppercase text-xs">Nova Saída</span>
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-2">
                  <h4 className={`font-bold uppercase text-xs ${txType === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Lançar {txType === 'IN' ? 'Entrada' : 'Saída'} no Caixa
                  </h4>
                  <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                </div>
                
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input 
                    type="number" step="0.01" required autoFocus
                    placeholder="0,00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-2xl font-bold text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Meio</label>
                    <select 
                      value={method} onChange={e => setMethod(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="credit">Cartão Crédito</option>
                      <option value="debit">Cartão Débito</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Vendedor (Opcional)</label>
                    <select 
                      value={selectedPro} onChange={e => setSelectedPro(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                    >
                      <option value="">Nenhum</option>
                      {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <input 
                  type="text" placeholder="Descrição (ex: Papelaria, Lanche...)" required
                  value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500"
                />

                <button type="submit" className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${txType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
                  Confirmar Lançamento
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="w-full lg:w-96 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 bg-slate-950">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Histórico Diário</h3>
                <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-[10px] font-bold">{filteredTransactions.length}</span>
            </div>
            
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
                {[
                    { id: 'ALL', label: 'Tudo', icon: History },
                    { id: 'IN', label: 'Entradas', icon: ArrowUpRight },
                    { id: 'OUT', label: 'Saídas', icon: ArrowDownRight }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterType(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            filterType === tab.id 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <tab.icon size={12} /> {tab.label}
                    </button>
                ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {filteredTransactions.map(tx => (
              <div key={tx.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center group animate-in fade-in slide-in-from-right-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tx.type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {tx.type === 'IN' ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold leading-tight">{tx.description}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {tx.method.toUpperCase()}</p>
                  </div>
                </div>
                <span className={`font-mono font-bold text-sm ${tx.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'IN' ? '+' : '-'} {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
            {filteredTransactions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
                <Search size={40} className="mb-2" />
                <p className="text-sm font-medium">Nenhum registro.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CloseCashModal isOpen={isCloseModalOpen} onClose={() => setIsCloseModalOpen(false)} />
    </div>
  );
};

const BalanceCard = ({ label, value, icon: Icon, color, bg, isHighlight }: any) => (
  <div className={`${isHighlight ? bg : 'bg-slate-900'} border border-slate-800 p-5 rounded-3xl shadow-sm transition-all hover:border-slate-700`}>
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2.5 rounded-xl ${isHighlight ? 'bg-white/20' : bg} ${isHighlight ? 'text-white' : color}`}>
        <Icon size={20} />
      </div>
    </div>
    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isHighlight ? 'text-indigo-100' : 'text-slate-500'}`}>{label}</p>
    <h3 className={`text-2xl font-heading font-bold ${isHighlight ? 'text-white' : 'text-white'}`}>{formatCurrency(value)}</h3>
  </div>
);
