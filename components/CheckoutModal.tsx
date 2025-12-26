
import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Plus, Check, CreditCard, Wallet, Smartphone, Archive, ShoppingBag, Scissors, Percent, Crown, Search, Trash2, ArrowRight } from 'lucide-react';
import { Appointment, Service, PaymentMethodType, PaymentMethod, AppointmentItem, Product, ServiceTransaction } from '../types';
import { useAppointments } from '../contexts/AppointmentContext';
import { useCash } from '../contexts/CashContext';
import { useServices } from '../contexts/ServiceContext';
import { useClients } from '../contexts/ClientContext'; 
import { useProducts } from '../contexts/ProductContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { supabase } from '../services/dbClient';

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Dinheiro', type: 'cash', feePercentage: 0, receiveDays: 0, isActive: true },
  { id: '2', name: 'Pix', type: 'pix', feePercentage: 0, receiveDays: 0, isActive: true },
  { id: '3', name: 'Crédito', type: 'credit', feePercentage: 3.99, receiveDays: 30, isActive: true },
  { id: '4', name: 'Débito', type: 'debit', feePercentage: 1.99, receiveDays: 1, isActive: true },
  { id: '5', name: 'Desconto', type: 'discount', feePercentage: 0, receiveDays: 0, isActive: true },
];

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onConfirm: () => void;
  availableMethods?: PaymentMethod[]; 
}

