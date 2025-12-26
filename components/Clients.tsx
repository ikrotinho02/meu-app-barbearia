
import React, { useState, useMemo, useEffect } from 'react';
import { useClients } from '../contexts/ClientContext';
import { 
  Search, 
  Plus, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  MessageCircle, 
  DollarSign, 
  Scissors, 
  Save, 
  Gift,
  Crown,
  Megaphone,
  History
} from 'lucide-react';
import { Client } from '../types';

export const Clients: React.FC = () => {
  const { clients, isLoading, addClient, updateClient, deleteClient } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    how_did_you_know: '',
  });

  const [isOtherSource, setIsOtherSource] = useState(false);
  const [customSource, setCustomSource] = useState('');

  const DEFAULT_SOURCES = ['Instagram', 'Google', 'Indicação', 'Facebook', 'Passou na frente', 'Tiktok'];

  const topSpenderId = useMemo(() => {
    if (clients.length === 0) return null;
    return clients.reduce((max, client) => (client.total_spent > max.total_spent ? client : max), clients[0]).id;
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      client.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const availableSources = useMemo(() => {
      const clientSources = new Set(clients.map(c => c.how_did_you_know).filter(Boolean));
      const combined = new Set([...DEFAULT_SOURCES, ...clientSources]);
      return Array.from(combined).sort();
  }, [clients]);

  const birthdayClients = useMemo(() => {
    const today = new Date();
    return clients.filter(client => {
      if (!client.birth_date) return false;
      const birth = new Date(client.birth_date);
      return birth.getUTCDate() === today.getDate() && birth.getUTCMonth() === today.getMonth();
    });
  }, [clients]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', birth_date: '', how_did_you_know: '' });
    setIsOtherSource(false);
    setCustomSource('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      birth_date: client.birth_date || '',
      how_did_you_know: client.how_did_you_know || '',
    });
    setIsOtherSource(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalSource = formData.how_did_you_know;
    if (isOtherSource) {
        if (!customSource.trim()) return alert('Por favor, digite onde nos conheceu.');
        finalSource = customSource;
    }
    const payload = { ...formData, how_did_you_know: finalSource };
    if (editingClient) {
      await updateClient(editingClient.id, payload);
    } else {
      await addClient(payload);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      await deleteClient(id);
      if (selectedClient?.id === id) setSelectedClient(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span>Carregando base de clientes...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6 p-1">
      {/* LISTA DE CLIENTES */}
      <div className={`flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden ${selectedClient ? 'hidden md:flex md:w-1/3 md:flex-none' : 'w-full'}`}>
        <div className="p-4 border-b border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading font-bold text-lg text-white">Clientes</h2>
            <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">{clients.length}</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input type="text" placeholder="Nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
            </div>
            <button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl"><Plus size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredClients.map(client => (
            <button key={client.id} onClick={() => setSelectedClient(client)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left ${selectedClient?.id === client.id ? 'bg-indigo-600/10 border border-indigo-500/50' : 'hover:bg-slate-800 border border-transparent'}`}>
              <img src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.name}`} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-200 truncate">{client.name}</h3>
                <p className="text-[10px] text-slate-500">{client.phone}</p>
              </div>
              {client.id === topSpenderId && <Crown size={12} className="text-amber-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* DETALHES DO CLIENTE */}
      {selectedClient ? (
        <div className="flex-[2] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4">
           <div className="relative h-32 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-800">
              <button onClick={() => setSelectedClient(null)} className="absolute top-4 left-4 p-2 bg-black/20 text-white md:hidden rounded-full"><X size={18}/></button>
              <div className="absolute top-4 right-4 flex gap-2">
                 <button onClick={() => handleOpenEdit(selectedClient)} className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white"><Edit2 size={16} /></button>
                 <button onClick={() => handleDelete(selectedClient.id)} className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
              <div className="absolute -bottom-10 left-8 flex items-end gap-4">
                 <img src={selectedClient.avatar_url || `https://ui-avatars.com/api/?name=${selectedClient.name}`} className="w-24 h-24 rounded-2xl border-4 border-slate-900 shadow-xl object-cover" />
                 <div className="mb-3">
                    <h1 className="text-2xl font-bold text-white">{selectedClient.name}</h1>
                    <p className="text-sm text-slate-400 flex gap-3"><span>{selectedClient.phone}</span><span>{selectedClient.email}</span></p>
                 </div>
              </div>
           </div>

           <div className="mt-14 p-8 flex-1 overflow-y-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><User size={14}/> Informações da Conta</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                           <span className="text-slate-500 text-xs font-bold uppercase">Cliente DSD</span>
                           <span className="text-white font-black text-sm">{selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                           <span className="text-slate-500 text-xs font-bold uppercase">Última Visita</span>
                           <span className="text-indigo-400 font-black text-sm">{selectedClient.last_visit ? new Date(selectedClient.last_visit).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                           <span className="text-slate-500 text-xs font-bold uppercase">Origem</span>
                           <span className="text-slate-300 font-bold text-sm">{selectedClient.how_did_you_know || 'Não informada'}</span>
                        </div>
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-600/20 to-transparent p-6 rounded-3xl border border-indigo-500/30">
                     <p className="text-[10px] text-indigo-400 font-black uppercase mb-1">Total Histórico (LTV)</p>
                     <h3 className="text-3xl font-black text-white">{formatCurrency(selectedClient.total_spent)}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Visitas</p>
                        <p className="text-2xl font-black text-white">{selectedClient.visits_count}</p>
                     </div>
                     <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">BurnCoins</p>
                        <p className="text-2xl font-black text-amber-500">{selectedClient.cashback_balance || 0}</p>
                     </div>
                  </div>
               </div>
             </div>
           </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-[2] bg-slate-900 border border-slate-800 rounded-2xl items-center justify-center text-slate-600 flex-col">
           <User size={48} className="opacity-20 mb-4" />
           <p className="font-bold uppercase text-xs tracking-widest">Selecione um cliente para analisar</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
               <input required placeholder="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" />
               <input required placeholder="Telefone (WhatsApp)" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" />
               <div className="grid grid-cols-2 gap-4">
                  <input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500" />
                  <select value={formData.how_did_you_know} onChange={e => setFormData({...formData, how_did_you_know: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500">
                     <option value="">Origem...</option>
                     {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase py-4 rounded-xl shadow-lg mt-4">Salvar Cliente</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
