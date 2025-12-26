import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Users, ShoppingBag, 
  AlertCircle, Activity, Package,
  BarChart3, Scissors, RefreshCw, History, Crown, Star,
  TrendingDown, CheckCircle, ChevronRight, X, Phone, Calendar,
  PieChart as PieChartIcon, Search, UserMinus, UserCheck, Clock,
  UserX, Wallet, Filter, Award, ShoppingCart, Percent, LayoutGrid, ListFilter
} from 'lucide-react';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useClients } from '../contexts/ClientContext';
import { useProducts } from '../contexts/ProductContext';
import { useServices } from '../contexts/ServiceContext';
import { Client, ServiceTransaction, Professional } from '../types';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'profissionais' | 'clientes' | 'produtos'>('financeiro');
  const { professionals, allTransactions, fetchTransactionsForPeriod } = useProfessionals(); 
  const { clients, isLoading: isLoadingClients } = useClients();
  const { products: catalogProducts } = useProducts();
  const { services: catalogServices } = useServices();
  
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  
  // Filtros de Data
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Filtros da Aba Profissionais
  const [filterProId, setFilterProId] = useState<string>('');
  const [filterItemName, setFilterItemName] = useState<string>('');
  const [viewType, setViewType] = useState<'TOTAL' | 'TECNICO' | 'COMERCIAL'>('TOTAL');

  useEffect(() => {
    fetchTransactionsForPeriod(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchTransactionsForPeriod]);

  // --- STATS GERAIS (Estabelecimento) ---
  const reportStats = useMemo(() => {
    let totalRevenue = 0;
    let totalNetProfit = 0;
    let productCount = 0;
    const servicesCount = allTransactions.filter(t => t.type === 'SERVICE').length;
    
    const productSales: Record<string, number> = {};
    
    allTransactions.forEach(t => {
      const price = Number(t.price) || 0;
      const commission = Number(t.commissionAmountSnapshot) || 0;
      let cost = 0;

      if (t.type === 'PRODUCT_SALE') {
        productCount++;
        productSales[t.serviceName] = (productSales[t.serviceName] || 0) + 1;
        const prod = catalogProducts.find(p => p.name === t.serviceName);
        cost = Number(prod?.cost) || 0;
      }

      totalRevenue += price;
      totalNetProfit += (price - commission - cost);
    });

    const globalAvgTicket = servicesCount > 0 ? totalRevenue / servicesCount : 0;
    const topProducts = Object.entries(productSales)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalRevenue,
      totalNetProfit,
      servicesCount,
      globalAvgTicket,
      productsSold: productCount,
      topProducts
    };
  }, [allTransactions, catalogProducts]);

  // --- PERFORMANCE DE EQUIPE (Ranking e Detalhado) ---
  const teamRanking = useMemo(() => {
    const prosToAnalyze = filterProId 
      ? professionals.filter(p => p.id === filterProId)
      : professionals;

    return prosToAnalyze.map(pro => {
      const proTxs = allTransactions.filter(t => t.professionalId === pro.id);
      
      let revServices = 0;
      let revProducts = 0;
      let commServices = 0;
      let commProducts = 0;
      let prodItemsCount = 0;
      
      const apptsWithProducts = new Set();
      const totalAppts = new Set();
      const productBuyers = new Set();

      proTxs.forEach(t => {
        const price = Number(t.price) || 0;
        const comm = Number(t.commissionAmountSnapshot) || 0;
        const apptId = t.appointmentId || t.id;

        totalAppts.add(apptId);

        if (t.type === 'SERVICE') {
            revServices += price;
            commServices += comm;
        } else if (t.type === 'PRODUCT_SALE') {
            revProducts += price;
            commProducts += comm;
            prodItemsCount++;
            apptsWithProducts.add(apptId);
            productBuyers.add(t.clientName);
        }
      });
      
      const totalRevenue = revServices + revProducts;
      const attendancesCount = totalAppts.size || 1;
      const avgTicket = totalRevenue / attendancesCount;
      const productConversionRate = (apptsWithProducts.size / attendancesCount) * 100;
      const productAvgTicket = productBuyers.size > 0 ? revProducts / productBuyers.size : 0;

      // Mix de Serviços
      const serviceMix: Record<string, number> = {};
      proTxs.filter(t => t.type === 'SERVICE').forEach(t => {
          let cat = 'Outros';
          const name = t.serviceName.toLowerCase();
          if (name.includes('corte') || name.includes('degradê')) cat = 'Corte';
          else if (name.includes('barba') || name.includes('toalha')) cat = 'Barba';
          else if (name.includes('química') || name.includes('luzes') || name.includes('progressiva')) cat = 'Química';
          else if (name.includes('sobrancelha') || name.includes('limpeza')) cat = 'Estética';
          serviceMix[cat] = (serviceMix[cat] || 0) + 1;
      });

      const totalServices = proTxs.filter(t => t.type === 'SERVICE').length || 1;
      const sortedMix = Object.entries(serviceMix)
        .map(([name, count]) => ({ name, percent: (count / totalServices) * 100 }))
        .sort((a, b) => b.percent - a.percent);

      return {
        id: pro.id,
        name: pro.name,
        avatar: pro.avatarUrl,
        revenue: totalRevenue,
        revenueServices: revServices,
        revenueProducts: revProducts,
        commissionServices: commServices,
        commissionProducts: commProducts,
        productItemsCount: prodItemsCount,
        productConversionRate,
        productAvgTicket,
        avgTicket,
        serviceMix: sortedMix
      };
    }).sort((a, b) => {
        if (viewType === 'COMERCIAL') return b.revenueProducts - a.revenueProducts;
        if (viewType === 'TECNICO') return b.revenueServices - a.revenueServices;
        return b.revenue - a.revenue;
    });
  }, [allTransactions, professionals, filterProId, viewType]);

  // --- INVENTÁRIO VENDIDO POR PROFISSIONAL ---
  const proInventory = useMemo(() => {
    if (!filterProId) return [];
    
    const proTxs = allTransactions.filter(t => t.professionalId === filterProId && t.type === 'PRODUCT_SALE');
    const aggregation: Record<string, { name: string, category: string, qty: number, total: number, commission: number }> = {};
    
    proTxs.forEach(t => {
        if (!aggregation[t.serviceName]) {
            const catalogItem = catalogProducts.find(p => p.name === t.serviceName);
            aggregation[t.serviceName] = {
                name: t.serviceName,
                category: catalogItem?.category || 'Geral',
                qty: 0,
                total: 0,
                commission: 0
            };
        }
        aggregation[t.serviceName].qty += 1;
        aggregation[t.serviceName].total += Number(t.price) || 0;
        aggregation[t.serviceName].commission += Number(t.commissionAmountSnapshot) || 0;
    });
    
    return Object.values(aggregation).sort((a, b) => b.qty - a.qty);
  }, [allTransactions, filterProId, catalogProducts]);

  // --- ANALISE DE ITEM ESPECÍFICO ---
  const itemHighlight = useMemo(() => {
    if (!filterItemName) return null;
    
    let txs = allTransactions.filter(t => t.serviceName === filterItemName);
    if (filterProId) txs = txs.filter(t => t.professionalId === filterProId);
    
    const count = txs.length;
    const revenue = txs.reduce((acc, t) => acc + (Number(t.price) || 0), 0);
    const isProduct = catalogProducts.some(p => p.name === filterItemName);
    
    return { name: filterItemName, count, revenue, isProduct };
  }, [allTransactions, filterItemName, filterProId, catalogProducts]);

  // --- CLIENT ANALYSIS ---
  // Added clientAnalysis and filteredClientList to fix compilation errors
  const clientAnalysis = useMemo(() => {
    const today = new Date();
    
    const processedClients = clients.map(client => {
      // Calculate net profit from transactions for this client
      const clientTxs = allTransactions.filter(t => t.clientName === client.name);
      const clientTotalNetProfit = clientTxs.reduce((acc, t) => {
        const price = Number(t.price) || 0;
        const commission = Number(t.commissionAmountSnapshot) || 0;
        let cost = 0;
        if (t.type === 'PRODUCT_SALE') {
          const prod = catalogProducts.find(p => p.name === t.serviceName);
          cost = Number(prod?.cost) || 0;
        }
        return acc + (price - commission - cost);
      }, 0);

      // Recency
      let recencyDays = 999;
      if (client.last_visit) {
        const lastVisitDate = new Date(client.last_visit);
        const diffTime = Math.abs(today.getTime() - lastVisitDate.getTime());
        recencyDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Frequency
      let avgMonthlyVisits = 0;
      if (client.created_at) {
        const createdDate = new Date(client.created_at);
        const monthsActive = Math.max(1, (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        avgMonthlyVisits = client.visits_count / monthsActive;
      }

      // Churn Status
      let churnStatus: 'SAFE' | 'RISK_30' | 'RISK_60' | 'RISK_90' = 'SAFE';
      if (recencyDays > 90) churnStatus = 'RISK_90';
      else if (recencyDays > 60) churnStatus = 'RISK_60';
      else if (recencyDays > 30) churnStatus = 'RISK_30';

      return {
        ...client,
        clientTotalNetProfit,
        recencyDays,
        avgMonthlyVisits,
        churnStatus
      };
    });

    const churnCounts = {
      safe: processedClients.filter(c => c.churnStatus === 'SAFE').length,
      risk30: processedClients.filter(c => c.churnStatus === 'RISK_30').length,
      risk60: processedClients.filter(c => c.churnStatus === 'RISK_60').length,
      risk90: processedClients.filter(c => c.churnStatus === 'RISK_90').length,
    };

    const avgGlobalMonthlyVisits = processedClients.length > 0 
      ? processedClients.reduce((acc, c) => acc + c.avgMonthlyVisits, 0) / processedClients.length 
      : 0;

    return { processedClients, churnCounts, avgGlobalMonthlyVisits };
  }, [clients, allTransactions, catalogProducts]);

  const filteredClientList = useMemo(() => {
    return clientAnalysis.processedClients.filter(c => 
      c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
    );
  }, [clientAnalysis.processedClients, clientSearchTerm]);

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-2 rounded-2xl border border-slate-800 gap-4 shadow-lg">
        <div className="flex p-1 gap-1 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'financeiro', label: 'Resumo Geral', icon: BarChart3 },
            { id: 'profissionais', label: 'Performance Equipe', icon: Users },
            { id: 'clientes', label: 'Relatório de Clientes', icon: Activity },
            { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
           <Calendar size={14} className="text-indigo-500 ml-3 mr-2" />
           <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-white text-xs font-bold outline-none p-2 appearance-none cursor-pointer">
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => <option key={i} value={i} className="bg-slate-900">{m}</option>)}
           </select>
           <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-white text-xs font-bold outline-none p-2 appearance-none cursor-pointer">
              {[2023, 2024, 2025].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
           </select>
        </div>
      </div>

      <div className="flex-1">
          {activeTab === 'financeiro' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <KpiCard label="Faturamento Bruto" value={formatCurrency(reportStats.totalRevenue)} icon={DollarSign} color="text-white" bg="bg-indigo-600" />
               <KpiCard label="Lucro Líquido" value={formatCurrency(reportStats.totalNetProfit)} icon={Wallet} color="text-emerald-400" bg="bg-emerald-500/10" />
               <KpiCard label="Ticket Médio" value={formatCurrency(reportStats.globalAvgTicket)} icon={TrendingUp} color="text-amber-400" bg="bg-amber-500/10" />
               <KpiCard label="Produtos Vendidos" value={reportStats.productsSold} icon={ShoppingBag} color="text-cyan-400" bg="bg-cyan-500/10" />
            </div>
          )}

          {activeTab === 'profissionais' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2">
              
              {/* FILTROS DE PERMANCE DE EQUIPE */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 flex flex-col gap-8 shadow-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <Users size={12} className="text-indigo-500"/> 01. Profissional em Foco
                        </label>
                        <select 
                          value={filterProId} 
                          onChange={e => setFilterProId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                        >
                           <option value="">Equipe Completa</option>
                           {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <ListFilter size={12} className="text-indigo-500"/> 02. Categoria de Desempenho
                        </label>
                        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                           {(['TOTAL', 'TECNICO', 'COMERCIAL'] as const).map(type => (
                              <button 
                                key={type}
                                onClick={() => setViewType(type)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${viewType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                {type === 'TOTAL' ? 'Total' : type === 'TECNICO' ? 'Técnico' : 'Comercial'}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="pt-8 border-t border-slate-800">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Search size={12} className="text-indigo-500"/> 03. Analisar Itens (Submenus de Filtro)
                     </label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-slate-600 uppercase ml-2 flex items-center gap-1.5"><Scissors size={10}/> Menu de Serviços</p>
                           <select 
                             value={catalogServices.some(s => s.name === filterItemName) ? filterItemName : ''} 
                             onChange={e => setFilterItemName(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                           >
                              <option value="">Filtrar serviço específico...</option>
                              {catalogServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-slate-600 uppercase ml-2 flex items-center gap-1.5"><ShoppingBag size={10}/> Menu de Produtos</p>
                           <select 
                             value={catalogProducts.some(p => p.name === filterItemName) ? filterItemName : ''} 
                             onChange={e => setFilterItemName(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                           >
                              <option value="">Filtrar produto específico...</option>
                              {catalogProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                           </select>
                        </div>
                     </div>
                     {filterItemName && (
                        <div className="mt-4 flex justify-end">
                           <button onClick={() => setFilterItemName('')} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/5 transition-all">
                              <X size={12}/> Limpar Seleção de Item
                           </button>
                        </div>
                     )}
                  </div>
              </div>

              {/* HIGHLIGHTS DA EQUIPE / ITEM SELECIONADO */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <KpiCard 
                    label={viewType === 'TOTAL' ? "Arrecadação Bruta" : viewType === 'TECNICO' ? "Receita Serviços" : "Receita Vendas"} 
                    value={formatCurrency(teamRanking.reduce((acc, p) => acc + (viewType === 'TOTAL' ? p.revenue : viewType === 'TECNICO' ? p.revenueServices : p.revenueProducts), 0))} 
                    icon={DollarSign} color="text-white" bg="bg-indigo-600" 
                  />
                  <KpiCard 
                    label="Ticket Médio" 
                    value={formatCurrency(teamRanking.length > 0 ? (teamRanking.reduce((acc, p) => acc + p.avgTicket, 0) / teamRanking.length) : 0)} 
                    icon={Award} color="text-amber-400" bg="bg-amber-500/10" 
                  />
                  <KpiCard 
                    label="T. Médio Comercial" 
                    value={formatCurrency(teamRanking.length > 0 ? (teamRanking.reduce((acc, p) => acc + p.productAvgTicket, 0) / teamRanking.length) : 0)} 
                    icon={ShoppingCart} color="text-emerald-400" bg="bg-emerald-500/10" 
                  />
                  {itemHighlight ? (
                    <div className={`bg-slate-900 border-2 ${itemHighlight.isProduct ? 'border-amber-500/30' : 'border-emerald-500/30'} p-8 rounded-[2rem] shadow-lg flex flex-col justify-center relative overflow-hidden group animate-in zoom-in-95`}>
                       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">{itemHighlight.isProduct ? <ShoppingBag size={80}/> : <Scissors size={80}/>}</div>
                       <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${itemHighlight.isProduct ? 'text-amber-500' : 'text-emerald-500'}`}>Analítico: {itemHighlight.name}</p>
                       <h3 className="text-3xl font-black text-white tracking-tighter">{itemHighlight.count} <span className="text-xs font-bold text-slate-500 uppercase">Realizados</span></h3>
                       <p className={`${itemHighlight.isProduct ? 'text-amber-400' : 'text-emerald-400'} font-black mt-1 text-sm`}>{formatCurrency(itemHighlight.revenue)} Gerados</p>
                    </div>
                  ) : (
                    <KpiCard 
                      label="Conversão de Venda" 
                      value={`${(teamRanking.length > 0 ? (teamRanking.reduce((acc, p) => acc + p.productConversionRate, 0) / teamRanking.length) : 0).toFixed(1)}%`} 
                      icon={RefreshCw} color="text-cyan-400" bg="bg-cyan-500/10" 
                    />
                  )}
              </div>

              {/* LISTA DETALHADA POR PROFISSIONAL */}
              <div className="space-y-4">
                {teamRanking.map((pro, idx) => {
                  if (viewType === 'TECNICO' && pro.revenueServices === 0) return null;
                  if (viewType === 'COMERCIAL' && pro.revenueProducts === 0) return null;

                  return (
                    <div key={pro.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in hover:border-slate-700 transition-all">
                        <div className="p-6 bg-slate-950/50 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-4">
                              <span className="text-2xl font-black text-slate-800 italic">#{idx + 1}</span>
                              <img src={pro.avatar || `https://ui-avatars.com/api/?name=${pro.name}`} className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500/30 p-0.5 shadow-md" />
                              <div>
                                  <h3 className="text-xl font-bold text-white tracking-tight">{pro.name}</h3>
                                  <div className="flex gap-4 mt-1">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                          {viewType === 'COMERCIAL' ? 'Venda Mercadorias: ' : 'Execução Técnica: '} 
                                          {formatCurrency(viewType === 'COMERCIAL' ? pro.revenueProducts : pro.revenueServices)}
                                      </span>
                                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Ticket: {formatCurrency(pro.avgTicket)}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                              <div className="px-5 py-1.5 text-center border-r border-slate-800">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Conversão</p>
                                  <p className="text-xl font-black text-emerald-400 tracking-tighter">{pro.productConversionRate.toFixed(1)}%</p>
                              </div>
                              <div className="px-5 py-1.5 text-center">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Itens Vendidos</p>
                                  <p className="text-xl font-black text-amber-500 tracking-tighter">{pro.productItemsCount}</p>
                              </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                            <div className={`p-8 ${viewType === 'COMERCIAL' ? 'opacity-30 grayscale' : ''} transition-all`}>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Scissors size={12}/> Receita Técnica</p>
                                <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(pro.revenueServices)}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <Percent size={12} className="text-indigo-400"/>
                                    <span className="text-[11px] font-bold text-slate-400">Gerado p/ Equipe: {formatCurrency(pro.commissionServices)}</span>
                                </div>
                            </div>
                            <div className={`p-8 ${viewType === 'TECNICO' ? 'opacity-30 grayscale' : ''} transition-all`}>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ShoppingBag size={12}/> Receita Comercial</p>
                                <p className="text-3xl font-black text-amber-500 tracking-tight">{formatCurrency(pro.revenueProducts)}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <Percent size={12} className="text-amber-400"/>
                                    <span className="text-[11px] font-bold text-slate-400">Gerado p/ Equipe: {formatCurrency(pro.commissionProducts)}</span>
                                </div>
                            </div>
                            <div className="p-8 col-span-1 md:col-span-2 bg-slate-950/20">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Mix de Especialidades Realizadas</p>
                               <div className="flex flex-wrap gap-6">
                                  {pro.serviceMix.map((mix, i) => (
                                      <div key={i} className="flex-1 min-w-[140px] space-y-2">
                                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                              <span className="text-slate-500">{mix.name}</span>
                                              <span className="text-white">{mix.percent.toFixed(0)}%</span>
                                          </div>
                                          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden shadow-inner border border-slate-900">
                                              <div className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.4)]" style={{width: `${mix.percent}%`}}></div>
                                          </div>
                                      </div>
                                  ))}
                                  {pro.serviceMix.length === 0 && <p className="text-[11px] text-slate-600 italic font-medium p-4 border border-slate-800 border-dashed rounded-xl w-full text-center">Nenhuma movimentação técnica registrada neste período.</p>}
                               </div>
                            </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'clientes' && (
            <div className="space-y-8 animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <KpiCard label="Lucratividade Cliente" value={formatCurrency(clientAnalysis.processedClients.reduce((acc, c) => acc + c.clientTotalNetProfit, 0) / (clients.length || 1))} icon={Crown} color="text-amber-400" bg="bg-amber-500/10" />
                  <KpiCard label="Status Crítico" value={clientAnalysis.churnCounts.risk60 + clientAnalysis.churnCounts.risk90} icon={UserX} color="text-red-400" bg="bg-red-500/10" />
                  <KpiCard label="Frequência Média" value={`${clientAnalysis.avgGlobalMonthlyVisits.toFixed(1)} x mês`} icon={History} color="text-indigo-400" bg="bg-indigo-500/10" />
                  <KpiCard label="Retenção Ativa" value={clientAnalysis.churnCounts.safe} icon={UserCheck} color="text-emerald-400" bg="bg-emerald-500/10" />
               </div>

               <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-lg">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex flex-col md:flex-row justify-between items-center gap-4">
                     <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-indigo-500"/> Análise de Valor Vitalício (LTV)</h3>
                     <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                           type="text" 
                           placeholder="Pesquisar cliente..." 
                           value={clientSearchTerm}
                           onChange={e => setClientSearchTerm(e.target.value)}
                           className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-indigo-500 outline-none shadow-inner"
                        />
                     </div>
                  </div>
                  <div className="p-0 overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-950 text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">
                           <tr>
                              <th className="p-6">Nome do Membro</th>
                              <th className="p-6 text-center">Gasto Acumulado</th>
                              <th className="p-6 text-center">Lucro Gerado</th>
                              <th className="p-6 text-center">Recência</th>
                              <th className="p-6 text-center">Frequência</th>
                              <th className="p-6 text-center">Status Saúde</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                           {filteredClientList.map(c => (
                              <tr key={c.id} className="hover:bg-slate-800/30 transition-all group">
                                 <td className="p-6 flex items-center gap-4">
                                    <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.name}`} className="w-11 h-11 rounded-xl object-cover shadow-md" />
                                    <div>
                                       <p className="font-bold text-white text-base tracking-tight">{c.name}</p>
                                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Base Burn App</p>
                                    </div>
                                 </td>
                                 <td className="p-6 text-center font-bold text-slate-300">{formatCurrency(c.total_spent)}</td>
                                 <td className="p-6 text-center font-black text-emerald-400">{formatCurrency(c.clientTotalNetProfit)}</td>
                                 <td className="p-6 text-center text-slate-300 font-mono text-xs">{c.recencyDays === 999 ? 'N/A' : `${c.recencyDays} dias`}</td>
                                 <td className="p-6 text-center">
                                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-xl font-black uppercase border border-indigo-500/10">
                                       {c.avgMonthlyVisits > 0 ? `${c.avgMonthlyVisits.toFixed(1)}x / mês` : 'Única'}
                                    </span>
                                 </td>
                                 <td className="p-6 text-center">
                                    <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-[0.1em] ${
                                       c.churnStatus === 'SAFE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                       c.churnStatus === 'RISK_30' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                       'bg-red-500/10 text-red-500 border-red-500/20'
                                    }`}>
                                       {c.churnStatus === 'SAFE' ? 'Fidelizado' : c.churnStatus === 'RISK_30' ? 'Atenção' : 'Risco Churn'}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'produtos' && (
            <div className="space-y-8 animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KpiCard label="Itens Vendidos" value={reportStats.productsSold} icon={CheckCircle} color="text-emerald-400" bg="bg-emerald-500/10" trend="Mensal" />
                  <KpiCard label="Mix do PDV" value={reportStats.topProducts.length} icon={Package} color="text-indigo-400" bg="bg-indigo-500/10" />
                  <KpiCard label="Alerta de Estoque" value={catalogProducts.filter(p => p.stock <= p.min_stock).length} icon={AlertCircle} color="text-red-400" bg="bg-red-500/10" />
                  <KpiCard label="Patrimônio em Estoque" value={formatCurrency(catalogProducts.reduce((acc, p) => acc + (p.stock * p.price), 0))} icon={DollarSign} color="text-white" bg="bg-slate-800" />
               </div>
            </div>
          )}
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, icon: Icon, color, bg, trend }: any) => (
  <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-lg group hover:border-indigo-500/50 transition-all relative overflow-hidden">
    {trend && <span className="absolute top-5 right-6 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">{trend}</span>}
    <div className={`w-14 h-14 ${bg} ${color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-inner border border-white/5`}><Icon size={28} /></div>
    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{label}</p>
    <h3 className={`text-3xl font-black tracking-tight ${color}`}>{value}</h3>
  </div>
);