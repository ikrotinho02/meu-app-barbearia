
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Flame, Scissors, User, Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft, 
  CheckCircle, Smartphone, Info, Check, Star, MapPin, MessageCircle, ShieldCheck, 
  Loader2, LogOut, Crown, History, Plus, Home, X, CreditCard, Megaphone, Sparkles,
  Bell, Search, Package, LayoutDashboard, Users, ShoppingBag, Settings, TrendingUp, 
  DollarSign, Menu, Briefcase, PieChart, Save, Wallet, Lock, Unlock, Moon, Sun, Store, 
  Image as ImageIcon, Activity, Target, Zap, Palette, CheckCircle2, AlertCircle, Copy, 
  Share2, Rocket, ArrowRight, Pipette, RefreshCw, Timer, Coffee, RotateCcw, ArrowUpRight,
  ArrowDownRight, Banknote, Building2, AlertTriangle, Receipt, FileText, Percent, 
  Trophy, Award, ListFilter, LayoutGrid, ShoppingCart, Infinity, Play, Pause, Calculator
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePie, Pie 
} from 'recharts';

// Importações de Contextos e Serviços existentes
import { supabase } from './services/dbClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ClientProvider, useClients } from './contexts/ClientContext';
import { ProfessionalProvider, useProfessionals } from './contexts/ProfessionalContext';
import { ServiceProvider, useServices } from './contexts/ServiceContext';
import { ProductProvider, useProducts } from './contexts/ProductContext';
import { SubscriptionProvider, useSubscriptions } from './contexts/SubscriptionContext';
import { CashProvider, useCash } from './contexts/CashContext';
import { MarketingProvider, useMarketing } from './contexts/MarketingContext';
import { AppointmentProvider, useAppointments } from './contexts/AppointmentContext';
import { Appointment, Service, Professional, OperatingHours, FinancialTransaction, PaymentMethod, PaymentMethodType } from './types';

// --- UTILITÁRIOS ---
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

// ==========================================
// 1. COMPONENTES DE SUPORTE (MODALS & CARDS)
// ==========================================

const KpiCard = ({ label, value, icon: Icon, color, bg, trend }: any) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
      <div><p className="text-slate-500 text-xs font-bold uppercase tracking-tight">{label}</p><h3 className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3></div>
    </div>
  </div>
);

