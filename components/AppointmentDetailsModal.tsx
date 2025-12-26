
import React, { useState } from 'react';
import { X, Clock, User, Calendar, DollarSign, Scissors, Trash2, AlertTriangle, Coffee, Lock, CheckCircle2, RotateCcw, RefreshCw, Check, Edit2 } from 'lucide-react';
import { Appointment } from '../types';
import { useAppointments } from '../contexts/AppointmentContext';
import { useCash } from '../contexts/CashContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useAuth } from '../contexts/AuthContext';
import { CheckoutModal } from './CheckoutModal';
import { supabase } from '../services/dbClient';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({ isOpen, onClose, appointment }) => {
  const { user } = useAuth();
  const { cancelAppointment, updateAppointment, fetchAppointments } = useAppointments();
  const { deleteTransactionByAppointmentId } = useCash();
  /* Fix: Removed property 'deleteTransactionsByAppointmentId' that does not exist on ProfessionalContextType */
  const { professionals } = useProfessionals();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [newTime, setNewTime] = useState(new Date(appointment.startTime).toTimeString().slice(0, 5));

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isOpen) return null;

  const isBlocked = appointment.status === 'BLOCKED';
  const isCompleted = appointment.status === 'COMPLETED';

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await cancelAppointment(appointment.id);
      onClose();
    } catch (e) {
      console.error('Error deleting:', e);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleReopen = async () => {
    const appointmentId = appointment.id;
    setIsReopening(true);

    try {
      // 1. Tenta atualizar o status no banco
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'CONFIRMED' }) 
        .eq('id', appointmentId)
        .select(); 

      if (error) {
        console.error("ERRO NO SUPABASE:", error);
        alert("Erro do Banco: " + error.message);
        setIsReopening(false);
        return;
      }

      if (data) {
        console.log("Status atualizado com sucesso");
        
        // 2. Remove as transações financeiras vinculadas
        // Remove comissões
        await supabase
          .from('service_transactions')
          .delete()
          .eq('appointment_id', appointmentId);
        
        // Remove do fluxo de caixa (via context para manter sync local se necessário)
        await deleteTransactionByAppointmentId(appointmentId);

        // 3. Atualiza a lista de agendamentos e fecha o modal
        // Em vez de window.location.reload(), usamos o refresh do context
        await fetchAppointments(new Date(appointment.startTime));
        onClose(); 
      }
    } catch (err: any) {
      console.error("ERRO FATAL NA REABERTURA:", err);
      alert("Erro crítico: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsReopening(false);
    }
  };

  const handleUpdateTime = async () => {
    if (!newTime) return;
    setIsUpdating(true);
    try {
      const [hours, minutes] = newTime.split(':').map(Number);
      const currentStart = new Date(appointment.startTime);
      currentStart.setHours(hours, minutes, 0, 0);
      
      await updateAppointment(appointment.id, {
        startTime: currentStart.toISOString()
      });
      setIsEditingTime(false);
      onClose();
    } catch (err) {
      console.error('Erro ao atualizar horário:', err);
      alert('Erro ao atualizar horário.');
    } finally {
      setIsUpdating(false);
    }
  };

  const start = new Date(appointment.startTime);
  const end = new Date(start.getTime() + appointment.durationMinutes * 60000);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${isBlocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-950'}`}>
           <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
             {isBlocked ? <><Lock size={18}/> Detalhes do Bloqueio</> : 'Detalhes do Agendamento'}
           </h3>
           <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 space-y-6">
           
           {isBlocked ? (
               <div className="flex flex-col items-center justify-center py-4">
                   <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                       <Coffee size={32} className="text-slate-500" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Folga / Pausa</h2>
                   <p className="text-lg text-slate-600 dark:text-slate-400 font-medium italic">"{appointment.clientName}"</p>
               </div>
           ) : (
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                     {appointment.clientName ? appointment.clientName[0] : <User size={24} />}
                  </div>
                  <div>
                     <p className="text-xs text-slate-500 uppercase font-bold">Cliente</p>
                     <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                          {appointment.clientName}
                        </h2>
                        {isCompleted ? (
                          <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-emerald-500/20">Fechado</span>
                        ) : !isBlocked && (
                          <span className="bg-amber-400/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-amber-500/20">Pendente</span>
                        )}
                     </div>
                  </div>
               </div>
           )}

           <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                     <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><Calendar size={12}/> Data</p>
                     <p className="font-semibold text-slate-800 dark:text-slate-200">{start.toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                     <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><Clock size={12}/> Horário Atual</p>
                     <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                     </p>
                  </div>
              </div>

              {!isCompleted && !isBlocked && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      {isEditingTime ? (
                          <div className="flex items-center gap-3 animate-in slide-in-from-top-2">
                              <div className="flex-1">
                                  <label className="text-[10px] font-black text-indigo-500 uppercase block mb-1">Novo Horário</label>
                                  <input 
                                    type="time" 
                                    value={newTime} 
                                    onChange={e => setNewTime(e.target.value)} 
                                    className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg p-2 text-white font-bold outline-none"
                                  />
                              </div>
                              <div className="flex items-end h-full gap-2 pb-1 pt-4">
                                  <button onClick={handleUpdateTime} disabled={isUpdating} className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
                                      {isUpdating ? <RefreshCw className="animate-spin" size={16}/> : <Check size={16}/>}
                                  </button>
                                  <button onClick={() => setIsEditingTime(false)} className="p-2.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">
                                      <X size={16}/>
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <button 
                            onClick={() => setIsEditingTime(true)}
                            className="text-xs font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5 py-1 px-2 hover:bg-indigo-500/10 rounded transition-all"
                          >
                              <Edit2 size={12}/> Alterar horário do atendimento
                          </button>
                      )}
                  </div>
              )}
           </div>

           {!isBlocked && (
               <div>
                  <p className="text-xs text-slate-500 uppercase font-bold mb-2">Serviços</p>
                  <div className="space-y-2">
                     {appointment.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                           <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <Scissors size={14} className="text-indigo-500"/> {item.name}
                           </span>
                           <span className="font-bold text-sm text-slate-900 dark:text-white">R$ {item.price.toFixed(2)}</span>
                        </div>
                     ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                     <span className="font-bold text-slate-600 dark:text-slate-400">Total</span>
                     <span className="font-bold text-xl text-emerald-500">R$ {appointment.totalValue.toFixed(2)}</span>
                  </div>
               </div>
           )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
           {!showConfirm ? (
             <div className="flex justify-between gap-3">
               <button 
                 onClick={handleDeleteClick}
                 className="px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-red-200 dark:border-red-900/50"
               >
                 <Trash2 size={16} /> {isBlocked ? 'Cancelar folga' : 'Excluir'}
               </button>
               
               <div className="flex gap-2">
                   {isCompleted && (
                       <button 
                         onClick={handleReopen}
                         disabled={isReopening}
                         className="px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl text-sm font-bold transition-colors border border-amber-500/30 flex items-center gap-2"
                       >
                         {isReopening ? <RefreshCw className="animate-spin" size={16}/> : <RotateCcw size={16} />} 
                         Reabrir
                       </button>
                   )}

                   <button 
                     onClick={onClose}
                     className="px-6 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-sm font-bold transition-colors"
                   >
                     Fechar
                   </button>
                   
                   {!isBlocked && !isCompleted && (
                       <button 
                         onClick={() => setIsCheckoutOpen(true)}
                         className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                       >
                         <DollarSign size={16} /> Checkout
                       </button>
                   )}
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center gap-2 text-slate-500 text-sm">
                 <AlertTriangle size={16} className="text-amber-500"/>
                 <span>{isBlocked ? 'Cancelar folga?' : 'Excluir agendamento?'}</span>
               </div>
               <div className="flex gap-2">
                 <button 
                   onClick={() => setShowConfirm(false)}
                   disabled={isDeleting}
                   className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold"
                 >
                   Manter
                 </button>
                 <button 
                   onClick={handleConfirmDelete}
                   disabled={isDeleting}
                   className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 flex items-center gap-2"
                 >
                   {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                 </button>
               </div>
             </div>
           )}
        </div>

      </div>
    </div>

    <CheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        appointment={appointment}
        onConfirm={() => {
            setIsCheckoutOpen(false);
            onClose();
        }}
    />
    </>
  );
};
