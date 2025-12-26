
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Scissors,
  Lock, Clock, Coffee, CheckCircle2, Hourglass, Timer, RefreshCw
} from 'lucide-react';
import { useAppointments } from '../contexts/AppointmentContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useTheme } from '../contexts/ThemeContext'; 
import { useCash } from '../contexts/CashContext'; 
import { AppointmentDetailsModal } from './AppointmentDetailsModal';
import { BookingModal } from './BookingModal';
import { Appointment } from '../types';

export const SmartAgenda: React.FC<any> = ({ onOpenCash }) => {
  const { appointments, fetchAppointments, addAppointment, updateAppointment, isLoading } = useAppointments();
  const { professionals } = useProfessionals();
  const { operatingHours, agendaDisplayUntil, theme } = useTheme(); 
  const { isCashOpen } = useCash();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingInitialData, setBookingInitialData] = useState<any>(undefined);

  const slotInterval = theme.agendaInterval || 30;

  useEffect(() => { fetchAppointments(selectedDate); }, [selectedDate, fetchAppointments]);

  const daySettings = useMemo(() => {
    return operatingHours.find(d => d.dayIndex === selectedDate.getDay());
  }, [selectedDate, operatingHours]);

  const timeSlots = useMemo(() => {
    const slots = [];
    const [startHour, startMinute] = (daySettings?.isOpen ? daySettings.start : '08:00').split(':').map(Number);
    const [limitHour, limitMinute] = agendaDisplayUntil.split(':').map(Number);

    let currentTime = new Date(selectedDate);
    currentTime.setHours(startHour, startMinute, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(limitHour, limitMinute, 0, 0);

    if (endTime <= currentTime) endTime.setHours(23, 59, 0, 0);

    while (currentTime <= endTime) {
      slots.push(new Date(currentTime));
      currentTime.setMinutes(currentTime.getMinutes() + slotInterval);
    }
    return slots;
  }, [selectedDate, daySettings, agendaDisplayUntil, slotInterval]);

  const isSlotBlockedBySchedule = (slot: Date, pro: any) => {
      const schedule = pro.workSchedule;
      if (!schedule) return { blocked: false, reason: '' };
      const timeString = slot.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      if (timeString < schedule.start || timeString >= schedule.end) return { blocked: true, reason: 'CLOSED' };
      if (schedule.lunchStart && schedule.lunchEnd && timeString >= schedule.lunchStart && timeString < schedule.lunchEnd) return { blocked: true, reason: 'LUNCH' };
      return { blocked: false, reason: '' };
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData('appointmentId', id);
      // Feedback visual
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '0.4';
      }
  };

  const handleDragEnd = (e: React.DragEvent) => {
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '1';
      }
  };

  const handleDrop = async (e: React.DragEvent, slotDate: Date, proId: string) => {
      e.preventDefault();
      const appointmentId = e.dataTransfer.getData('appointmentId');
      if (!appointmentId) return;

      const appt = appointments.find(a => a.id === appointmentId);
      if (!appt) return;

      // Não permitir mover se estiver completo ou for bloqueio
      if (appt.status === 'COMPLETED' || appt.status === 'BLOCKED') {
          alert('Este agendamento não pode ser movido.');
          return;
      }

      try {
          await updateAppointment(appointmentId, {
              startTime: slotDate.toISOString(),
              barberId: proId
          });
      } catch (err) {
          console.error('Erro ao mover agendamento:', err);
      }
  };

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-900 h-full w-full overflow-hidden">
      <div className="flex-shrink-0 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row justify-between items-center z-20 shadow-sm gap-4">
         <div className="flex items-center gap-4">
            <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d);}} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"><ChevronLeft size={20}/></button>
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
               <CalendarIcon size={18} className="text-indigo-500"/>
               <span className="font-bold text-lg text-slate-900 dark:text-white capitalize whitespace-nowrap">{selectedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
            </div>
            <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d);}} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"><ChevronRight size={20}/></button>
         </div>
         <div className="flex items-center gap-4">
             {isLoading && <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold animate-pulse"><RefreshCw size={14} className="animate-spin" /> Sincronizando...</div>}
             <button onClick={() => { if(!isCashOpen) onOpenCash?.(); else { setBookingInitialData({date: selectedDate, proId: professionals[0]?.id, professionals}); setIsBookingOpen(true); } }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95"><Plus size={20}/> Novo Agendamento</button>
         </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-900">
           <div className="min-w-full h-full flex flex-col">
              <div className="sticky top-0 z-10 flex border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm">
                 <div className="w-24 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-950 font-black text-xs uppercase tracking-widest">Hora</div>
                 {professionals.map(pro => (
                    <div key={pro.id} className="flex-1 min-w-[200px] p-5 text-center border-r border-slate-200 dark:border-slate-800">
                       <div className="flex flex-col items-center gap-3">
                          <div className="relative">
                            <img src={pro.avatarUrl || `https://ui-avatars.com/api/?name=${pro.name}`} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500 p-0.5 shadow-md" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                          </div>
                          <h3 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-[0.1em]">{pro.name}</h3>
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="flex-1 relative">
                 {timeSlots.map((slot, index) => (
                    <div key={index} className="flex border-b border-slate-100 dark:border-slate-800/50 min-h-[90px]">
                       <div className="w-24 flex-shrink-0 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-950/30">{slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                       {professionals.map(pro => {
                          const sched = isSlotBlockedBySchedule(slot, pro);
                          
                          const slotAppointments = appointments.filter(a => { 
                             const aptTime = new Date(a.startTime); 
                             const isSameTime = aptTime.getHours() === slot.getHours() && 
                                               aptTime.getMinutes() === slot.getMinutes();
                             const isSamePro = a.barberId === pro.id;
                             return isSamePro && isSameTime && a.status !== 'CANCELED'; 
                          });
                          
                          if (sched.blocked && slotAppointments.length === 0) return (
                             <div key={pro.id} className="flex-1 border-r border-slate-800 bg-slate-950/20 flex items-center justify-center opacity-40">
                                {sched.reason === 'LUNCH' ? <Coffee size={16} className="text-slate-600"/> : <Lock size={16} className="text-slate-700"/>}
                             </div>
                          );
                          
                          return (
                             <div 
                                key={pro.id} 
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, slot, pro.id)}
                                className="flex-1 border-r border-slate-100 dark:border-slate-800 relative group min-h-[90px] p-1 flex flex-col gap-1"
                             >
                                {slotAppointments.map(appointment => (
                                  <div 
                                    key={appointment.id}
                                    draggable={appointment.status !== 'COMPLETED' && appointment.status !== 'BLOCKED'}
                                    onDragStart={(e) => handleDragStart(e, appointment.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => setSelectedAppointment(appointment)} 
                                    className={`relative z-10 rounded-xl p-3 cursor-pointer shadow-md border-l-[4px] transition-all hover:scale-[1.02] hover:z-20 w-full ${
                                        appointment.status === 'BLOCKED' ? 'bg-slate-700 border-slate-900 text-slate-300' : 
                                        appointment.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-700 text-white' : 
                                        'bg-indigo-600 border-indigo-800 text-white'
                                    }`} 
                                    style={{ 
                                        minHeight: '80px',
                                        height: slotAppointments.length > 1 ? 'auto' : `${Math.max(80, (appointment.durationMinutes / slotInterval) * 90 - 12)}px`
                                    }}
                                  >
                                     <div className="flex justify-between items-start gap-1">
                                        <div className="flex-1 min-w-0">
                                            <span className="font-black text-[11px] truncate uppercase block tracking-tight">{appointment.clientName}</span>
                                            {appointment.status !== 'BLOCKED' && (
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-0.5 border ${
                                                    appointment.status === 'COMPLETED' 
                                                    ? 'bg-white/20 border-white/20 text-white' 
                                                    : 'bg-amber-400 border-amber-500 text-amber-900 shadow-sm'
                                                }`}>
                                                    {appointment.status === 'COMPLETED' ? 'Fechado' : 'Pendente'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-75 mt-0.5">
                                            <Timer size={10} />
                                            <span className="text-[9px] font-bold">{appointment.durationMinutes}m</span>
                                        </div>
                                     </div>
                                     <span className="text-[10px] block opacity-90 mt-1.5 font-medium italic line-clamp-2">
                                        {appointment.items && appointment.items.length > 0 
                                            ? appointment.items.map(i => i.name).join(' + ') 
                                            : 'Sem itens'}
                                     </span>
                                     {appointment.status === 'COMPLETED' && <CheckCircle2 size={12} className="absolute bottom-2 right-2 text-white/50" />}
                                  </div>
                                ))}
                                
                                <button 
                                    onClick={() => { if(!isCashOpen) onOpenCash?.(); else { setBookingInitialData({date: slot, proId: pro.id, professionals}); setIsBookingOpen(true); } }} 
                                    className={`w-full h-full min-h-[40px] rounded-lg border-2 border-dashed border-transparent transition-all flex items-center justify-center ${slotAppointments.length > 0 ? 'opacity-0 group-hover:opacity-100 bg-indigo-500/5 border-indigo-500/20' : 'opacity-0 group-hover:opacity-100 bg-indigo-500/5'}`}
                                >
                                    <Plus size={slotAppointments.length > 0 ? 16 : 24} className="text-indigo-500" strokeWidth={3} />
                                </button>
                             </div>
                          );
                       })}
                    </div>
                 ))}
                 <div className="h-40"></div>
              </div>
           </div>
      </div>

      {selectedAppointment && <AppointmentDetailsModal isOpen={!!selectedAppointment} onClose={() => setSelectedAppointment(null)} appointment={selectedAppointment} />}
      {isBookingOpen && <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} initialData={bookingInitialData} onConfirm={addAppointment} />}
    </div>
  );
};
