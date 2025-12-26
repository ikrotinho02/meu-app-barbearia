
import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  Package, 
  X,
  Save,
  Coffee,
  Scissors,
  Utensils,
  UserCheck,
  Percent,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { useProducts } from '../contexts/ProductContext';

const CATEGORIES: { id: ProductCategory; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'hair', label: 'Cabelo', icon: Scissors, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'beard', label: 'Barba', icon: UserCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'beverage', label: 'Bebidas', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'food', label: 'Alimentos', icon: Utensils, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'other', label: 'Outros', icon: Package, color: 'text-slate-400', bg: 'bg-slate-500/10' },
];

export const Products: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, adjustStock } = useProducts();
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = showInactive ? p.status === 'Inativo' : p.status === 'Ativo';
      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, showInactive]);

  const categoriesToRender = useMemo(() => {
    if (activeCategory === 'all') return CATEGORIES;
    return CATEGORIES.filter(c => c.id === activeCategory);
  }, [activeCategory]);

  const stockStats = useMemo(() => {
    const activeProds = products.filter(p => p.status === 'Ativo');
    const lowStock = activeProds.filter(p => p.stock <= (p.min_stock || 0) && p.stock > 0).length;
    const outOfStock = activeProds.filter(p => p.stock === 0).length;
    const totalValue = activeProds.reduce((acc, p) => acc + (p.stock * (p.cost || 0)), 0);
    return { lowStock, outOfStock, totalValue };
  }, [products]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name) return;

    const productData: Omit<Product, 'id'> = {
      name: editingProduct.name,
      category: editingProduct.category || 'other',
      stock: Number(editingProduct.stock || 0),
      min_stock: Number(editingProduct.min_stock || 0),
      price: Number(editingProduct.price || 0),
      cost: Number(editingProduct.cost || 0),
      commission_rate: Number(editingProduct.commission_rate || 0),
      status: editingProduct.status || 'Ativo'
    };

    try {
      if (editingProduct.id) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }
      setEditingProduct(null);
      setIsModalOpen(false);
      alert('Produto salvo com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar produto: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este produto permanentemente?')) {
      try {
        await deleteProduct(id);
      } catch (err: any) {
        alert('Erro ao excluir: ' + (err.message || 'Tente novamente.'));
      }
    }
  };

  const getStockHealth = (product: Product) => {
    if (product.stock === 0) return 'bg-red-500';
    if (product.stock <= (product.min_stock || 0)) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4">
         <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 transition-all hover:border-emerald-500/50 shadow-sm">
           <p className="text-slate-500 font-bold uppercase text-xs">Valor em Estoque (Ativos)</p>
           <h3 className="text-3xl font-heading font-bold text-emerald-400 mt-1">{formatCurrency(stockStats.totalValue)}</h3>
         </div>
         <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 transition-all hover:border-amber-500/50 shadow-sm">
           <p className="text-slate-500 font-bold uppercase text-xs">Abaixo do Mínimo</p>
           <h3 className="text-3xl font-heading font-bold text-amber-500 mt-1">{stockStats.lowStock}</h3>
         </div>
         <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 transition-all hover:border-red-500/50 shadow-sm">
           <p className="text-slate-500 font-bold uppercase text-xs">Estoque Zerado</p>
           <h3 className="text-3xl font-heading font-bold text-red-500 mt-1">{stockStats.outOfStock}</h3>
         </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-sm">
           <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto custom-scrollbar px-2">
             <button onClick={() => setActiveCategory('all')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase border ${activeCategory === 'all' ? 'bg-white text-slate-950 border-white' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>Todos</button>
             {CATEGORIES.map(cat => (
               <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase border whitespace-nowrap ${activeCategory === cat.id ? `${cat.bg} ${cat.color} border-indigo-500 ring-1 ring-indigo-500` : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'}`}>{cat.label}</button>
             ))}
           </div>
           
           <div className="flex items-center gap-3 px-2">
              <button 
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase border transition-all ${showInactive ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
              >
                {showInactive ? <><Eye size={16}/> Ver Ativos</> : <><EyeOff size={16}/> Ver Inativos</>}
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-950 border border-slate-800 text-white text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-indigo-500 w-full md:w-48"/>
              </div>
              <button onClick={() => { setEditingProduct({ status: 'Ativo', category: 'other', stock: 0, min_stock: 5, price: 0, cost: 0, commission_rate: 0 }); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
                <Plus size={18}/> Novo
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 space-y-8">
          {categoriesToRender.map(category => {
            const productsInCat = filteredProducts.filter(p => p.category === category.id);
            if (activeCategory === 'all' && productsInCat.length === 0) return null;
            return (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center gap-2 px-2 pb-2 border-b border-slate-800">
                   <h3 className="text-white font-heading font-bold text-lg">{category.label}</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {productsInCat.map(product => (
                    <div key={product.id} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-all flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden shadow-sm">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStockHealth(product)}`}></div>
                        <div className="flex-1 flex items-center gap-4 w-full pl-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-base truncate">{product.name}</h3>
                                {product.status === 'Inativo' && (
                                    <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase">Inativo</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                                <span>Custo: <span className="text-slate-300">R$ {product.cost?.toFixed(2)}</span></span>
                                <span>Venda: <span className="text-emerald-400">R$ {product.price?.toFixed(2)}</span></span>
                                <span className="text-indigo-400 flex items-center gap-1"><Percent size={10}/> Comissão: {product.commission_rate || 0}%</span>
                              </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center min-w-[140px] bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Em Estoque</p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => adjustStock(product.id, -1)} className="w-8 h-8 rounded-lg bg-slate-900 hover:text-red-500 border border-slate-800 text-white font-bold transition-colors">-</button>
                              <span className={`text-2xl font-mono font-bold w-12 text-center text-white`}>{product.stock}</span>
                              <button onClick={() => adjustStock(product.id, 1)} className="w-8 h-8 rounded-lg bg-slate-900 hover:text-emerald-500 border border-slate-800 text-white font-bold transition-colors">+</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                           <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-sm"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteProduct(product.id)} className="p-2.5 bg-slate-800 hover:bg-red-600 rounded-xl text-slate-400 hover:text-white transition-all shadow-sm"><Trash2 size={16}/></button>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-white">{editingProduct?.id ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-all"><X /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Status de Visibilidade</label>
                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-700">
                        <button 
                          type="button"
                          onClick={() => setEditingProduct({...editingProduct, status: 'Ativo'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase transition-all ${editingProduct?.status === 'Ativo' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
                        >
                          <ToggleRight size={16}/> Ativo
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingProduct({...editingProduct, status: 'Inativo'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase transition-all ${editingProduct?.status === 'Inativo' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}
                        >
                          <ToggleLeft size={16}/> Inativo
                        </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoria</label>
                    <select value={editingProduct?.category || 'other'} onChange={e => setEditingProduct({...editingProduct, category: e.target.value as ProductCategory})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        {CATEGORIES.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                    </select>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome do Produto</label>
                  <input type="text" required value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500 placeholder:text-slate-700" placeholder="Ex: Cera Efeito Matte"/>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Estoque Inicial</label>
                    <input type="number" value={editingProduct?.stock ?? 0} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500" placeholder="0"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Estoque Mínimo (Alerta)</label>
                    <input type="number" value={editingProduct?.min_stock ?? 5} onChange={e => setEditingProduct({...editingProduct, min_stock: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500" placeholder="5"/>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Preço de Custo (R$)</label>
                    <input type="number" step="0.01" value={editingProduct?.cost ?? 0} onChange={e => setEditingProduct({...editingProduct, cost: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500" placeholder="0.00"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Preço de Venda (R$)</label>
                    <input type="number" step="0.01" value={editingProduct?.price ?? 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-indigo-500" placeholder="0.00"/>
                  </div>
               </div>

               <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-2"><Percent size={14}/> Comissão por Venda (%)</label>
                  <input 
                    type="number" 
                    value={editingProduct?.commission_rate ?? 0} 
                    onChange={e => setEditingProduct({...editingProduct, commission_rate: Number(e.target.value)})} 
                    className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl p-4 text-white outline-none focus:border-indigo-500 font-bold" 
                    placeholder="0"
                  />
                  <p className="text-[10px] text-slate-500">A porcentagem inserida será creditada ao barbeiro no ato da venda deste produto.</p>
               </div>

               <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl mt-4 shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
                 <Save size={20} /> Salvar Produto
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
