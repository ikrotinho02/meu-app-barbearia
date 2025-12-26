
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useServices } from '../contexts/ServiceContext';
import { useAppointments } from '../contexts/AppointmentContext';
import { useSubscriptions, SubscriptionPlan } from '../contexts/SubscriptionContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients } from '../contexts/ClientContext';
import { useMarketing } from '../contexts/MarketingContext';
import { Service, Appointment, ServiceCategory, Professional } from '../types';
import { SubscriptionCheckoutModal } from '../components/SubscriptionCheckoutModal';
import { 
  Flame, 
  Calendar, 
  Clock, 
  CheckCircle, 
  User, 
  Scissors, 
  LogOut, 
  Crown,
  History,
  Plus,
  Home,
  ChevronRight,
  X,
  CreditCard,
  Check,
  Megaphone,
  MapPin,
  ChevronLeft,
  Star,
  Sparkles,
  Bell,
  Search,
  Package
} from 'lucide-react';

interface ClientDashboardProps {
  onLogout: () => void;
}

// --- SUB-COMPONENTS ---

const ViewHeader = ({ title, onBack }: { title: string, onBack: () => void }) => (
    <div className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-red-900/30 px-6 py-4 flex items-center gap-4 animate-in slide-in-from-top-2 shadow-lg shadow-red-900/10">
        <button 
            onClick={onBack} 
            className="p-2 -ml-2 rounded-full bg-slate-900 text-white hover:bg-red-900/50 transition-all border border-red-500/20"
        >
            <ChevronLeft size={24}/>
        </button>
        <h2 className="text-xl font-heading font-bold text-white tracking-wide">{title}</h2>
    </div>
);

