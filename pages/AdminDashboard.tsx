
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/dbClient'; 
import { 
  LayoutDashboard, Calendar, Users, Scissors, ShoppingBag, Settings, LogOut, 
  Bell, TrendingUp, DollarSign, Menu, Briefcase, PieChart, Crown, Flame,
  Save, Wallet, Lock, Unlock, Moon, Sun, Clock, Store, Image as ImageIcon, 
  Check, Globe, Activity, Target, Megaphone, Zap, Palette, Loader2,
  CheckCircle2, AlertCircle, Copy, CheckCircle, Share2, Rocket, ArrowRight, Pipette
} from 'lucide-react';
import { Dashboard } from '../components/Dashboard'; 
import { CashFlow } from '../components/CashFlow';
import { SmartAgenda } from '../components/SmartAgenda';
import { Clients } from '../components/Clients';
import { Professionals } from '../components/Professionals';
import { Reports } from '../components/Reports';
import { Financial } from '../components/Financial';
import { Products } from '../components/Products';
import { Services } from '../components/Services';
import { Subscriptions } from '../components/Subscriptions';
import { OpenCashModal } from '../components/OpenCashModal'; 
import { OwnerSubscriptionModal } from '../components/OwnerSubscriptionModal';
import { Goals } from '../components/Goals'; 
import { useTheme } from '../contexts/ThemeContext'; 
import { useCash } from '../contexts/CashContext'; 
import { useAuth } from '../contexts/AuthContext'; 
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useServices } from '../contexts/ServiceContext';

const PRESET_COLORS = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Gold Premium', hex: '#D4AF37' },
  { name: 'Navy Blue', hex: '#000080' },
  { name: 'British Racing Green', hex: '#004225' },
  { name: 'Slate Gray', hex: '#708090' },
  { name: 'Deep Black', hex: '#0A0A0A' },
  { name: 'Chocolate', hex: '#3E2723' },
];

const AGENDA_INTERVALS = [
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hora' },
];

