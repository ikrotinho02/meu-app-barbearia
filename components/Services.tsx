
import React, { useState } from 'react';
import { useServices } from '../contexts/ServiceContext';
import { useMarketing } from '../contexts/MarketingContext'; 
import { 
  Scissors, 
  Plus, 
  Clock, 
  DollarSign, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Search,
  Tag,
  Coins,
  Percent
} from 'lucide-react';
import { Service, ServiceCategory } from '../types';

export const Services: React.FC = () => {
  const { services, isLoading, addService, updateService, deleteService } = useServices();
  const { config: marketingConfig } = useMarketing();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    price: string;
    durationMinutes: string;
    description: string;
    category: ServiceCategory;
    commissionType: 'default' | 'custom';
    customCommissionRate: string;
    cashbackReward: string; 
  }>({
    name: '',
    price: '',
    durationMinutes: '30',
    description: '',
    category: 'Cabelo',
    commissionType: 'default',
    customCommissionRate: '',
    cashbackReward: '0'
  });

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        price: service.price.toString(),
        durationMinutes: service.durationMinutes.toString(),
        description: service.description || '',
        category: service.category || 'Cabelo',
        commissionType: service.commissionType || 'default',
        customCommissionRate: service.customCommissionRate ? service.customCommissionRate.toString() : '',
        cashbackReward: service.cashbackReward ? service.cashbackReward.toString() : '0'
      });
    } else {
      setEditingService(null);
      setFormData({ 
        name: '', 
        price: '', 
        durationMinutes: '30', 
        description: '',
        category: 'Cabelo',
        commissionType: 'default',
        customCommissionRate: '',
        cashbackReward: '0'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(formData.price.replace(',', '.'));
    const duration = parseInt(formData.durationMinutes);
    const customRate = formData.commissionType === 'custom' ? parseFloat(formData.customCommissionRate) : undefined;
    const cashback = parseInt(formData.cashbackReward) || 0;

    if (!formData.name || isNaN(price) || isNaN(duration)) {
      alert('Por favor, preencha os campos obrigatórios corretamente.');
      return;
    }

    const payload = {
      name: formData.name,
      price,
      durationMinutes: duration,
      description: formData.description,
      category: formData.category,
      commissionType: formData.commissionType,
      customCommissionRate: customRate,
      cashbackReward: cashback
    };

    try {
      if (editingService?.id) {
        await updateService(editingService.id, payload);
      } else {
        await addService(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      alert('Erro ao salvar serviço: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
      try {
        await deleteService(id);
      } catch (err: any) {
        alert('Erro ao excluir: ' + (err.message || 'Tente novamente.'));
      }
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-top-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scissors className="text-indigo-500" /> Serviços
          </h2>
          <p className="text-slate-400 text-sm">Gerencie o catálogo de serviços da barbearia.</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar serviço..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-indigo-500 w-full"
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Novo Serviço</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-right-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
            Carregando serviços...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <Scissors size={48} className="mb-4 opacity-50" />
            <p className="font-medium">Nenhum serviço encontrado.</p>
            <button onClick={() => handleOpenModal()} className="mt-2 text-indigo-400 hover:underline">Cadastrar novo serviço</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.map(service => (
              <div key={service.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-indigo-400">
                    <Scissors size={20} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(service)} className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(service.id)} className="p-2 bg-slate-800 hover:bg-red-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-white text-lg pl-2 mb-1">{service.name}</h3>
                <div className="pl-2 mb-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      {service.category || 'Geral'}
                    </span>
                    {service.cashbackReward && service.cashbackReward > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">
                        <Coins size={10} /> +{service.cashbackReward}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-2 pl-2">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                      <Clock size={14} /> {service.durationMinutes} min
                  </div>
                  <div className="text-emerald-400 font-bold font-mono text-lg">{formatCurrency(service.price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{editingService?.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Nome do Serviço</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" placeholder="Ex: Corte Degradê"/>
               </div>
               <div>
                  <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Categoria</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ServiceCategory})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500">
                      <option value="Cabelo">Cabelo</option>
                      <option value="Barba">Barba</option>
                      <option value="Estética">Estética</option>
                      <option value="Química">Química</option>
                      <option value="Outros">Outros</option>
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Preço (R$)</label>
                    <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" placeholder="0.00"/>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Duração (min)</label>
                    <input type="number" min="1" step="1" value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-indigo-500" placeholder="30"/>
                  </div>
               </div>
               <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2">
                 <Save size={18} /> Salvar Serviço
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