interface PaymentEntry {
    methodId: string;
    amount: number;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onConfirm, availableMethods }) => {
  const { updateAppointment, fetchAppointments } = useAppointments();
  const { addTransaction: addCashTransaction } = useCash();
  const { services } = useServices();
  const { clients, refreshClients } = useClients(); 
  const { products } = useProducts();
  const { professionals, addTransaction: addCommissionTransaction } = useProfessionals();

  const methods = availableMethods || DEFAULT_METHODS;

  const [step, setStep] = useState<'SELECT_MODE' | 'STANDARD' | 'PAYMENT'>('SELECT_MODE');
  const [currentItems, setCurrentItems] = useState<AppointmentItem[]>(appointment?.items || []);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'service' | 'product'>('service');
  
  // Multiple Payment State
  const [currentPayments, setCurrentPayments] = useState<PaymentEntry[]>([]);
  const [selectingAmountForMethod, setSelectingAmountForMethod] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState('');

  const clientData = clients.find(c => c.id === appointment?.clientId);
  const isSubscriber = clientData?.subscriptionStatus === 'ACTIVE';

  useEffect(() => {
    if (isOpen && appointment) {
        setStep('SELECT_MODE');
        setCurrentItems(appointment.items || []);
        setCurrentPayments([]);
        setSelectingAmountForMethod(null);
        setTempAmount('');
        setIsAddingItem(false);
        setItemSearchTerm('');
    }
  }, [isOpen, appointment]);

  const totalValue = useMemo(() => {
    if (!currentItems) return 0;
    return currentItems.reduce((acc, item) => {
        if (isSubscriber && item.type === 'service') return acc + 0;
        return acc + (Number(item.price) || 0);
    }, 0);
  }, [currentItems, isSubscriber]);

  const totalPaid = useMemo(() => {
    return currentPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [currentPayments]);

  const remainingBalance = Math.max(0, totalValue - totalPaid);

  const filteredAvailableItems = useMemo(() => {
    const term = itemSearchTerm.toLowerCase();
    if (itemTypeFilter === 'service') {
      return services.filter(s => s.name.toLowerCase().includes(term));
    } else {
      return products.filter(p => p.status === 'Ativo' && p.name.toLowerCase().includes(term));
    }
  }, [itemSearchTerm, itemTypeFilter, services, products]);

  const handleAddItem = (item: Service | Product) => {
    const newItem: AppointmentItem = {
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      type: itemTypeFilter,
      durationMinutes: 'durationMinutes' in item ? (item as any).durationMinutes : undefined
    };
    setCurrentItems(prev => [...prev, newItem]);
    setItemSearchTerm('');
  };

  const handleAddPayment = () => {
      if (!selectingAmountForMethod) return;
      const amount = parseFloat(tempAmount);
      if (isNaN(amount) || amount <= 0) return alert('Valor inválido');

      setCurrentPayments(prev => [...prev, { methodId: selectingAmountForMethod, amount }]);
      setSelectingAmountForMethod(null);
      setTempAmount('');
  };

  const handleFinalize = async () => {
      if (totalPaid < totalValue) {
          return alert('O valor pago é inferior ao total da comanda.');
      }

      const finalClientName = appointment.clientName || 'Cliente Avulso';

      // 1. Atualiza Status do Agendamento
      await updateAppointment(appointment.id, {
          status: 'COMPLETED',
          items: currentItems,
          totalValue: totalValue
      });

      // 2. Registra cada transação no Caixa/Financeiro
      for (const pay of currentPayments) {
          const method = methods.find(m => m.id === pay.methodId);
          const methodType = method ? method.type : 'cash';
          const isDiscount = methodType === 'discount';
          
          const feePercent = Number(method?.feePercentage) || 0;
          const feeAmount = (pay.amount * feePercent) / 100;

          await addCashTransaction(
              pay.amount, 
              methodType, 
              isDiscount ? `Desconto: ${finalClientName}` : `Serviço: ${finalClientName}`, 
              'IN', 
              appointment.barberId, 
              feeAmount,
              'SERVICE_SALE',
              appointment.startTime, 
              'PAID',
              finalClientName,
              appointment.id 
          );
      }

      // 3. Tabela Service Transactions (Primária - Comissões e Itens)
      const pro = professionals.find(p => p.id === appointment.barberId);
      if (pro && currentItems.length > 0) {
          for (const item of currentItems) {
              let commissionRate = 0;
              if (item.type === 'service') {
                  commissionRate = Number(pro.commissionRate) || 0; 
                  const svc = services.find(s => s.id === item.id);
                  if (svc?.commissionType === 'custom' && svc.customCommissionRate !== undefined) {
                      commissionRate = Number(svc.customCommissionRate) || 0;
                  }
              } else if (item.type === 'product') {
                  const prod = products.find(p => p.id === item.id);
                  commissionRate = Number(prod?.commission_rate) || 0;
              }

              const itemPrice = Number(item.price) || 0;
              const commissionAmount = (itemPrice * commissionRate) / 100;

              await addCommissionTransaction({
                  id: crypto.randomUUID(),
                  professionalId: pro.id,
                  appointmentId: appointment.id,
                  type: item.type === 'service' ? 'SERVICE' : 'PRODUCT_SALE',
                  serviceName: item.name, 
                  clientName: finalClientName,
                  date: appointment.startTime, 
                  price: itemPrice,
                  commissionRateSnapshot: commissionRate,
                  commissionAmountSnapshot: commissionAmount,
                  status: 'PENDING',
                  category: 'other'
              }, 0);
          }
      }

      // 4. Atualiza Ranking do Cliente
      if (appointment.clientId && appointment.clientId !== 'timeoff') {
          try {
              const currentClient = clients.find(c => c.id === appointment.clientId);
              const newTotalSpent = (Number(currentClient?.total_spent) || 0) + totalValue;
              const newVisitsCount = (Number(currentClient?.visits_count) || 0) + 1;
              await supabase.from('customers').update({
                  total_spent: newTotalSpent,
                  visits_count: newVisitsCount,
                  last_visit: new Date().toISOString()
              }).eq('id', appointment.clientId);
              await refreshClients();
          } catch (err) { console.error(err); }
      }
      
      await fetchAppointments(new Date(appointment.startTime));
      onConfirm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><DollarSign className="text-emerald-500" /> Checkout</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{appointment?.clientName || 'Cliente Avulso'}</span>
                    {isSubscriber && <span className="bg-amber-500/10 text-amber-500 px-1.5 rounded border border-amber-500/20 font-black flex items-center gap-1"><Crown size={10}/> ASSINANTE</span>}
                </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {step === 'SELECT_MODE' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <button onClick={() => setStep('PAYMENT')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-8 rounded-2xl text-left transition-all shadow-lg hover:shadow-emerald-500/20 group relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight"><Wallet size={20}/> Checkout Rápido</h3>
                            <p className="text-emerald-100 text-sm mt-1 opacity-80">Finalizar agora com {currentItems?.length || 0} itens.</p>
                        </div>
                        <DollarSign size={80} className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={() => setStep('STANDARD')} className="w-full bg-slate-800 hover:bg-slate-700 text-white p-8 rounded-2xl text-left transition-all border border-slate-700 hover:border-slate-600 group relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight"><ShoppingBag size={20}/> Checkout Padrão</h3>
                            <p className="text-slate-400 text-sm mt-1">Adicionar produtos ou outros serviços.</p>
                        </div>
                        <Plus size={80} className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            )}

            {step === 'STANDARD' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Itens na Comanda</h3>
                        <button onClick={() => setIsAddingItem(!isAddingItem)} className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                            {isAddingItem ? <><X size={14}/> Fechar Busca</> : <><Plus size={14}/> Adicionar Item</>}
                        </button>
                    </div>
                    {isAddingItem && (
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2">
                            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                                <button onClick={() => setItemTypeFilter('service')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${itemTypeFilter === 'service' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Serviços</button>
                                <button onClick={() => setItemTypeFilter('product')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${itemTypeFilter === 'product' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Produtos</button>
                            </div>
                            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input type="text" placeholder={`Buscar...`} value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-indigo-500" autoFocus /></div>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                {filteredAvailableItems.map(item => (
                                    <button key={item.id} onClick={() => handleAddItem(item)} className="w-full flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-800 text-left group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-indigo-500/20 text-slate-500 group-hover:text-indigo-400 transition-colors">{itemTypeFilter === 'service' ? <Scissors size={12}/> : <ShoppingBag size={12}/>}</div>
                                            <span className="text-xs font-bold text-slate-300 group-hover:text-white">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-400">R$ {Number(item.price).toFixed(2)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        {currentItems?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800 group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${item.type === 'service' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{item.type === 'service' ? <Scissors size={14}/> : <ShoppingBag size={14}/>}</div>
                                    <div><span className="font-bold text-white block text-sm">{item.name}</span></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-mono font-bold text-white">R$ {Number(item.price).toFixed(2)}</span>
                                    <button onClick={() => setCurrentItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-xs">Total Comanda</span><span className="text-2xl font-black text-emerald-400 block">R$ {totalValue.toFixed(2)}</span></div>
                        <button onClick={() => setStep('PAYMENT')} disabled={currentItems.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg mt-6 active:scale-95 transition-all">Ir para Pagamento</button>
                    </div>
                </div>
            )}

            {step === 'PAYMENT' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 text-center shadow-inner">
                        <div className="grid grid-cols-2 divide-x divide-slate-800">
                            <div className="px-2">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Total</span>
                                <p className="text-2xl font-black text-white">R$ {totalValue.toFixed(2)}</p>
                            </div>
                            <div className="px-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${remainingBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {remainingBalance > 0 ? 'Faltando' : 'Pago'}
                                </span>
                                <p className={`text-2xl font-black ${remainingBalance > 0 ? 'text-white' : 'text-emerald-400'}`}>
                                    R$ {remainingBalance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {selectingAmountForMethod ? (
                        <div className="bg-slate-800 p-6 rounded-2xl border border-indigo-500/50 space-y-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-white uppercase text-xs">Quanto será no {methods.find(m => m.id === selectingAmountForMethod)?.name}?</h4>
                                <button onClick={() => setSelectingAmountForMethod(null)} className="text-slate-400 hover:text-white"><X size={16}/></button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                <input 
                                    type="number" step="0.01" autoFocus
                                    value={tempAmount}
                                    onChange={e => setTempAmount(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-2xl font-bold text-white outline-none focus:border-indigo-500"
                                    placeholder={remainingBalance.toFixed(2)}
                                />
                            </div>
                            <button onClick={handleAddPayment} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                Adicionar <Check size={18}/>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {methods.filter(m => m.isActive).map(method => (
                                <button 
                                    key={method.id} 
                                    onClick={() => {
                                        setSelectingAmountForMethod(method.id);
                                        setTempAmount(remainingBalance.toString());
                                    }} 
                                    disabled={remainingBalance === 0}
                                    className="p-4 rounded-2xl border border-slate-800 bg-slate-950 text-slate-500 hover:bg-slate-800 hover:text-white transition-all flex flex-col items-center gap-2 disabled:opacity-30"
                                >
                                    {method.type === 'cash' ? <Wallet size={24}/> : method.type === 'pix' ? <Smartphone size={24}/> : method.type === 'discount' ? <Percent size={24}/> : <CreditCard size={24}/>}
                                    <span className="font-bold text-[10px] uppercase">{method.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {currentPayments.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Pagamentos Aplicados</h4>
                            {currentPayments.map((p, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
                                            {methods.find(m => m.id === p.methodId)?.type === 'cash' ? <Wallet size={12}/> : <CreditCard size={12}/>}
                                        </span>
                                        <span className="text-sm font-bold text-slate-300">{methods.find(m => m.id === p.methodId)?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-white text-sm">R$ {p.amount.toFixed(2)}</span>
                                        <button onClick={() => setCurrentPayments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-500"><X size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                        onClick={handleFinalize} 
                        disabled={totalPaid < totalValue}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-3"
                    >
                        {totalPaid >= totalValue ? <><Check size={20}/> Finalizar Recebimento</> : <><DollarSign size={20}/> Aguardando Pagamento Total</>}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