// 1. NEW BOOKING VIEW (Multi-step, Multi-select, Categories)
const BookingView = ({ onBack, onSuccess }: { onBack: () => void, onSuccess: () => void }) => {
    const { user } = useAuth();
    const { services, isLoading: isLoadingServices, refreshServices } = useServices();
    const { professionals } = useProfessionals();
    const { addAppointment, fetchAppointments } = useAppointments(); 
    const { operatingHours } = useTheme();

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [selectedProfessional, setSelectedProfessional] = useState<string | 'any' | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<'morning' | 'afternoon' | 'night' | 'all'>('all');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    useEffect(() => { refreshServices(); }, []);

    // Task 2: Filter professionals by selected service categories
    const filteredProfessionals = useMemo(() => {
        if (selectedServices.length === 0) return professionals;
        // Fix: Explicitly type the Set as string to avoid 'unknown' type inference in some environments
        const requiredCategories = new Set<string>(selectedServices.map(s => s.category || 'Outros'));
        
        return professionals.filter(pro => {
            // If pro has no specialties defined, assume they do everything for safety
            if (!pro.specialties || pro.specialties.length === 0) return true;
            // Check if pro has at least one specialty matching one of selected services categories
            return Array.from(requiredCategories).some(cat => 
                // Fix: Ensure cat and spec are treated as strings to solve 'unknown' type property access error
                pro.specialties.some(spec => (spec as string).toLowerCase() === (cat as string)?.toLowerCase())
            );
        });
    }, [selectedServices, professionals]);

    const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);

    const groupedServices = useMemo<Record<string, Service[]>>(() => {
        const groups: Record<string, Service[]> = { 'Cabelo': [], 'Barba': [], 'Estética': [], 'Química': [], 'Outros': [] };
        services.forEach(s => {
            const cat = s.category || 'Outros';
            if (groups[cat]) groups[cat].push(s);
            else groups['Outros'].push(s);
        });
        return groups;
    }, [services]);

    useEffect(() => { if (selectedDate) loadSlots(); }, [selectedDate, selectedProfessional, totalDuration]);

    const loadSlots = async () => {
        setIsLoadingSlots(true);
        const dateObj = new Date(selectedDate);
        dateObj.setHours(12, 0, 0, 0); 
        const shopAppointments = await fetchAppointments(dateObj); 
        const dayIndex = dateObj.getDay();
        const settings = operatingHours.find(d => d.dayIndex === dayIndex);
        if (!settings || !settings.isOpen) { setAvailableSlots([]); setIsLoadingSlots(false); return; }

        const slots: string[] = [];
        const [startH, startM] = settings.start.split(':').map(Number);
        const [endH, endM] = settings.end.split(':').map(Number);
        let current = new Date(dateObj);
        current.setHours(startH, startM, 0, 0);
        const end = new Date(dateObj);
        end.setHours(endH, endM, 0, 0);

        while (current < end) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current.getTime() + (totalDuration || 30) * 60000); 
            const isBlocked = shopAppointments.some(appt => {
                if (appt.status === 'CANCELED') return false;
                const apptStart = new Date(appt.startTime);
                const apptEnd = new Date(apptStart.getTime() + appt.durationMinutes * 60000);
                const overlap = (slotStart < apptEnd && slotEnd > apptStart);
                if (overlap) {
                    if (selectedProfessional === 'any') return false;
                    return appt.barberId === selectedProfessional;
                }
                return false;
            });

            let finalBlocked = isBlocked;
            if (selectedProfessional === 'any' && !isBlocked) {
                 const busyProsCount = shopAppointments.filter(appt => {
                     if (appt.status === 'CANCELED') return false;
                     const apptStart = new Date(appt.startTime);
                     const apptEnd = new Date(apptStart.getTime() + appt.durationMinutes * 60000);
                     return (slotStart < apptEnd && slotEnd > apptStart);
                 }).map(a => a.barberId).filter((v, i, a) => a.indexOf(v) === i).length;
                 if (busyProsCount >= filteredProfessionals.length) finalBlocked = true;
            }

            if (!finalBlocked) slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            current.setMinutes(current.getMinutes() + 30); 
        }
        setAvailableSlots(slots);
        setIsLoadingSlots(false);
    };

    const handleServiceToggle = (service: Service) => {
        if (selectedServices.find(s => s.id === service.id)) {
            setSelectedServices(prev => prev.filter(s => s.id !== service.id));
        } else {
            setSelectedServices(prev => [...prev, service]);
        }
    };

    const handleConfirm = async () => {
        if (selectedServices.length === 0 || !selectedDate || !selectedTimeSlot || !user) return;
        const [h, m] = selectedTimeSlot.split(':').map(Number);
        const start = new Date(selectedDate);
        start.setHours(h, m, 0, 0);
        
        // Task 3: Ensure barberId is correct
        const finalProId = selectedProfessional === 'any' ? (filteredProfessionals[0]?.id || '') : selectedProfessional;
        
        await addAppointment({
            clientId: user.id, 
            clientName: user.user_metadata?.name || 'Cliente App',
            barberId: finalProId || '', // Task 3 focus
            startTime: start.toISOString(),
            durationMinutes: totalDuration,
            status: 'SCHEDULED',
            totalValue: totalPrice,
            items: selectedServices.map(s => ({ 
                id: s.id, name: s.name, price: s.price, type: 'service', durationMinutes: s.durationMinutes 
            })),
            notes: selectedProfessional === 'any' ? 'Sem preferência de profissional' : ''
        });
        onSuccess();
    };

    const filteredSlots = useMemo<string[]>(() => {
        if (periodFilter === 'all') return availableSlots;
        return availableSlots.filter(slot => {
            const h = parseInt(slot.split(':')[0]);
            if (periodFilter === 'morning') return h < 12;
            if (periodFilter === 'afternoon') return h >= 12 && h < 18;
            if (periodFilter === 'night') return h >= 18;
            return true;
        });
    }, [availableSlots, periodFilter]);

    return (
        <div className="pb-32 bg-slate-950 min-h-screen">
            <ViewHeader 
                title={step === 1 ? 'Escolha os Serviços' : step === 2 ? 'Profissional' : step === 3 ? 'Data e Horário' : 'Confirmar'} 
                onBack={step === 1 ? onBack : () => setStep(prev => (prev - 1) as any)}
            />

            <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4">
                {step === 1 && (
                    <div className="space-y-8">
                        {isLoadingServices ? (
                            <div className="py-20 text-center flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div>
                                <p className="text-slate-500 font-medium text-sm">Buscando serviços...</p>
                            </div>
                        ) : services.length === 0 ? (
                            <div className="py-20 text-center bg-slate-900/50 rounded-[2.5rem] border border-slate-800 border-dashed p-10 flex flex-col items-center">
                                <Scissors size={40} className="text-slate-600 mb-6" />
                                <h3 className="text-slate-300 font-bold text-xl mb-2">Catálogo Vazio</h3>
                            </div>
                        ) : (
                            Object.entries(groupedServices).map(([category, items]) => {
                                const serviceItems = items as Service[];
                                if (serviceItems.length === 0) return null;
                                return (
                                    <div key={category}>
                                        <h3 className="font-bold text-red-500 uppercase text-[10px] mb-4 tracking-widest pl-2 opacity-80">{category}</h3>
                                        <div className="space-y-3">
                                            {serviceItems.map(s => {
                                                const isSelected = selectedServices.some(sel => sel.id === s.id);
                                                return (
                                                    <button key={s.id} onClick={() => handleServiceToggle(s)}
                                                        className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden group shadow-lg ${
                                                            isSelected ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-500' : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                                                        }`}>
                                                        <div className="flex justify-between items-center relative z-10">
                                                            <div>
                                                                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{s.name}</span>
                                                                <p className={`text-xs mt-1 flex items-center gap-2 ${isSelected ? 'text-red-200' : 'text-slate-500'}`}>
                                                                    <Clock size={12}/> {s.durationMinutes} min
                                                                </p>
                                                            </div>
                                                            <span className={`text-xl font-bold font-heading ${isSelected ? 'text-white' : 'text-slate-300'}`}>R$ {s.price.toFixed(2)}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <button onClick={() => { setSelectedProfessional('any'); setStep(3); }}
                            className={`w-full flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all shadow-lg ${
                                selectedProfessional === 'any' ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-500' : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                            }`}>
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${selectedProfessional === 'any' ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                <Clock size={28} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className={`font-bold text-lg ${selectedProfessional === 'any' ? 'text-white' : 'text-slate-200'}`}>Sem preferência</h3>
                            </div>
                        </button>

                        <h3 className="font-bold text-red-500 uppercase text-[10px] pt-6 pl-2 tracking-widest opacity-80">Profissionais Disponíveis</h3>
                        <div className="space-y-3">
                            {filteredProfessionals.map(pro => {
                                const isSelected = selectedProfessional === pro.id;
                                return (
                                    <button key={pro.id} onClick={() => { setSelectedProfessional(pro.id); setStep(3); }}
                                        className={`w-full flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all shadow-lg ${
                                            isSelected ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-500 shadow-red-900/40' : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                                        }`}>
                                        <img src={pro.avatarUrl || `https://ui-avatars.com/api/?name=${pro.name}`} alt="" className="w-16 h-16 rounded-2xl object-cover"/>
                                        <div className="text-left flex-1">
                                            <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-slate-200'}`}>{pro.name}</h3>
                                            <p className={`text-sm ${isSelected ? 'text-red-100' : 'text-slate-400'}`}>{pro.role}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-8">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                            <h3 className="font-bold text-red-500 uppercase text-[10px] mb-4 tracking-widest opacity-80">Selecione o Dia</h3>
                            <div className="relative">
                                <input type="date" className="w-full p-6 bg-slate-950 border border-slate-800 rounded-3xl text-white text-lg focus:outline-none"
                                    min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                                <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" size={24}/>
                            </div>
                        </div>

                        {selectedDate && (
                            <div className="grid grid-cols-3 gap-3">
                                {filteredSlots.map(slot => (
                                    <button key={slot} onClick={() => setSelectedTimeSlot(slot)}
                                        className={`py-4 rounded-2xl text-sm font-bold border-2 transition-all ${
                                            selectedTimeSlot === slot ? 'bg-red-600 text-white border-red-600' : 'bg-slate-900 text-slate-300 border-slate-800'
                                        }`}>{slot}</button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-red-900 to-slate-950 border border-red-900/50 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-center border-b border-white/10 pb-6">
                                    <div>
                                        <h3 className="text-white font-heading font-bold text-3xl">{selectedTimeSlot}</h3>
                                        <p className="text-slate-300 text-sm capitalize mt-1">{new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                    </div>
                                    <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center text-red-400"><Calendar size={28} /></div>
                                </div>
                                <div className="space-y-4">
                                    {selectedServices.map(s => (
                                        <div key={s.id} className="flex justify-between items-center">
                                            <span className="text-slate-200 font-medium text-sm">{s.name}</span>
                                            <span className="text-slate-300 font-mono text-sm">R$ {s.price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <span className="text-slate-400 font-medium text-sm">Profissional</span>
                                        <span className="text-white font-bold text-sm">
                                            {selectedProfessional === 'any' ? 'Qualquer disponível' : filteredProfessionals.find(p => p.id === selectedProfessional)?.name}
                                        </span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                                    <span className="text-red-300 font-bold text-xs">Total Estimado</span>
                                    <span className="text-white font-heading font-bold text-4xl">R$ {totalPrice.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedServices.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 p-6 z-50">
                    <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{selectedServices.length} ITEM(S)</span>
                            <span className="text-2xl font-bold text-white font-heading">R$ {totalPrice.toFixed(2)}</span>
                        </div>
                        {step < 4 ? (
                            <button onClick={() => setStep(prev => (prev + 1) as any)} disabled={step === 2 && !selectedProfessional || step === 3 && !selectedTimeSlot}
                                className="bg-white text-slate-950 px-8 py-4 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-50">Continuar <ChevronRight size={20} /></button>
                        ) : (
                            <button onClick={handleConfirm} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2">Confirmar <CheckCircle size={20} /></button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// 2. MAIN CLIENT DASHBOARD
export const ClientDashboard: React.FC<ClientDashboardProps> = ({ onLogout }) => {
    const { user } = useAuth();
    const { shopProfile } = useTheme();
    const { clients } = useClients();
    const { fetchClientAppointments } = useAppointments();
    const { config: marketingConfig } = useMarketing();

    const [view, setView] = useState<'home' | 'history'>('home');
    const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isBooking, setIsBooking] = useState(false);

    const clientInfo = useMemo(() => clients.find(c => c.id === user?.id), [clients, user]);

    useEffect(() => { if (user) loadHistory(); }, [user]);

    const loadHistory = async () => {
        if (!user) return;
        setIsLoadingHistory(true);
        const data = await fetchClientAppointments(user.id);
        setMyAppointments(data);
        setIsLoadingHistory(false);
    };

    if (isBooking) return <BookingView onBack={() => setIsBooking(false)} onSuccess={() => { setIsBooking(false); loadHistory(); }} />;

    const nextAppointment = myAppointments.find(a => a.status === 'SCHEDULED' && new Date(a.startTime) > new Date());

    return (
        <div className="min-h-screen bg-slate-950 pb-32">
            <header className="px-6 pt-8 pb-4 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center"><Flame size={18} className="text-white" fill="currentColor" /></div>
                        <h1 className="text-xl font-heading font-bold text-white tracking-tight">{shopProfile.name}</h1>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">{shopProfile.slogan}</p>
                </div>
                <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800"><LogOut size={20} /></button>
            </header>

            <div className="px-6 space-y-8 animate-in fade-in duration-500">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10 flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Olá, {user?.user_metadata?.name?.split(' ')[0] || 'Cliente'}! 👋</h2>
                            <p className="text-slate-500 text-sm">Que bom te ver por aqui.</p>
                        </div>
                        {clientInfo?.subscriptionStatus === 'ACTIVE' && <div className="bg-amber-500/10 text-amber-500 p-2 rounded-xl"><Crown size={24} fill="currentColor" /></div>}
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Seu Saldo</span>
                            <div className="flex items-center gap-1.5"><Sparkles size={16} className="text-amber-500" /><span className="text-2xl font-heading font-bold text-white">{clientInfo?.cashback_balance || 0}</span></div>
                        </div>
                        <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Última Visita</span>
                            <div className="flex items-center gap-1.5"><History size={16} className="text-red-500" /><span className="text-sm font-bold text-white">{myAppointments[0] ? new Date(myAppointments[0].startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}</span></div>
                        </div>
                    </div>
                </div>

                {nextAppointment && (
                    <div className="bg-red-600/10 border border-red-500/20 rounded-3xl p-6 flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white"><Clock size={24} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Próximo Agendamento</h4>
                                <p className="text-xs text-red-400">{new Date(nextAppointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-red-500" />
                    </div>
                )}

                {view === 'home' ? (
                   <div className="space-y-4">
                        <div className="flex justify-between items-center px-2"><h3 className="font-bold text-white text-lg font-heading">Visitas Recentes</h3><button onClick={() => setView('history')} className="text-red-500 text-xs font-bold uppercase tracking-widest">Ver Todas</button></div>
                        <div className="space-y-3">
                            {isLoadingHistory ? <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div></div> :
                             myAppointments.length === 0 ? <div className="p-10 bg-slate-900/30 rounded-3xl text-center border border-slate-800 border-dashed text-slate-500">Nenhum serviço realizado.</div> :
                             myAppointments.slice(0, 3).map(appt => (
                                <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-emerald-500"><CheckCircle size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-white text-sm">{appt.items.map(i => i.name).join(', ')}</h4>
                                            <p className="text-[10px] text-slate-500 uppercase">{new Date(appt.startTime).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-white">R$ {appt.totalValue.toFixed(2)}</span>
                                </div>
                             ))}
                        </div>
                   </div>
                ) : (
                    <div className="space-y-4">
                        <ViewHeader title="Histórico Completo" onBack={() => setView('home')} />
                        {myAppointments.map(appt => (
                            <div key={appt.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
                                <div><h4 className="font-bold text-white text-sm">{appt.items.map(i => i.name).join(', ')}</h4><p className="text-xs text-slate-500">{new Date(appt.startTime).toLocaleString('pt-BR')}</p></div>
                                <span className="text-sm font-bold text-emerald-500">R$ {appt.totalValue.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fixed bottom-8 left-6 right-6 z-50">
                <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 flex items-center justify-between">
                    <button onClick={() => { setView('home'); setIsBooking(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 ${view === 'home' && !isBooking ? 'text-red-500' : 'text-slate-500'}`}><Home size={24}/><span className="text-[9px] font-black uppercase">Início</span></button>
                    <button onClick={() => setIsBooking(true)} className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center text-white shadow-lg -translate-y-6 border-4 border-slate-950"><Plus size={32} /></button>
                    <button onClick={() => { setView('history'); setIsBooking(false); }} className={`flex-1 flex flex-col items-center gap-1 py-3 ${view === 'history' && !isBooking ? 'text-red-500' : 'text-slate-500'}`}><History size={24}/><span className="text-[9px] font-black uppercase">Histórico</span></button>
                </div>
            </div>
        </div>
    );
};
