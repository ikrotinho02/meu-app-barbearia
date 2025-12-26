import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Check, ChevronDown, Calendar, Clock, Lock, User, Save, ArrowLeft, Coffee, Timer } from 'lucide-react';
import { useClients } from '../contexts/ClientContext';
import { useServices } from '../contexts/ServiceContext';
import { Client, Service, Professional } from '../types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    date: Date;
    proId: string;
    professionals: Professional[];
  };
  onConfirm: (data: any) => Promise<void>;
}

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, initialData, onConfirm }) => {
  const { clients, addClient } = useClients();
  const { services } = useServices();
  
  const [isTimeOff, setIsTimeOff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedProId, setSelectedProId] = useState(initialData?.proId || '');
  
  const [timeOffReason, setTimeOffReason] = useState('');
  const [timeOffDuration, setTimeOffDuration] = useState('60');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [selectedTime, setSelectedTime] = useState(
    initialData?.date ? initialData.date.toTimeString().slice(0, 5) : '09:00'
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedClient) {
      setEmail(selectedClient.email || '');
      setPhone(selectedClient.phone || '');
      setBirthDate(selectedClient.birth_date ? new Date(selectedClient.birth_date).toISOString().split('T')[0] : '');
      setSearchTerm(selectedClient.name);
      setIsClientDropdownOpen(false);
    } 
  }, [selectedClient]);

  useEffect(() => {
      if (searchTerm === '' && selectedClient) {
          setSelectedClient(null);
          setEmail('');
          setPhone('');
          setBirthDate('');
      } else if (selectedClient && searchTerm !== selectedClient.name) {
          setSelectedClient(null);
          setEmail('');
          setPhone('');
          setBirthDate('');
      }
  }, [searchTerm]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients.slice(0, 5); 
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleServiceToggle = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
    } else {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const handleConfirm = async () => {
    if (!selectedProId) {
        alert('Selecione um profissional para realizar o atendimento.');
        return;
    }
    
    if (isTimeOff) {
        if (!timeOffReason.trim()) {
            alert('Por favor, informe o motivo da folga/bloqueio.');
            return;
        }
        if (!timeOffDuration || parseInt(timeOffDuration) <= 0) {
            alert('Por favor, informe a quantidade de tempo (duração) para o bloqueio.');
            return;
        }
    } else {
        if (!selectedClient && !searchTerm.trim()) {
            alert('Por favor, selecione um cliente existente ou digite o nome de um novo cliente.');
            return;
        }
        if (!selectedClient && searchTerm.trim() && !phone.trim()) {
            alert('Para cadastrar um novo cliente, o número de Celular é obrigatório.');
            return;
        }
        if (selectedServices.length === 0) {
            alert('Por favor, selecione qual serviço será realizado.');
            return;
        }
    }

    setIsSubmitting(true);
    try {
        let finalClient = selectedClient;
        if (!isTimeOff && !finalClient && searchTerm.trim()) {
            const newClientData = {
                name: searchTerm,
                phone: phone,
                email: email,
                birth_date: birthDate
            };
            const createdClient = await addClient(newClientData);
            if (createdClient) finalClient = createdClient;
            else throw new Error('Falha ao criar cliente automático.');
        }

        const baseDate = initialData?.date || new Date();
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const finalDate = new Date(baseDate);
        finalDate.setHours(hours, minutes, 0, 0);

        const duration = isTimeOff ? parseInt(timeOffDuration) : selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
        const totalPrice = isTimeOff ? 0 : selectedServices.reduce((acc, s) => acc + s.price, 0);

        const payload = {
          barberId: selectedProId,
          clientId: isTimeOff ? 'timeoff' : finalClient!.id,
          clientName: isTimeOff ? timeOffReason : finalClient!.name,
          startTime: finalDate.toISOString(),
          durationMinutes: isTimeOff ? duration : (duration || 30),
          status: isTimeOff ? 'BLOCKED' : 'SCHEDULED',
          totalValue: totalPrice,
          items: isTimeOff ? [] : selectedServices.map(s => ({
            id: s.id, name: s.name, price: s.price, type: 'service', durationMinutes: s.durationMinutes
          })),
          notes: isTimeOff ? 'Bloqueio administrativo' : ''
        };

        await onConfirm(payload);
        onClose();
    } catch (err: any) {
        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert('Erro ao salvar agendamento: ' + msg);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentProfessionalName = initialData?.professionals.find(p => p.id === selectedProId)?.name || 'Profissional';
  const displayDate = initialData?.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className={`px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center ${isTimeOff ? 'bg-slate-100 dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-950'}`}>
            <div className="flex flex-col">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{isTimeOff ? 'Bloqueio de Agenda' : 'Novo Agendamento'}</span>
                <span className="font-bold text-slate-900 dark:text-white text-lg">{currentProfessionalName}</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{displayDate}</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
          <div className="space-y-6">
            {isTimeOff ? (
                <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 flex items-start gap-3">
                        <Coffee className="text-slate-500 mt-1" size={20} />
                        <div><h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Definir Folga ou Pausa</h4><p className="text-xs text-slate-500 mt-1">Isso criará um bloqueio na agenda impedindo novos agendamentos neste período.</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motivo do Bloqueio</label>
                            <input type="text" autoFocus value={timeOffReason} onChange={(e) => setTimeOffReason(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500" placeholder="Ex: Almoço, Médico, Folga Pessoal..."/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Horário Início</label>
                            <div className="relative">
                                <input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"/>
                                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantidade de Tempo</label>
                            <div className="relative">
                                <input type="number" min="15" step="15" value={timeOffDuration} onChange={(e) => setTimeOffDuration(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium pointer-events-none">minutos</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cliente</label>
                        <div className="relative">
                            <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsClientDropdownOpen(true); }} onFocus={() => setIsClientDropdownOpen(true)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none transition-colors placeholder:text-slate-400" placeholder="Nome do cliente..."/>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">{selectedClient ? <Check size={18} className="text-emerald-500"/> : <Search size={18} className="text-slate-400"/>}</div>
                        </div>
                        {isClientDropdownOpen && searchTerm && !selectedClient && (
                            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                {filteredClients.map(client => (
                                    <button key={client.id} onClick={() => setSelectedClient(client)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <div><span className="font-bold text-slate-900 dark:text-white block text-sm">{client.name}</span><span className="text-xs text-slate-500">{client.phone}</span></div>
                                        <User size={14} className="text-slate-400 group-hover:text-indigo-500" />
                                    </button>
                                ))}
                                {filteredClients.length === 0 && <div className="p-3 text-center"><p className="text-xs text-slate-500">Cliente não encontrado.</p><p className="text-[10px] text-indigo-500 font-bold mt-1">Preencha os dados abaixo para cadastrar.</p></div>}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Serviços</label>
                        <button onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)} className="w-full text-left bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white flex justify-between items-center outline-none focus:ring-1 focus:ring-indigo-500 min-h-[48px]">
                            <span className={`truncate text-sm ${selectedServices.length === 0 ? 'text-slate-400' : ''}`}>{selectedServices.length > 0 ? selectedServices.map(s => s.name).join(', ') : 'Selecione os serviços...'}</span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {isServiceDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2">
                                {services.map(svc => {
                                    const isSelected = selectedServices.some(s => s.id === svc.id);
                                    return (
                                        <div key={svc.id} onClick={() => handleServiceToggle(svc)} className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer mb-1 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <div className="flex flex-col"><span className={`text-sm font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{svc.name}</span><span className="text-xs text-slate-500">R$ {svc.price.toFixed(2)} • {svc.durationMinutes} min</span></div>
                                            {isSelected && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Celular {selectedClient ? '' : '*'}</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm" placeholder="(00) 00000-0000"/></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm" placeholder="cliente@email.com"/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Horário</label><div className="relative"><input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm font-bold"/><Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/></div></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Aniversário</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-sm text-slate-500"/></div>
                    </div>
                </>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between gap-3">
            <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold text-sm transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
            <div className="flex gap-3">
                <button onClick={() => { setIsTimeOff(!isTimeOff); if(!isTimeOff) { setSelectedClient(null); setSelectedServices([]); } else { setTimeOffReason(''); } }} className={`px-6 py-3 font-bold rounded-xl text-sm transition-colors flex items-center gap-2 ${isTimeOff ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{isTimeOff ? <ArrowLeft size={16}/> : <Lock size={16}/>}{isTimeOff ? 'Voltar' : 'Folga'}</button>
                <button onClick={handleConfirm} disabled={isSubmitting} className={`px-8 py-3 text-white font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isTimeOff ? 'bg-slate-700 hover:bg-slate-600 shadow-slate-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}>{isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Save size={18} /> {isTimeOff ? 'Bloquear Horário' : 'Salvar'}</>}</button>
            </div>
        </div>
      </div>
    </div>
  );
};