
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/dbClient';
import { 
  Flame, 
  Scissors, 
  User, 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle,
  Smartphone,
  Info,
  Check,
  Star,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { Service, Professional, OperatingHours, Appointment } from '../types';

export const CustomerBooking: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [shopData, setShopData] = useState<any>(null);
  const [brandColor, setBrandColor] = useState('#6366f1'); // Default Indigo
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState(false);

  // 1. CARREGAR DADOS DA BARBEARIA E CONFIGURAÇÕES
  useEffect(() => {
    const loadPublicData = async () => {
      if (!shopId) {
        setLoading(false);
        return;
      }
      try {
        // Busca Perfil do Lojista
        const { data: shop } = await supabase.from('clients').select('*').eq('id', shopId).single();
        if (shop) {
          setShopData(shop);
        }

        // Busca Configurações de Identidade Visual (Cores e Horários)
        const { data: settingsData } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', shopId)
            .maybeSingle();
        
        if (settingsData?.settings) {
            const s = settingsData.settings;
            if (s.theme?.brandColor) setBrandColor(s.theme.brandColor);
            if (s.operatingHours) setOperatingHours(s.operatingHours);
        }

        // Busca Serviços Disponíveis
        const { data: svcs } = await supabase.from('services').select('*').eq('client_id', shopId);
        if (svcs) setServices(svcs.map(s => ({
            id: s.id, 
            name: s.name, 
            price: s.price, 
            durationMinutes: s.duration_minutes, 
            category: s.category 
        })) as any);

        // Busca Profissionais Ativos
        const { data: pros } = await supabase.from('professionals').select('*').eq('client_id', shopId).eq('status', 'ACTIVE');
        if (pros) setProfessionals(pros.map(p => ({
            id: p.id, 
            name: p.name, 
            role: p.role, 
            avatarUrl: p.avatar_url, 
            specialties: p.specialties 
        })) as any);

      } catch (err) {
        console.error("Erro ao carregar dados da barbearia:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPublicData();
  }, [shopId]);

  // 2. CALCULAR HORÁRIOS DISPONÍVEIS
  useEffect(() => {
    if (step === 3 && selectedPro && selectedDate) {
        calculateAvailableSlots();
    }
  }, [step, selectedPro, selectedDate]);

  const calculateAvailableSlots = async () => {
    if (!selectedPro || !selectedDate || !shopId) return;
    
    setIsLoadingSlots(true);
    try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23,59,59,999);

        // Busca agendamentos já existentes para este barbeiro no dia
        const { data: dayAppts } = await supabase
            .from('appointments')
            .select('*')
            .eq('professional_id', selectedPro.id)
            .neq('status', 'CANCELED')
            .gte('start_time', startOfDay.toISOString())
            .lte('start_time', endOfDay.toISOString());

        // Verifica configuração de horário de funcionamento para o dia da semana
        const dayIndex = new Date(selectedDate).getUTCDay();
        const dayConfig = operatingHours.find(h => h.dayIndex === dayIndex);
        
        if (!dayConfig || !dayConfig.isOpen) {
            setAvailableSlots([]);
            return;
        }

        const slots: string[] = [];
        const [startH, startM] = dayConfig.start.split(':').map(Number);
        const [endH, endM] = dayConfig.end.split(':').map(Number);
        
        let current = new Date(selectedDate);
        current.setHours(startH, startM, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(endH, endM, 0, 0);

        const serviceDuration = selectedService?.durationMinutes || 30;

        // Loop para gerar slots de 30 em 30 minutos
        while (current < end) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current.getTime() + serviceDuration * 60000);

            // Verifica conflito com agendamentos existentes
            const isOccupied = dayAppts?.some(a => {
                const aStart = new Date(a.start_time);
                const aEnd = new Date(aStart.getTime() + a.duration_minutes * 60000);
                return (slotStart < aEnd && slotEnd > aStart);
            });

            // Adiciona se estiver livre e for no futuro (se for hoje)
            if (!isOccupied) {
                const now = new Date();
                if (slotStart > now) {
                    slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
            }
            current.setMinutes(current.getMinutes() + 30);
        }
        setAvailableSlots(slots);
    } catch (err) {
        console.error("Erro ao carregar horários:", err);
    } finally {
        setIsLoadingSlots(false);
    }
  };

  // 3. CONFIRMAÇÃO FINAL
  const handleFinalConfirm = async () => {
    if (!clientName || !clientPhone || !selectedTime || !selectedPro?.id) {
        alert("Por favor, preencha todos os dados corretamente.");
        return;
    }
    
    setIsSubmitting(true);
    try {
        const [h, m] = selectedTime.split(':').map(Number);
        const start = new Date(selectedDate);
        start.setHours(h, m, 0, 0);
        const duration = selectedService?.durationMinutes || 30;
        const end = new Date(start.getTime() + duration * 60000);

        // Salva agendamento
        const { error } = await supabase.from('appointments').insert([{
            client_id: shopId,
            professional_id: selectedPro.id,
            client_name: clientName,
            customer_id: null, // Agendamento público inicial não vincula cliente logado
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_minutes: duration,
            status: 'CONFIRMED', // Confirmado automaticamente para agendamento externo
            total_value: selectedService?.price || 0,
            notes: `Agendamento Online: WhatsApp ${clientPhone}`,
            items: [{ 
                id: selectedService?.id, 
                name: selectedService?.name, 
                price: selectedService?.price, 
                type: 'service',
                durationMinutes: duration
            }]
        }]);

        if (error) throw error;
        setBookedSuccess(true);
    } catch (err: any) {
        alert("Erro ao confirmar agendamento: " + (err.message || "Tente novamente."));
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-white opacity-40" size={48} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Carregando ambiente...</p>
    </div>
  );

  if (!shopId || !shopData) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-600/10 p-6 rounded-full mb-6 border border-red-600/20">
            <Flame className="text-red-600" size={60} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Página não encontrada</h1>
        <p className="text-slate-400">O link de agendamento parece estar inválido ou expirado.</p>
    </div>
  );

  if (bookedSuccess) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
        <div className="p-6 rounded-[2.5rem] mb-8 shadow-2xl relative" style={{ backgroundColor: brandColor }}>
            <CheckCircle className="text-white" size={64} strokeWidth={3} />
            <div className="absolute inset-0 bg-white/20 rounded-[2.5rem] blur-xl -z-10 animate-pulse"></div>
        </div>
        <h1 className="text-4xl font-heading font-black text-white mb-4 italic uppercase tracking-tighter">Reservado! 🔥</h1>
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl mb-8 max-w-xs w-full">
            <p className="text-slate-400 text-sm mb-4">Seu horário foi garantido para:</p>
            <p className="text-white font-bold text-lg">{new Date(selectedDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
            <p className="text-3xl font-black mt-1" style={{ color: brandColor }}>{selectedTime}</p>
        </div>
        <button 
            onClick={() => window.location.reload()} 
            className="text-slate-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
        >
            Realizar outro agendamento
        </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32">
        <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-900 p-6 flex flex-col items-center gap-2 shadow-2xl">
            <div className="flex items-center gap-3">
                {shopData.avatar_url ? (
                    <img src={shopData.avatar_url} className="w-12 h-12 rounded-2xl object-cover border border-slate-800" alt="Logo" />
                ) : (
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10" style={{ backgroundColor: `${brandColor}20` }}>
                        <Flame size={28} style={{ color: brandColor }} fill="currentColor" />
                    </div>
                )}
                <div className="text-center md:text-left">
                    <h1 className="text-lg font-heading font-black tracking-tight uppercase italic">{shopData.store_name}</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{shopData.slogan || 'Barbearia Premium'}</p>
                </div>
            </div>
        </header>

        <main className="max-w-xl mx-auto p-6 pt-10">
            
            {/* STEP INDICATOR */}
            <div className="flex gap-2 mb-12 px-2">
                {[1, 2, 3, 4].map(s => (
                    /* Fix: Property 'shadowColor' does not exist in React's style Properties type */
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'shadow-[0_0_10px]' : 'bg-slate-800'}`} style={{ backgroundColor: step >= s ? brandColor : undefined }}></div>
                ))}
            </div>

            {/* STEP 1: SERVICES */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="mb-10">
                        <h2 className="text-4xl font-heading font-black italic tracking-tighter uppercase mb-2">Serviços</h2>
                        <p className="text-slate-500 font-medium">Escolha o que deseja realizar hoje.</p>
                    </div>
                    <div className="space-y-4">
                        {services.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => { setSelectedService(s); setStep(2); }} 
                                className="w-full bg-slate-900 border border-slate-800 p-6 rounded-[2rem] text-left flex justify-between items-center hover:border-white/20 transition-all group active:scale-95 shadow-lg"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Scissors size={24} style={{ color: brandColor }} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{s.name}</h3>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase mt-1">
                                            <span className="flex items-center gap-1"><Clock size={12}/> {s.durationMinutes} min</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-black text-white">R$ {s.price.toFixed(2)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: PROFESSIONALS */}
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 mb-8 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">
                        <ChevronLeft size={16}/> Voltar para serviços
                    </button>
                    <div className="mb-10">
                        <h2 className="text-4xl font-heading font-black italic tracking-tighter uppercase mb-2">Profissionais</h2>
                        <p className="text-slate-500 font-medium">Com quem você gostaria de ser atendido?</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {professionals.map(pro => (
                            <button 
                                key={pro.id} 
                                onClick={() => { setSelectedPro(pro); setStep(3); }} 
                                className="w-full bg-slate-900 border border-slate-800 p-5 rounded-[2.5rem] flex items-center gap-5 text-left hover:border-white/20 transition-all group active:scale-95 shadow-lg"
                            >
                                <img src={pro.avatarUrl || `https://ui-avatars.com/api/?name=${pro.name}`} className="w-20 h-20 rounded-3xl object-cover border-2 border-slate-800 group-hover:border-white/20 transition-all shadow-xl" />
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-xl">{pro.name}</h3>
                                    <p className="text-sm text-slate-500 font-medium mt-1">{pro.role}</p>
                                    <div className="flex gap-1 mt-2">
                                        {[1,2,3,4,5].map(i => <Star key={i} size={10} fill="currentColor" className="text-amber-500"/>)}
                                    </div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-full text-slate-700 group-hover:text-white transition-colors">
                                    <ChevronRight size={24} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 3: DATE & TIME */}
            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <button onClick={() => setStep(2)} className="flex items-center gap-2 text-slate-500 mb-8 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">
                        <ChevronLeft size={16}/> Voltar para barbeiros
                    </button>
                    <div className="mb-10">
                        <h2 className="text-4xl font-heading font-black italic tracking-tighter uppercase mb-2">Horário</h2>
                        <p className="text-slate-500 font-medium">Selecione o melhor dia e hora para você.</p>
                    </div>
                    
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl mb-8">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4 ml-1">Data do Atendimento</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                min={new Date().toISOString().split('T')[0]} 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)} 
                                /* Fix: Property 'focusRingColor' does not exist in React's style Properties type */
                                className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:ring-2 appearance-none"
                            />
                            <CalendarIcon className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20}/>
                        </div>
                    </div>

                    {isLoadingSlots ? (
                        <div className="py-20 text-center flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin" size={32} style={{ color: brandColor }} />
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Buscando horários...</p>
                        </div>
                    ) : (
                        availableSlots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {availableSlots.map(slot => (
                                    <button 
                                        key={slot} 
                                        onClick={() => { setSelectedTime(slot); setStep(4); }} 
                                        className={`py-5 rounded-2xl text-sm font-black transition-all border-2 active:scale-90 shadow-md ${
                                            selectedTime === slot ? 'text-white border-transparent' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-white/10'
                                        }`}
                                        style={{ backgroundColor: selectedTime === slot ? brandColor : undefined }}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-slate-900/30 rounded-[2rem] border border-slate-800 border-dashed p-8">
                                <Clock size={40} className="text-slate-700 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Sem horários livres para este dia</p>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* STEP 4: CLIENT FORM */}
            {step === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 space-y-10">
                    <button onClick={() => setStep(3)} className="flex items-center gap-2 text-slate-500 mb-2 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">
                        <ChevronLeft size={16}/> Voltar para horários
                    </button>
                    
                    <div>
                        <h2 className="text-4xl font-heading font-black italic tracking-tighter uppercase mb-2">Finalizar</h2>
                        <p className="text-slate-500 font-medium">Confirme seus dados para reservar.</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 group-hover:scale-110 transition-transform"><CheckCircle size={100} style={{ color: brandColor }} /></div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                                <div className="p-3 bg-white/5 rounded-2xl"><CalendarIcon size={20} style={{ color: brandColor }} /></div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumo da Reserva</p>
                                    <p className="text-lg font-bold text-white mt-0.5">{new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às {selectedTime}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu Nome Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Ex: João Silva" 
                                            value={clientName} 
                                            onChange={e => setClientName(e.target.value)} 
                                            /* Fix: Property 'focusRingColor' does not exist in React's style Properties type */
                                            className="w-full bg-slate-950 border border-slate-800 p-5 pl-12 rounded-2xl text-white outline-none focus:ring-2 shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu WhatsApp</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                                        <input 
                                            type="tel" 
                                            placeholder="(00) 00000-0000" 
                                            value={clientPhone} 
                                            onChange={e => setClientPhone(e.target.value)} 
                                            /* Fix: Property 'focusRingColor' does not exist in React's style Properties type */
                                            className="w-full bg-slate-950 border border-slate-800 p-5 pl-12 rounded-2xl text-white outline-none focus:ring-2 shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-start gap-4">
                        <ShieldCheck className="text-emerald-500 mt-1 flex-shrink-0" size={20} />
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Ao confirmar, seus dados serão enviados para a barbearia e um lembrete poderá ser enviado via WhatsApp próximo ao horário do atendimento.
                        </p>
                    </div>

                    <button 
                        disabled={isSubmitting || !clientName || !clientPhone} 
                        onClick={handleFinalConfirm} 
                        className="w-full text-white font-black uppercase italic tracking-widest py-6 rounded-3xl transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 text-lg"
                        style={{ backgroundColor: brandColor }}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                Confirmando...
                            </>
                        ) : (
                            <>
                                <Check size={24} strokeWidth={3} />
                                Confirmar Agendamento
                            </>
                        )}
                    </button>
                </div>
            )}
        </main>

        {/* FLOATING SUMMARY (STEPS 1-3) */}
        {step < 4 && selectedService && (
            <div className="fixed bottom-0 left-0 right-0 z-40 p-6 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-900 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total a Pagar</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-400">R$</span>
                            <span className="text-3xl font-black text-white tracking-tighter">{selectedService.price.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col items-end">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Passo {step} de 4</p>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full transition-all duration-700" style={{ width: `${(step/4)*100}%`, backgroundColor: brandColor }}></div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
