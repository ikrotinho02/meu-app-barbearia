
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/dbClient';
import { 
  TrendingUp, 
  CreditCard, 
  FileText, 
  ArrowDownRight, 
  Receipt,
  Plus, 
  Trash2, 
  Edit2, 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Lock, 
  RotateCcw, 
  AlertTriangle, 
  X, 
  Wallet, 
  ArrowUpRight, 
  Percent, 
  Building2,
  Banknote,
  Check,
  Loader2
} from 'lucide-react';
import { PaymentMethod, Appointment, FinancialTransaction, PaymentMethodType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAppointments } from '../contexts/AppointmentContext';
import { useCash } from '../contexts/CashContext';

// --- INITIAL CONSTANTS ---
const INITIAL_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Dinheiro', type: 'cash', feePercentage: 0, receiveDays: 0, isActive: true },
  { id: '2', name: 'Pix', type: 'pix', feePercentage: 0, receiveDays: 0, isActive: true },
  { id: '3', name: 'Crédito', type: 'credit', feePercentage: 3.99, receiveDays: 30, isActive: true },
  { id: '4', name: 'Débito', type: 'debit', feePercentage: 1.99, receiveDays: 1, isActive: true },
  { id: '5', name: 'Desconto', type: 'discount', feePercentage: 0, receiveDays: 0, isActive: true },
];