const ProgressBar = ({ current, target, colorClass = 'bg-indigo-600', label }: { current: number, target: number, colorClass?: string, label?: string }) => {
    const percentage = Math.min(100, Math.max(0, (current / target) * 100));
    let finalColor = colorClass;
    if (percentage < 50) finalColor = 'bg-red-500';
    else if (percentage < 80) finalColor = 'bg-amber-500';
    else finalColor = 'bg-emerald-500';
    return (
        <div className="w-full">
            <div className="flex justify-between mb-1 text-xs font-bold uppercase text-slate-500">
                <span>{label || 'Progresso'}</span>
                <span>{percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${finalColor}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

// ==========================================
// 2. TELAS PRINCIPAIS (AUTH, ADMIN, CLIENT)
// ==========================================

// --- PÁGINA DE AUTENTICAÇÃO ---
const AuthPage: React.FC = () => {
  const { signIn } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn({ email, password, isRegister: isRegistering, name: isRegistering ? name : undefined, role: 'professional' });
    } catch (err: any) {
      setError(err.message || 'Erro na autenticação.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-[1.5rem] mb-6 border border-slate-800">
            <Flame className="text-red-600" size={40} fill="currentColor" />
          </div>
          <h1 className="text-5xl font-heading font-black text-white tracking-tighter italic uppercase">BURN <span className="text-red-600">APP</span></h1>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleAuth} className="space-y-6">
            <h3 className="text-white font-black text-2xl uppercase italic tracking-tight">{isRegistering ? 'Criar Conta' : 'Acessar Painel'}</h3>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs font-bold">{error}</div>}
            <div className="space-y-4">
              {isRegistering && (
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-red-600" placeholder="Nome da Barbearia" />
              )}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-red-600" placeholder="E-mail" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-red-600" placeholder="Senha" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase italic py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3">
              {loading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'Cadastrar' : 'Entrar')}
            </button>
          </form>
          <div className="mt-8 text-center border-t border-slate-800 pt-6">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-slate-500 text-sm hover:text-white transition-colors">
              {isRegistering ? 'Já tem conta? Login' : 'Ainda não é parceiro? Começar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE DASHBOARD (ADMIN) ---
const DashboardContent: React.FC = () => {
  const { user } = useAuth();
  const { professionals } = useProfessionals();
  const { appointments } = useAppointments();
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [data, setData] = useState<any>({ revenue: 0, count: 0, avgTicket: 0, mrr: 0, chartData: [], proRanking: [] });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const { data: appts } = await supabase.from('appointments').select('*').eq('client_id', user.id).eq('status', 'COMPLETED');
      const safe = appts || [];
      const revenue = safe.reduce((acc, curr) => acc + (curr.total_value || 0), 0);
      const count = safe.length;
      const avgTicket = count > 0 ? revenue / count : 0;
      
      const ranking = professionals.map(pro => ({
        id: pro.id,
        name: pro.name,
        revenue: safe.filter(a => a.professional_id === pro.id).reduce((acc, a) => acc + (a.total_value || 0), 0)
      })).sort((a, b) => b.revenue - a.revenue);

      setData({ revenue, count, avgTicket, proRanking: ranking, chartData: [] });
    };
    fetchData();
  }, [user, professionals, appointments]);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard label="Faturamento Bruto" value={formatCurrency(data.revenue)} icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" />
        <KpiCard label="Atendimentos" value={data.count} icon={Scissors} color="text-indigo-500" bg="bg-indigo-500/10" />
        <KpiCard label="Ticket Médio" value={formatCurrency(data.avgTicket)} icon={TrendingUp} color="text-amber-500" bg="bg-amber-500/10" />
      </div>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
        <h3 className="text-xl font-bold text-white mb-6">Performance por Barbeiro</h3>
        <div className="space-y-4">
          {data.proRanking.map((pro: any) => (
            <div key={pro.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
              <span className="font-bold text-white">{pro.name}</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(pro.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE AGENDA (ADMIN) ---
const AgendaContent: React.FC = () => {
    const { professionals } = useProfessionals();
    const { appointments, fetchAppointments } = useAppointments();
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => { fetchAppointments(selectedDate); }, [selectedDate]);

    return (
        <div className="h-full flex flex-col animate-in fade-in">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d);}} className="p-2 bg-slate-800 rounded-full text-white"><ChevronLeft/></button>
                    <span className="font-bold text-white capitalize">{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d);}} className="p-2 bg-slate-800 rounded-full text-white"><ChevronRight/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {professionals.map(pro => (
                        <div key={pro.id} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6">
                            <h3 className="font-bold text-white border-b border-slate-800 pb-4 mb-4 flex items-center gap-2">
                                <User size={18} className="text-indigo-500" /> {pro.name}
                            </h3>
                            <div className="space-y-3">
                                {appointments.filter(a => a.barberId === pro.id).map(appt => (
                                    <div key={appt.id} className="p-4 bg-slate-950 rounded-xl border-l-4 border-l-indigo-600">
                                        <p className="text-xs text-slate-500 font-bold">{new Date(appt.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                        <p className="text-white font-bold">{appt.clientName}</p>
                                    </div>
                                ))}
                                {appointments.filter(a => a.barberId === pro.id).length === 0 && <p className="text-slate-600 text-sm italic">Sem horários para hoje.</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE FINANCEIRO (ADMIN) ---
const FinancialContent: React.FC = () => {
    return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] animate-in fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Módulo Financeiro</h2>
            <p className="text-slate-400">Gerencie entradas, saídas e comissões da equipe aqui.</p>
            {/* Placeholder para brevidade, pode expandir conforme necessário */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2"><ArrowUpRight className="text-emerald-500"/> Receitas</h4>
                    <span className="text-3xl font-black text-white">R$ 0,00</span>
                </div>
                <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2"><ArrowDownRight className="text-red-500"/> Despesas</h4>
                    <span className="text-3xl font-black text-white">R$ 0,00</span>
                </div>
            </div>
        </div>
    );
}

// --- PAINEL ADMINISTRATIVO (PRINCIPAL) ---
const AdminDashboard: React.FC<{onLogout: () => void}> = ({ onLogout }) => {
  const [view, setView] = useState<'dashboard' | 'agenda' | 'financeiro' | 'settings'>('dashboard');
  const { shopProfile } = useTheme();

  return (
    <div className="h-screen bg-slate-950 flex font-sans">
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><Flame className="text-white" fill="currentColor"/></div>
          <h1 className="font-bold text-white text-lg truncate">{shopProfile.name}</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setView('agenda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${view === 'agenda' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}><CalendarIcon size={18}/> Agenda</button>
          <button onClick={() => setView('financeiro')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm ${view === 'financeiro' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}><DollarSign size={18}/> Financeiro</button>
        </nav>
        <button onClick={onLogout} className="flex items-center gap-3 text-slate-500 font-bold text-sm px-4 py-3 hover:text-red-500 transition-colors"><LogOut size={18}/> Sair</button>
      </aside>
      <main className="flex-1 p-10 overflow-y-auto custom-scrollbar">
        {view === 'dashboard' && <DashboardContent />}
        {view === 'agenda' && <AgendaContent />}
        {view === 'financeiro' && <FinancialContent />}
      </main>
    </div>
  );
};

// --- DASHBOARD DO CLIENTE ---
const ClientDashboard: React.FC<{onLogout: () => void}> = ({ onLogout }) => {
    const { user } = useAuth();
    const { fetchClientAppointments } = useAppointments();
    const [appointments, setAppointments] = useState<Appointment[]>([]);

    useEffect(() => {
        if (user) fetchClientAppointments(user.id).then(setAppointments);
    }, [user]);

    return (
        <div className="min-h-screen bg-slate-950 p-6 pb-24">
            <header className="flex justify-between items-center mb-10">
                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">BURN <span className="text-red-600">CLIENT</span></h1>
                <button onClick={onLogout} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500"><LogOut/></button>
            </header>
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[2.5rem] border border-slate-800 mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Olá, {user?.user_metadata?.name || 'Cliente'}!</h2>
                <p className="text-indigo-300 text-sm">Acompanhe seus agendamentos e saldo de pontos.</p>
            </div>
            <h3 className="font-bold text-white mb-4">Seus Próximos Atendimentos</h3>
            <div className="space-y-4">
                {appointments.map(a => (
                    <div key={a.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex justify-between items-center">
                        <div>
                            <p className="text-white font-bold">{a.items.map(i => i.name).join(', ')}</p>
                            <p className="text-slate-500 text-xs">{new Date(a.startTime).toLocaleString('pt-BR')}</p>
                        </div>
                        <span className="text-indigo-400 font-bold">R$ {a.totalValue.toFixed(2)}</span>
                    </div>
                ))}
                {appointments.length === 0 && <p className="text-slate-600 italic">Nenhum serviço agendado.</p>}
            </div>
        </div>
    );
}

// --- PÁGINA DE AGENDAMENTO PÚBLICO (CLIENTE EXTERNO) ---
const CustomerBooking: React.FC = () => {
  const shopId = new URLSearchParams(window.location.search).get('shop');
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (shopId) {
        supabase.from('services').select('*').eq('client_id', shopId).then(({data}) => {
            if (data) setServices(data.map(s => ({ id: s.id, name: s.name, price: s.price, durationMinutes: s.duration_minutes })) as any);
        });
    }
  }, [shopId]);

  const handleBooking = async () => {
    if (!selectedService || !clientName || !clientPhone) return;
    const { error } = await supabase.from('appointments').insert([{
        client_id: shopId,
        client_name: clientName,
        start_time: new Date().toISOString(), // Simplificado para exemplo de build
        duration_minutes: selectedService.durationMinutes,
        status: 'CONFIRMED',
        total_value: selectedService.price,
        items: [{ id: selectedService.id, name: selectedService.name, price: selectedService.price, type: 'service' }]
    }]);
    if (!error) setSuccess(true);
  };

  if (success) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
          <CheckCircle size={64} className="text-emerald-500 mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">Reserva Confirmada!</h2>
          <p className="text-slate-500">Seu horário foi agendado com sucesso na barbearia.</p>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-20">
        <div className="max-w-xl mx-auto space-y-10">
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">AGENDAMENTO <span className="text-red-600">ONLINE</span></h1>
            {step === 1 && (
                <div className="space-y-4 animate-in fade-in">
                    <p className="text-slate-500 font-bold uppercase text-xs">Escolha o serviço:</p>
                    {services.map(s => (
                        <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left hover:border-indigo-500 transition-all flex justify-between items-center">
                            <span className="text-white font-bold">{s.name}</span>
                            <span className="text-indigo-400 font-bold">R$ {s.price.toFixed(2)}</span>
                        </button>
                    ))}
                </div>
            )}
            {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <button onClick={() => setStep(1)} className="text-slate-500 flex items-center gap-2"><ChevronLeft size={16}/> Voltar</button>
                    <div className="space-y-4">
                        <input type="text" placeholder="Seu Nome" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                        <input type="tel" placeholder="Seu WhatsApp" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-red-600" />
                    </div>
                    <button onClick={handleBooking} className="w-full bg-red-600 p-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl">Confirmar Reserva</button>
                </div>
            )}
        </div>
    </div>
  );
};

// ==========================================
// 3. ROTEAMENTO E APLICAÇÃO FINAL
// ==========================================

const AppContent: React.FC = () => {
  const { user, role, loading, signOut } = useAuth();
  const isPublicBooking = window.location.search.includes('shop=');

  if (isPublicBooking) return <CustomerBooking />;

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>
  );

  if (!user) return <AuthPage />;

  return role === 'professional' ? <AdminDashboard onLogout={signOut} /> : <ClientDashboard onLogout={signOut} />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ClientProvider>
          <ProfessionalProvider>
            <ServiceProvider>
              <ProductProvider>
                <SubscriptionProvider>
                  <CashProvider>
                    <AppointmentProvider>
                      <MarketingProvider>
                        <AppContent />
                      </MarketingProvider>
                    </AppointmentProvider>
                  </CashProvider>
                </SubscriptionProvider>
              </ProductProvider>
            </ServiceProvider>
          </ProfessionalProvider>
        </ClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