export const AdminDashboard: React.FC<any> = ({ onLogout }) => {
  const { user } = useAuth();
  const { professionals } = useProfessionals();
  const { services } = useServices();
  
  const [currentView, setCurrentView] = useState<any>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<'success' | 'error' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const { 
    shopProfile, setShopProfile, saveSettingsToDb, theme, setTheme,
    toggleTheme, updateBrandColor, operatingHours, setOperatingHours,
    applyHoursToAll, agendaDisplayUntil, setAgendaDisplayUntil, isLoadingSettings
  } = useTheme();

  const { isCashOpen, isLoading: isLoadingCash, refreshCashStatus } = useCash();
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
        refreshCashStatus();
    }
  }, [user, refreshCashStatus]);

  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('19:00');

  const isNewUser = useMemo(() => {
    return professionals.length === 0 || services.length === 0;
  }, [professionals.length, services.length]);

  const shopPublicLink = useMemo(() => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?shop=${user?.id}`;
  }, [user?.id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shopPublicLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      await saveSettingsToDb();
      setSaveFeedback('success');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (error) {
      console.error(error);
      setSaveFeedback('error');
      setTimeout(() => setSaveFeedback(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSingleDay = (index: number, updates: any) => {
    const newHours = [...operatingHours];
    newHours[index] = { ...newHours[index], ...updates };
    setOperatingHours(newHours);
  };

  const NavItem = ({ icon: Icon, label, active, onClick, isPremium }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold group ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-indigo-500'}`}>
      <Icon size={18} className={active ? 'text-white' : isPremium ? 'text-amber-500' : 'text-slate-400 group-hover:text-indigo-500'} />
      <span className={isPremium ? 'text-amber-500' : ''}>{label}</span>
    </button>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 mt-6">
      {title}
    </h3>
  );

  const getViewTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Dashboard';
      case 'reports': return 'Relatórios Avançados';
      case 'agenda': return 'Agenda Inteligente';
      case 'cash': return 'Caixa';
      case 'clients': return 'Gestão de Clientes';
      case 'team': return 'Equipe e Comissões';
      case 'services': return 'Serviços';
      case 'products': return 'Estoque e Produtos';
      case 'finance': return 'Financeiro';
      case 'subscriptions': return 'Clube de Assinaturas';
      case 'settings': return 'Configurações';
      case 'goals': return 'Metas e Objetivos';
      default: return currentView;
    }
  };

  if (isLoadingSettings) {
      return (
          <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={48} />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando seu ambiente...</p>
          </div>
      );
  }

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans flex overflow-hidden transition-colors duration-300">
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col h-full shadow-xl`}>
        <div className="h-24 flex items-center px-6 border-b border-slate-200 dark:border-slate-800/50 flex-shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
                <Flame className="text-white" size={24} fill="currentColor" />
             </div>
             <div className="min-w-0">
                <h1 className="font-bold text-sm text-slate-900 dark:text-white truncate">{shopProfile.name}</h1>
                <p className="text-[10px] text-indigo-500 font-black uppercase truncate">{shopProfile.slogan || 'Painel Gestor'}</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar space-y-1">
          <SectionTitle title="Principal" />
          <NavItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={Calendar} label="Agenda Inteligente" active={currentView === 'agenda'} onClick={() => setCurrentView('agenda')} />
          <NavItem icon={Wallet} label="Caixa" active={currentView === 'cash'} onClick={() => setCurrentView('cash')} />
          <NavItem icon={Users} label="Gestão de Clientes" active={currentView === 'clients'} onClick={() => setCurrentView('clients')} />
          <NavItem icon={Crown} label="Clube de Assinaturas" active={currentView === 'subscriptions'} onClick={() => setCurrentView('subscriptions')} isPremium />

          <SectionTitle title="Gestão" />
          <NavItem icon={Target} label="Metas e Objetivos" active={currentView === 'goals'} onClick={() => setCurrentView('goals')} />
          <NavItem icon={Briefcase} label="Equipe e Comissões" active={currentView === 'team'} onClick={() => setCurrentView('team')} />
          <NavItem icon={Scissors} label="Serviços" active={currentView === 'services'} onClick={() => setCurrentView('services')} />
          <NavItem icon={PieChart} label="Relatórios Avançados" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
          <NavItem icon={DollarSign} label="Financeiro" active={currentView === 'finance'} onClick={() => setCurrentView('finance')} />
          <NavItem icon={ShoppingBag} label="Produtos e Estoque" active={currentView === 'products'} onClick={() => setCurrentView('products')} />
          
          <SectionTitle title="Sistema" />
          <NavItem icon={Settings} label="Configurações" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <button onClick={onLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-all font-bold text-xs uppercase tracking-wider">
             <LogOut size={16} /> Sair do Sistema
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-20">
           <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                <Menu size={24} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {getViewTitle()}
              </h2>
           </div>
           
           <div className="flex items-center gap-4">
              {saveFeedback && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 shadow-lg ${saveFeedback === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {saveFeedback === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                  {saveFeedback === 'success' ? 'Salvo com sucesso' : 'Ocorreu um erro ao salvar'}
                </div>
              )}
              {currentView === 'settings' && (
                <button onClick={handleSaveSettings} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all">
                  {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                  Salvar e Sincronizar
                </button>
              )}
           </div>
        </header>

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${currentView === 'agenda' ? '' : 'p-8'}`}>
           
           {isNewUser && currentView === 'dashboard' ? (
              <div className="max-w-4xl mx-auto py-12 space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Rocket size={180}/></div>
                     <div className="relative z-10 max-w-xl">
                        <h1 className="text-4xl font-heading font-extrabold mb-4">Bem-vindo à Chama do Sucesso! 🔥</h1>
                        <p className="text-indigo-100 text-lg mb-8">Para começar a usar o Burn App, precisamos configurar os pilares da sua barbearia. Leva menos de 2 minutos.</p>
                        
                        <div className="space-y-4">
                           <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                              <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold">1</div>
                              <span className="font-bold flex-1">Cadastre o primeiro Profissional</span>
                              <button onClick={() => setCurrentView('team')} className="bg-white text-indigo-600 px-4 py-1.5 rounded-xl text-xs font-black uppercase">Começar</button>
                           </div>
                           <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                              <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold">2</div>
                              <span className="font-bold flex-1">Crie seu catálogo de Serviços</span>
                              <button onClick={() => setCurrentView('services')} className="bg-white text-indigo-600 px-4 py-1.5 rounded-xl text-xs font-black uppercase">Começar</button>
                           </div>
                           <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 opacity-50">
                              <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold">3</div>
                              <span className="font-bold flex-1">Tudo Pronto! Divulgue seu link</span>
                              <Check size={20}/>
                           </div>
                        </div>
                     </div>
                  </div>
              </div>
           ) : (
             <>
               {currentView === 'dashboard' && (
                 <div className="space-y-8">
                   <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row items-center gap-8 group">
                      <div className="p-6 bg-indigo-500/10 text-indigo-500 rounded-[2rem] group-hover:scale-110 transition-transform">
                        <Share2 size={40} />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Sua Agenda Online está Ativa!</h3>
                        <p className="text-slate-500 mb-4">Compartilhe este link único com seus clientes para que eles agendem sozinhos.</p>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl">
                           <Globe size={18} className="text-slate-400 ml-2" />
                           <input readOnly value={shopPublicLink} className="bg-transparent border-none text-xs font-mono text-indigo-400 flex-1 outline-none px-2 truncate" />
                           <button onClick={handleCopyLink} className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${copiedLink ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg'}`}>
                              {copiedLink ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar Link</>}
                           </button>
                        </div>
                      </div>
                   </div>
                   
                   <Dashboard />
                 </div>
               )}
               
               {currentView === 'agenda' && (
                   isLoadingCash ? <LoadingState /> : (isCashOpen ? <SmartAgenda onOpenCash={() => setIsCashModalOpen(true)} /> : <ClosedCashView onOpen={() => setIsCashModalOpen(true)} />)
               )}
               {currentView === 'cash' && (
                   isLoadingCash ? <LoadingState /> : (isCashOpen ? <CashFlow /> : <ClosedCashView onOpen={() => setIsCashModalOpen(true)} />)
               )}
               
               {currentView === 'reports' && <Reports />}
               {currentView === 'clients' && <Clients />}
               {currentView === 'team' && <Professionals />}
               {currentView === 'services' && <Services />}
               {currentView === 'products' && <Products />}
               {currentView === 'goals' && <Goals />}
               {currentView === 'finance' && <Financial />}
               {currentView === 'subscriptions' && <Subscriptions />}
               
               {currentView === 'settings' && (
                 <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4">
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
                       <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Store size={20} className="text-indigo-500"/> Perfil da Barbearia</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nome da Unidade</label>
                             <input type="text" value={shopProfile.name} onChange={e => setShopProfile({...shopProfile, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" />
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Slogan / Frase Curta</label>
                             <input type="text" value={shopProfile.slogan} onChange={e => setShopProfile({...shopProfile, slogan: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" />
                          </div>
                          <div className="md:col-span-2">
                             <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Novidades / Comunicados (Aparece para clientes)</label>
                             <textarea value={shopProfile.news} onChange={e => setShopProfile({...shopProfile, news: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500 h-24" />
                          </div>
                       </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
                       <div className="flex items-start gap-4 mb-8">
                          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl"><Calendar size={24} /></div>
                          <div className="flex-1">
                             <h3 className="text-lg font-bold text-white mb-1">Horário de Funcionamento</h3>
                             <p className="text-slate-500 text-sm">Defina quando sua barbearia está disponível para agendamentos públicos.</p>
                          </div>
                       </div>

                       <div className="mb-10 bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1">
                               <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1 flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Alteração em Bloco</h4>
                               <p className="text-slate-500 text-[10px]">Aplique horários padronizados rapidamente.</p>
                            </div>
                            <div className="flex items-center gap-4">
                               <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-white text-xs font-bold" />
                               <span className="text-slate-600">até</span>
                               <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-white text-xs font-bold" />
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => applyHoursToAll(bulkStart, bulkEnd, false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold transition-all">Todos os Dias</button>
                               <button onClick={() => applyHoursToAll(bulkStart, bulkEnd, true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg">Dias Úteis</button>
                            </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {operatingHours.map((h, idx) => (
                             <div key={h.dayIndex} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${h.isOpen ? 'bg-slate-950 border-slate-800' : 'bg-slate-900/50 border-transparent opacity-60'}`}>
                                <div className="flex items-center gap-4">
                                   <button 
                                     onClick={() => updateSingleDay(idx, { isOpen: !h.isOpen })}
                                     className={`w-12 h-6 rounded-full relative transition-colors ${h.isOpen ? 'bg-emerald-600' : 'bg-slate-700'}`}
                                   >
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${h.isOpen ? 'right-1' : 'left-1'}`} />
                                   </button>
                                   <span className="text-sm font-bold text-white w-20">{h.dayName}</span>
                                </div>

                                {h.isOpen ? (
                                   <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                      <input type="time" value={h.start} onChange={e => updateSingleDay(idx, { start: e.target.value })} className="bg-slate-900 border border-slate-700 p-2 rounded text-white text-xs font-mono" />
                                      <span className="text-slate-600">às</span>
                                      <input type="time" value={h.end} onChange={e => updateSingleDay(idx, { end: e.target.value })} className="bg-slate-900 border border-slate-700 p-2 rounded text-white text-xs font-mono" />
                                   </div>
                                ) : (
                                   <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mr-4">Fechado</span>
                                )}
                             </div>
                          ))}
                       </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
                       <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Palette size={20} className="text-indigo-500"/> Identidade e Tema</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Cor da Marca</label>
                             <div className="flex flex-wrap gap-3 mb-6">
                                {PRESET_COLORS.map(c => (
                                   <button key={c.hex} onClick={() => updateBrandColor(c.hex)} title={c.name} className={`w-10 h-10 rounded-full border-4 transition-all ${theme.brandColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c.hex }} />
                                ))}
                             </div>
                             
                             {/* Novo Seletor RGB/Custom */}
                             <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Pipette size={12}/> Personalizada (RGB/HEX)</label>
                                <div className="flex items-center gap-3">
                                   <input 
                                     type="color" 
                                     value={theme.brandColor} 
                                     onChange={(e) => updateBrandColor(e.target.value)}
                                     className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer overflow-hidden transition-transform active:scale-95"
                                   />
                                   <div className="flex-1 relative">
                                       <input 
                                         type="text" 
                                         value={theme.brandColor} 
                                         onChange={(e) => updateBrandColor(e.target.value)}
                                         placeholder="#000000"
                                         className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono uppercase text-center outline-none focus:border-indigo-500 shadow-inner"
                                       />
                                   </div>
                                </div>
                             </div>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Esquema de Cores</label>
                             <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <button onClick={() => theme.mode === 'dark' && toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${theme.mode === 'light' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}><Sun size={18}/> Claro</button>
                                <button onClick={() => theme.mode === 'light' && toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${theme.mode === 'dark' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}><Moon size={18}/> Escuro</button>
                             </div>
                          </div>
                       </div>

                       <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
                           <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Clock size={20} className="text-indigo-500"/> Configurações de Agenda</h3>
                           <div className="max-w-md">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Divisão de Slots (Tempo de Grade)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {AGENDA_INTERVALS.map(interval => (
                                        <button 
                                            key={interval.value}
                                            onClick={() => setTheme({ ...theme, agendaInterval: interval.value as any })}
                                            className={`py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                                                theme.agendaInterval === interval.value 
                                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/40' 
                                                : 'bg-slate-100 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                                            }`}
                                        >
                                            {interval.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-3 italic">* Alterar o intervalo mudará a visualização da agenda, mas não afetará agendamentos existentes.</p>
                           </div>
                       </div>
                    </section>
                 </div>
               )}
             </>
           )}
        </div>
      </main>

      <OpenCashModal isOpen={isCashModalOpen} onClose={() => setIsCashModalOpen(false)} />
      <OwnerSubscriptionModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} plan={{ id: 'pro', name: 'Burn Pro', price: 97.00 }} />
    </div>
  );
};

const LoadingState = () => (
    <div className="h-full flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Sincronizando estado do caixa...</p>
    </div>
);

const ClosedCashView = ({ onOpen }: any) => (
  <div className="h-full flex items-center justify-center p-12 w-full animate-in fade-in zoom-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-[3rem] text-center max-w-md shadow-2xl">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Lock size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Caixa Fechado</h2>
          <p className="text-slate-500 mb-8">Para realizar agendamentos, checkouts ou qualquer operação financeira, você precisa abrir o caixa do dia.</p>
          <button onClick={onOpen} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
              <Unlock size={20}/> Abrir Caixa Agora
          </button>
      </div>
  </div>
);