export const Financial: React.FC = () => {
  const { user } = useAuth();
  const { fetchFinancialAppointments, reopenAppointment } = useAppointments();
  const { deleteTransactionByDetails, addTransaction, refreshCashStatus } = useCash();

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'commands' | 'methods' | 'dre'>('overview');
  
  // Real Data State
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Date State for DRE & Commands (Month View)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Date State for Cash Flow (Daily View)
  const [cashFlowDate, setCashFlowDate] = useState(new Date().toISOString().split('T')[0]);

  // Commands Tab State
  const [openCommands, setOpenCommands] = useState<Appointment[]>([]);
  const [closedCommands, setClosedCommands] = useState<Appointment[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(false);
  
  // Expenses Tab State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ 
      description: '', 
      amount: '', 
      category: 'EXPENSE', 
      dueDate: '', 
      status: 'PAID',
      paymentMethod: 'cash' as 'cash' | 'bank'
  });

  // Pay Pending State
  const [payingExpense, setPayingExpense] = useState<FinancialTransaction | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Reopen Security State
  const [reopenTarget, setReopenTarget] = useState<Appointment | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isProcessingReopen, setIsProcessingReopen] = useState(false);

  // Payment Methods State (Local for now, could be DB backed)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(INITIAL_METHODS);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethod>>({});

  // --- FETCH FINANCIAL DATA ---
  const fetchFinancialData = async () => {
    if (!user) return;
    setIsLoadingData(true);
    
    let startDate, endDate;
    if (activeTab === 'overview') {
        startDate = new Date(cashFlowDate);
        startDate.setHours(0,0,0,0);
        endDate = new Date(cashFlowDate);
        endDate.setHours(23,59,59,999);
    } else {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', user.id)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
    if (activeTab === 'commands') {
        const fetchCommands = async () => {
            setIsLoadingCommands(true);
            const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString();
            const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();
            const { open, closed } = await fetchFinancialAppointments(startOfMonth, endOfMonth);
            setOpenCommands(open);
            setClosedCommands(closed);
            setIsLoadingCommands(false);
        };
        fetchCommands();
    }
  }, [user, selectedMonth, selectedYear, cashFlowDate, activeTab, fetchFinancialAppointments]);

  // --- ACTIONS ---

  const handleSaveMethod = () => {
      if (editingMethod.id) {
          setPaymentMethods(prev => prev.map(m => m.id === editingMethod.id ? { ...m, ...editingMethod } as PaymentMethod : m));
      } else {
          const newMethod: PaymentMethod = {
              id: crypto.randomUUID(),
              name: editingMethod.name || 'Novo Método',
              type: editingMethod.type || 'credit',
              feePercentage: editingMethod.type === 'discount' ? 0 : Number(editingMethod.feePercentage ?? 0),
              receiveDays: editingMethod.type === 'discount' ? 0 : Number(editingMethod.receiveDays ?? 0),
              isActive: true
          };
          setPaymentMethods(prev => [...prev, newMethod]);
      }
      setIsMethodModalOpen(false);
      setEditingMethod({});
  };

  const handleDeleteMethod = (id: string) => {
      if(confirm('Deseja remover este método de pagamento?')) {
          setPaymentMethods(prev => prev.filter(m => m.id !== id));
      }
  }

  const handleSaveExpense = async () => {
      if (!newExpense.description || !newExpense.amount) return alert('Preencha os campos');
      
      const amount = parseFloat(newExpense.amount);
      const isPaid = newExpense.status === 'PAID';
      const methodForTx = isPaid ? (newExpense.paymentMethod === 'cash' ? 'cash' : 'pix') : 'cash';

      await addTransaction(
          amount,
          methodForTx as PaymentMethodType, 
          newExpense.description,
          'OUT',
          undefined,
          0,
          newExpense.category,
          newExpense.dueDate || undefined,
          newExpense.status as 'PAID' | 'PENDING'
      );

      fetchFinancialData();
      setIsExpenseModalOpen(false);
      setNewExpense({ description: '', amount: '', category: 'EXPENSE', dueDate: '', status: 'PAID', paymentMethod: 'cash' });
  };

  const handlePayExpense = async (method: 'cash' | 'bank') => {
    if (!payingExpense) return;
    setIsProcessingPayment(true);

    try {
        const finalMethod = method === 'cash' ? 'cash' : 'pix';
        const { error } = await supabase
            .from('transactions')
            .update({ 
                status: 'PAID', 
                payment_method: finalMethod,
                date: new Date().toISOString() 
            })
            .eq('id', payingExpense.id);

        if (error) throw error;

        // Se for dinheiro, atualiza o caixa diário localmente
        if (method === 'cash') {
            await refreshCashStatus();
        }

        fetchFinancialData();
        setPayingExpense(null);
    } catch (err: any) {
        alert("Erro ao pagar conta: " + err.message);
    } finally {
        setIsProcessingPayment(false);
    }
  };

  // --- REOPEN LOGIC ---
  const handleInitiateReopen = (cmd: Appointment) => {
      setReopenTarget(cmd);
      setPassword('');
      setAuthError('');
  };

  const handleConfirmReopen = async () => {
      if (!reopenTarget || !user?.email) return;
      setIsProcessingReopen(true);
      setAuthError('');

      try {
          const { error } = await supabase.auth.signInWithPassword({
              email: user.email,
              password: password
          });

          if (error) {
              setAuthError('Senha incorreta.');
              setIsProcessingReopen(false);
              return;
          }

          await reopenAppointment(reopenTarget.id);
          const desc = `Serviço: ${reopenTarget.clientName}`;
          await deleteTransactionByDetails(desc, Number(reopenTarget.totalValue));

          // UI Update: Move from Closed to Open immediately
          setClosedCommands(prev => prev.filter(c => c.id !== reopenTarget.id));
          const reopenedItem = { ...reopenTarget, status: 'SCHEDULED' as const };
          setOpenCommands(prev => [reopenedItem, ...prev]); 
          
          setReopenTarget(null);
      } catch (err: any) {
          setAuthError('Erro ao processar: ' + err.message);
      } finally {
          setIsProcessingReopen(false);
      }
  };

  // --- CALCULATE DRE ---
  const dre = useMemo(() => {
    const revenueByMethod: Record<string, number> = {};
    
    transactions
      .filter(t => t.type === 'INCOME')
      .forEach(t => {
         const method = t.payment_method || 'Indefinido';
         revenueByMethod[method] = (revenueByMethod[method] || 0) + t.amount;
      });

    const discountsGiven = revenueByMethod['discount'] || 0;
    const totalIncomeStored = Object.values(revenueByMethod).reduce((acc: number, val: number) => acc + val, 0);
    const grossRevenue = totalIncomeStored - discountsGiven;

    const feesByMethod: Record<string, number> = {};
    transactions.forEach(t => {
        if (t.fee_amount && t.fee_amount > 0) {
            const method = t.payment_method || 'Outros';
            feesByMethod[method] = (feesByMethod[method] || 0) + t.fee_amount;
        }
    });
    const totalFees = Object.values(feesByMethod).reduce((acc: number, val: number) => acc + val, 0);

    const paidExpenses = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PAID');
    const totalPaidExpenses = paidExpenses.reduce((acc, t) => acc + Math.abs(t.amount), 0);

    const commissionsPaid = paidExpenses
        // Fix: Removed invalid 'SUBSCRIPTION_COMMISSION' comparison as it does not overlap with FinancialTransaction category type
        .filter(t => t.category === 'COMMISSION')
        .reduce((acc, t) => acc + Math.abs(t.amount), 0);

    const netRevenue = grossRevenue - discountsGiven;
    const operationalExpenses = totalPaidExpenses - commissionsPaid;
    const operationalResult = netRevenue - totalFees - totalPaidExpenses;

    return {
        revenueByMethod,
        discountsGiven,
        grossRevenue,
        totalFees,
        commissionsPaid,
        netRevenue,
        operationalExpenses,
        totalSaidas: totalPaidExpenses + totalFees,
        operationalResult,
        paidExpensesList: paidExpenses
    };
  }, [transactions]);

  // --- CALCULATE VISÃO GERAL ---
  const cashFlowStats = useMemo(() => {
      const income = transactions
        .filter(t => t.type === 'INCOME' && t.payment_method !== 'discount')
        .reduce((acc: number, t: FinancialTransaction) => acc + t.amount, 0);
        
      const expenses = dre.totalSaidas;
      const balance = income - expenses;

      const byMethod: Record<string, number> = {};
      transactions
        .filter(t => t.type === 'INCOME' && t.payment_method !== 'discount')
        .forEach(t => {
            const m = t.payment_method || 'Outros';
            byMethod[m] = (byMethod[m] || 0) + t.amount;
        });

      return { income, expenses, balance, byMethod };
  }, [transactions, dre.totalSaidas]);

  const expensesSplit = useMemo(() => {
      const paid = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PAID');
      const pending = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING');
      return { paid, pending };
  }, [transactions]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-full flex flex-col space-y-6">
       {/* Header Tabs */}
       <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-2 rounded-2xl border border-slate-800 gap-4">
        
        <div className="flex p-1 gap-1 w-full md:w-auto overflow-x-auto custom-scrollbar">
          {[
            { id: 'overview' as const, label: 'Visão Geral', icon: TrendingUp },
            { id: 'commands' as const, label: 'Comandas', icon: Receipt },
            { id: 'expenses' as const, label: 'Despesas', icon: ArrowDownRight },
            { id: 'methods' as const, label: 'Formas Pagamento', icon: CreditCard },
            { id: 'dre' as const, label: 'DRE Detalhado', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-sm">
           {activeTab === 'overview' ? (
               <div className="flex items-center px-3">
                  <Calendar size={16} className="text-emerald-500 mr-2" />
                  <input 
                    type="date" 
                    value={cashFlowDate}
                    onChange={(e) => setCashFlowDate(e.target.value)}
                    className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer hover:text-emerald-400 transition-colors"
                  />
               </div>
           ) : (
               <>
                   <div className="flex items-center px-3 border-r border-slate-800">
                      <Calendar size={16} className="text-indigo-500 mr-2" />
                      <select 
                        value={selectedMonth} 
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(Number(e.target.value))}
                        className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer appearance-none hover:text-indigo-400 transition-colors"
                      >
                        {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                          <option key={i} value={i} className="bg-slate-900">{m}</option>
                        ))}
                      </select>
                   </div>
                   <div className="px-3">
                      <select 
                        value={selectedYear} 
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer appearance-none hover:text-indigo-400 transition-colors"
                      >
                        {[2023, 2024, 2025].map(y => (
                          <option key={y} value={y} className="bg-slate-900">{y}</option>
                        ))}
                      </select>
                   </div>
               </>
           )}
        </div>
      </div>

      {/* --- VISÃO GERAL --- */}
      {activeTab === 'overview' && (
        <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-right-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-emerald-500 text-xs font-bold uppercase mb-1">Total Entradas</p>
                       <h3 className="text-3xl font-bold text-white">{formatCurrency(cashFlowStats.income)}</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><ArrowUpRight size={24}/></div>
                 </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-red-500 text-xs font-bold uppercase mb-1">Total Saídas</p>
                       <h3 className="text-3xl font-bold text-white">{formatCurrency(cashFlowStats.expenses)}</h3>
                    </div>
                    <div className="p-3 bg-red-500/10 text-red-500 rounded-xl"><ArrowDownRight size={24}/></div>
                 </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-indigo-400 text-xs font-bold uppercase mb-1">Saldo do Período</p>
                       <h3 className={`text-3xl font-bold ${cashFlowStats.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                           {formatCurrency(cashFlowStats.balance)}
                       </h3>
                    </div>
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl"><Wallet size={24}/></div>
                 </div>
              </div>
           </div>
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
               <h3 className="text-lg font-bold text-white mb-4">Arrecadação por Forma de Pagamento</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {Object.entries(cashFlowStats.byMethod).map(([method, value]) => (
                       <div key={method} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                           <p className="text-xs text-slate-500 uppercase font-bold mb-1 capitalize">{method}</p>
                           <p className="text-xl font-bold text-white">{formatCurrency(value as number)}</p>
                       </div>
                   ))}
                   {Object.keys(cashFlowStats.byMethod).length === 0 && (
                       <div className="col-span-4 text-center text-slate-500 py-4">Nenhuma movimentação neste dia.</div>
                   )}
               </div>
           </div>
        </div>
      )}

      {/* --- COMMANDS TAB --- */}
      {activeTab === 'commands' && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-right-4 min-h-0 overflow-hidden">
           <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex justify-between items-center">
                 <h3 className="font-bold text-amber-500 flex items-center gap-2">
                    <Clock size={18} /> Comandas Abertas
                 </h3>
                 <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded font-bold">{openCommands.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                 {openCommands.map(cmd => (
                    <div key={cmd.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 border-l-4 border-l-amber-500 hover:bg-slate-800/50 transition-colors">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <h4 className="font-bold text-white">{cmd.clientName}</h4>
                             <span className="text-xs text-slate-500">{new Date(cmd.startTime).toLocaleString()}</span>
                          </div>
                          <span className="text-amber-400 font-bold font-mono">R$ {cmd.totalValue.toFixed(2)}</span>
                       </div>
                       <div className="text-xs text-slate-400 line-clamp-1">
                          {cmd.items.map(i => i.name).join(', ')}
                       </div>
                    </div>
                 ))}
                 {openCommands.length === 0 && <div className="text-center text-slate-500 p-4">Nenhuma comanda aberta neste mês.</div>}
              </div>
           </div>
           <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex justify-between items-center">
                 <h3 className="font-bold text-emerald-500 flex items-center gap-2">
                    <CheckCircle2 size={18} /> Fechadas
                 </h3>
                 <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold">{closedCommands.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                 {closedCommands.map(cmd => (
                    <div key={cmd.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500 hover:bg-slate-800/50 transition-colors group">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <h4 className="font-bold text-white">{cmd.clientName}</h4>
                             <span className="text-xs text-slate-500">{new Date(cmd.startTime).toLocaleDateString()}</span>
                          </div>
                          <div className="text-right">
                             <span className="block text-emerald-400 font-bold font-mono">R$ {cmd.totalValue.toFixed(2)}</span>
                             <span className="text-[10px] text-slate-500 uppercase">Pago</span>
                          </div>
                       </div>
                       <div className="flex justify-between items-end mt-2">
                          <div className="text-xs text-slate-400 line-clamp-1 max-w-[70%]">
                             {cmd.items.map(i => i.name).join(', ')}
                          </div>
                          <button 
                             onClick={() => handleInitiateReopen(cmd)}
                             className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/30 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                             <RotateCcw size={12} /> Reabrir
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- EXPENSES TAB --- */}
      {activeTab === 'expenses' && (
        <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 min-h-0 overflow-hidden">
           <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white">Gestão de Despesas</h3>
              <button 
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg"
              >
                 <Plus size={16} /> Nova Despesa
              </button>
           </div>
           <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
               <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                     <h3 className="font-bold text-slate-300 flex items-center gap-2">
                        <ArrowDownRight size={18} /> Despesas Pagas
                     </h3>
                     <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded font-bold">{expensesSplit.paid.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                     {expensesSplit.paid.map((exp: FinancialTransaction) => (
                        <div key={exp.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                           <div>
                              <h4 className="font-bold text-white text-sm">{exp.description}</h4>
                              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{exp.payment_method === 'cash' ? 'EFETIVO' : 'CONTA BANCÁRIA'}</p>
                              <span className="text-xs text-slate-500">{new Date(exp.date).toLocaleDateString()}</span>
                           </div>
                           <span className="text-red-400 font-bold font-mono">- {formatCurrency(Math.abs(exp.amount))}</span>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 bg-red-900/20 border-b border-red-900/30 flex justify-between items-center">
                     <h3 className="font-bold text-red-400 flex items-center gap-2">
                        <AlertTriangle size={18} /> Contas a Pagar
                     </h3>
                     <span className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded font-bold">{expensesSplit.pending.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                     {expensesSplit.pending.map((exp: FinancialTransaction) => (
                        <div key={exp.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center border-l-4 border-l-red-500">
                           <div>
                              <h4 className="font-bold text-white text-sm">{exp.description}</h4>
                              <span className="text-xs text-slate-500">Vence: {exp.due_date ? new Date(exp.due_date).toLocaleDateString() : 'N/A'}</span>
                           </div>
                           <div className="text-right">
                              <span className="block text-white font-bold font-mono mb-1">R$ {Math.abs(exp.amount).toFixed(2)}</span>
                              <button 
                                onClick={() => setPayingExpense(exp)}
                                className="text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded font-black uppercase hover:bg-emerald-500 transition-all flex items-center gap-1"
                              >
                                <Check size={12}/> Pagar
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* --- METHODS TAB --- */}
      {activeTab === 'methods' && (
        <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-right-4">
           <div className="flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-white">Formas de Pagamento</h3></div>
              <button onClick={() => { setEditingMethod({}); setIsMethodModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg"><Plus size={16} /> Nova Forma</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map(method => (
                 <div key={method.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between group hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-slate-800 rounded-xl text-slate-300">
                          {method.type === 'pix' ? <CreditCard size={24} /> : method.type === 'discount' ? <Percent size={24}/> : <Wallet size={24} />}
                       </div>
                       <div><h4 className="font-bold text-white text-lg">{method.name}</h4><div className="flex gap-4 text-xs text-slate-400 mt-1">{method.type !== 'discount' && <span>Taxa: <span className="text-red-400 font-bold">{method.feePercentage}%</span></span>}</div></div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingMethod(method); setIsMethodModalOpen(true); }} className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition-colors"><Edit2 size={16}/></button>
                       <button onClick={() => handleDeleteMethod(method.id)} className="p-2 bg-slate-800 hover:bg-red-600 rounded-lg text-slate-400 hover:text-white transition-colors"><Trash2 size={16}/></button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* --- DRE TAB --- */}
      {activeTab === 'dre' && (
        <div className="flex-1 space-y-6 animate-in fade-in slide-in-from-right-4 pb-10">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-4xl mx-auto shadow-2xl">
              <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                 <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <FileText className="text-indigo-500" /> Demonstrativo de Resultado (DRE)
                 </h3>
                 <span className="text-xs font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][selectedMonth]} {selectedYear}
                 </span>
              </div>

              <div className="p-0">
                 <div className="border-b border-slate-800 p-6 space-y-4">
                    <h3 className="text-2xl font-bold text-emerald-500 uppercase tracking-tight flex items-center gap-2">
                        <ArrowUpRight size={24} /> Entradas (Receitas)
                    </h3>
                    <div className="flex justify-between items-center pt-2">
                       <span className="font-bold text-white uppercase text-base">(=) Receita Bruta Total</span>
                       <span className="font-bold text-emerald-400 text-2xl font-mono">{formatCurrency(dre.grossRevenue)}</span>
                    </div>
                 </div>

                 <div className="border-b border-slate-800 p-6 space-y-4 bg-slate-900/50">
                    <h3 className="text-2xl font-bold text-red-500 uppercase tracking-tight flex items-center gap-2">
                        <ArrowDownRight size={24} /> Saídas (Custos e Despesas)
                    </h3>
                    <div className="space-y-3 pl-2">
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-400">(-) Taxas Bancárias / Maquininha</span>
                           <span className="text-red-400 font-mono">({formatCurrency(dre.totalFees)})</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-400">(-) Comissões Pagas</span>
                           <span className="text-red-400 font-mono">({formatCurrency(dre.commissionsPaid)})</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-slate-400">(-) Despesas Operacionais (Contas)</span>
                           <span className="text-red-400 font-mono">({formatCurrency(dre.operationalExpenses)})</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800/50 font-bold">
                           <span className="text-slate-300 uppercase">Total Saídas</span>
                           <span className="text-red-500 font-mono">{formatCurrency(dre.totalSaidas)}</span>
                        </div>
                    </div>
                 </div>

                 {/* DETALHAMENTO DE DESPESAS DRE */}
                 <div className="bg-slate-950/50 p-6 border-b border-slate-800">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Detalhamento de Saídas</h4>
                    <div className="space-y-2">
                       {dre.paidExpensesList.map(exp => (
                          <div key={exp.id} className="flex justify-between items-center text-xs p-2 hover:bg-slate-900 rounded transition-colors group">
                             <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${exp.payment_method === 'cash' ? 'bg-amber-500' : 'bg-indigo-500'}`} title={exp.payment_method === 'cash' ? 'Caixa' : 'Banco'}></span>
                                <span className="text-slate-300 font-medium group-hover:text-white transition-colors">{exp.description}</span>
                                <span className="text-[8px] font-black text-slate-500 uppercase">[{exp.payment_method === 'cash' ? 'CAIXA' : 'BANCO'}]</span>
                             </div>
                             <span className="text-red-400 font-mono">-{formatCurrency(Math.abs(exp.amount))}</span>
                          </div>
                       ))}
                       {dre.paidExpensesList.length === 0 && <p className="text-xs text-slate-600 italic">Nenhuma saída registrada.</p>}
                    </div>
                 </div>

                 <div className="p-6 space-y-4 bg-slate-950/30">
                    <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-800">
                       <span className="font-extrabold text-indigo-400 uppercase text-lg">(=) Resultado Operacional (EBITDA)</span>
                       <span className={`font-extrabold text-3xl font-mono ${dre.operationalResult >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatCurrency(dre.operationalResult)}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* PAY PENDING MODAL */}
      {payingExpense && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-white font-bold flex items-center gap-2"><CreditCard size={20} className="text-emerald-500"/> Confirmar Pagamento</h3>
                      <button onClick={() => setPayingExpense(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 text-center">
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Valor a Liquidar</p>
                      <h2 className="text-4xl font-black text-white mb-6">{formatCurrency(Math.abs(payingExpense.amount))}</h2>
                      <p className="text-slate-300 text-sm mb-8">"{payingExpense.description}"</p>
                      
                      <div className="grid grid-cols-1 gap-3">
                          <button 
                            disabled={isProcessingPayment}
                            onClick={() => handlePayExpense('cash')}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {isProcessingPayment ? <Loader2 className="animate-spin" size={18}/> : <><Banknote size={20}/> Retirar do Efetivo (Caixa)</>}
                          </button>
                          <button 
                            disabled={isProcessingPayment}
                            onClick={() => handlePayExpense('bank')}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {isProcessingPayment ? <Loader2 className="animate-spin" size={18}/> : <><Building2 size={20}/> Conta Bancária (DRE)</>}
                          </button>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-950/50 text-center">
                     <p className="text-[10px] text-slate-500 italic">Ao confirmar, o status será alterado para pago e o registro será movido para o fluxo financeiro.</p>
                  </div>
              </div>
          </div>
      )}

      {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Nova Despesa</h3>
                  <div className="space-y-4">
                      <input type="text" placeholder="Descrição" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                      <input type="number" placeholder="Valor (R$)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4">
                          <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={newExpense.status} onChange={e => setNewExpense({...newExpense, status: e.target.value})}>
                              <option value="PAID">Já Pago</option>
                              <option value="PENDING">A Pagar</option>
                          </select>
                          <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={newExpense.dueDate} onChange={e => setNewExpense({...newExpense, dueDate: e.target.value})} />
                      </div>
                      {newExpense.status === 'PAID' && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Meio de Pagamento</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <button type="button" onClick={() => setNewExpense({...newExpense, paymentMethod: 'cash'})} className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${newExpense.paymentMethod === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-slate-950 border border-slate-700 text-slate-400'}`}><Wallet size={18}/><span className="text-xs font-bold">Dinheiro (Caixa)</span></button>
                                  <button type="button" onClick={() => setNewExpense({...newExpense, paymentMethod: 'bank'})} className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${newExpense.paymentMethod === 'bank' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' : 'bg-slate-950 border border-slate-700 text-slate-400'}`}><Building2 size={18}/><span className="text-xs font-bold">Conta Bancária</span></button>
                              </div>
                          </div>
                      )}
                      <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                          <option value="EXPENSE">Despesa Geral</option>
                          <option value="ADVANCE">Adiantamento</option>
                          <option value="COMMISSION">Comissão</option>
                      </select>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancelar</button>
                      <button onClick={handleSaveExpense} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg">Salvar</button>
                  </div>
              </div>
          </div>
      )}

      {isMethodModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">{editingMethod.id ? 'Editar' : 'Nova'} Forma de Pagamento</h3>
                  <div className="space-y-4">
                      <input type="text" placeholder="Nome (ex: Crédito Master)" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" value={editingMethod.name || ''} onChange={e => setEditingMethod({...editingMethod, name: e.target.value})} />
                      <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none" value={editingMethod.type || 'credit'} onChange={e => setEditingMethod({...editingMethod, type: e.target.value as PaymentMethodType})}><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="credit">Crédito</option><option value="debit">Débito</option><option value="discount">Desconto (Categoria)</option></select>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setIsMethodModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold">Cancelar</button>
                      <button onClick={handleSaveMethod} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg">Salvar</button>
                  </div>
              </div>
          </div>
      )}

      {reopenTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Lock size={18} className="text-red-500"/> Autorização Necessária</h3><button onClick={() => setReopenTarget(null)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                  <div className="mb-4"><p className="text-slate-300 text-sm mb-2">Você está prestes a reabrir a comanda de <strong className="text-white">{reopenTarget.clientName}</strong> (R$ {reopenTarget.totalValue}).</p><p className="text-slate-400 text-xs"><AlertTriangle size={12} className="inline mr-1 text-amber-500"/>Isso cancelará o recebimento no financeiro e no caixa.</p></div>
                  <div className="space-y-3">
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Senha de Login</label><input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-red-500" placeholder="••••••••"/></div>
                      {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
                      <div className="flex gap-2 mt-4"><button onClick={() => setReopenTarget(null)} className="flex-1 py-3 text-slate-400 hover:text-white font-bold text-sm">Cancelar</button><button onClick={handleConfirmReopen} disabled={!password || isProcessingReopen} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm">{isProcessingReopen ? 'Verificando...' : 'Confirmar Reabertura'}</button></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
