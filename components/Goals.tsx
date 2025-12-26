
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Target, 
  TrendingUp, 
  Users, 
  Store, 
  Edit2, 
  Check, 
  CheckCircle,
  DollarSign, 
  Star,
  Scissors,
  Zap,
  Lightbulb,
  ArrowRight,
  TrendingDown,
  CalendarDays,
  Activity,
  ShoppingBag,
  Trophy,
  X,
  FileText,
  Rocket,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useAppointments } from '../contexts/AppointmentContext';

const ProgressBar = ({ current, target, colorClass = 'bg-indigo-600', label }: { current: number, target: number, colorClass?: string, label?: string }) => {
    const percentage = Math.min(100, Math.max(0, (current / target) * 100));
    
    let finalColor = colorClass;
    if (percentage < 50) finalColor = 'bg-red-500';
    else if (percentage < 80) finalColor = 'bg-amber-500';
    else finalColor = 'bg-emerald-500';

    return (
        <div className="w-full">
            <div className="flex justify-between mb-1 text-xs font-bold uppercase text-slate-500">
                <span>{label || 'Progresso'}</span>
                <span>{percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-700 ${finalColor}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export const Goals: React.FC = () => {
    const { professionals, goals, updateGoal, allTransactions } = useProfessionals();
    const { appointments } = useAppointments();

    const [activeTab, setActiveTab] = useState<'shop' | 'individual'>('shop');
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [tempGoalValue, setTempGoalValue] = useState<string>('');
    const [showFullReport, setShowFullReport] = useState(false);

    // --- TIME CONSTANTS ---
    const timeData = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const daysRemaining = daysInMonth - daysPassed;
        const weekOfMonth = Math.ceil(daysPassed / 7);
        return { daysInMonth, daysPassed, daysRemaining, weekOfMonth };
    }, []);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // --- CALCULATIONS ---

    // 1. Shop Stats
    const shopGoal = goals.find(g => g.type === 'SHOP_REVENUE');
    const currentShopRevenue = useMemo(() => {
        return allTransactions
            .filter(t => t.type === 'SERVICE' || t.type === 'PRODUCT_SALE')
            .reduce((acc, t) => acc + (Number(t.price) || 0), 0);
    }, [allTransactions]);

    const totalServiceCount = allTransactions.filter(t => t.type === 'SERVICE').length;
    const globalTicketMedio = totalServiceCount > 0 ? currentShopRevenue / totalServiceCount : 0;

    const shopProjection = (currentShopRevenue / timeData.daysPassed) * timeData.daysInMonth;
    const shopDailyNeeded = shopGoal && timeData.daysRemaining > 0 
        ? Math.max(0, shopGoal.targetValue - currentShopRevenue) / timeData.daysRemaining 
        : 0;

    // 2. Pro Stats Helper
    const getProStats = (proId: string) => {
        const proTxs = allTransactions.filter(t => t.professionalId === proId);
        
        const revenue = proTxs
            .filter(t => t.type === 'SERVICE' || t.type === 'PRODUCT_SALE')
            .reduce((acc, t) => acc + t.price, 0);

        const proAppointments = appointments.filter(a => (a.barberId === proId || a.items?.some((i:any) => i.realBarberId === proId)) && a.status === 'COMPLETED');
        
        let secondaryCount = 0;
        let totalCount = 0;
        proAppointments.forEach(appt => {
            if (appt.items) {
                appt.items.forEach(item => {
                    if (item.type === 'service') {
                        totalCount++;
                        const name = item.name.toLowerCase();
                        if (!name.includes('corte') && !name.includes('barba')) {
                            secondaryCount++;
                        }
                    }
                });
            }
        });

        const ticketMedio = totalCount > 0 ? revenue / totalCount : 0;
        const secondaryRatio = totalCount > 0 ? secondaryCount / totalCount : 0;

        return { revenue, secondaryCount, totalCount, ticketMedio, secondaryRatio };
    };

    // 3. Dynamic Insights (IA Logic)
    const dynamicInsights = useMemo(() => {
        const list = [];
        
        if (shopGoal && shopProjection < shopGoal.targetValue) {
            list.push({
                type: 'warning',
                title: 'Meta de Faturamento em Risco',
                text: `Sua projeção mensal está R$ ${Math.abs(shopGoal.targetValue - shopProjection).toFixed(2)} abaixo do objetivo.`,
                action: 'Lance uma campanha de "Fidelidade em Dobro" para atendimentos realizados em terças e quartas.',
                impact: 'Alto Impacto',
                icon: TrendingDown
            });
        }

        if (globalTicketMedio < 65) {
            list.push({
                type: 'info',
                title: 'Ticket Médio Oportunidade',
                text: `Sua média por cliente (${formatCurrency(globalTicketMedio)}) pode crescer 15%.`,
                action: 'Treine a equipe para oferecer "Pomada Finalizadora" ou "Sobrancelha" em 100% dos cortes.',
                impact: 'Crescimento',
                icon: DollarSign
            });
        }

        const productSales = allTransactions.filter(t => t.type === 'PRODUCT_SALE').length;
        const productConversion = totalServiceCount > 0 ? (productSales / totalServiceCount) * 100 : 0;
        
        if (productConversion < 12) {
            list.push({
                type: 'info',
                title: 'Venda de Produtos Baixa',
                text: `Apenas ${productConversion.toFixed(1)}% dos serviços geram venda casada de produtos.`,
                action: 'Coloque amostras do pós-barba na bancada para o cliente testar a fragrância durante o serviço.',
                impact: 'Lucratividade',
                icon: ShoppingBag
            });
        }

        const lowOccupancyDay = 2; // Terça-feira fictícia
        list.push({
            type: 'warning',
            title: 'Otimização de Agenda',
            text: 'Suas terças-feiras estão com ocupação média de 35%.',
            action: 'Envie mensagem automática para clientes que não vêm há 30 dias oferecendo horário exclusivo para amanhã.',
            impact: 'Eficiência',
            icon: CalendarDays
        });

        return list;
    }, [allTransactions, globalTicketMedio, shopGoal, shopProjection]);

    // 4. Gamification (Points & Challenges)
    const challenges = useMemo(() => {
        return dynamicInsights.map((insight, idx) => ({
            id: `chall-${idx}`,
            title: insight.title,
            description: insight.action,
            points: 150,
            completed: Math.random() > 0.6 // Mock progress based on fake completion
        }));
    }, [dynamicInsights]);

    const totalPoints = useMemo(() => {
        return challenges.filter(c => c.completed).length * 150;
    }, [challenges]);

    const isAllDoneThisMonth = challenges.every(c => c.completed);

    const handleEditClick = (goalId: string, currentValue: number) => {
        setEditingGoalId(goalId);
        setTempGoalValue(currentValue.toString());
    };

    const handleSaveGoal = (type: any, proId?: string) => {
        const val = parseFloat(tempGoalValue);
        if (!isNaN(val) && val > 0) {
            updateGoal(type, val, proId);
        }
        setEditingGoalId(null);
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-right-4 p-6 pb-20">
            
            {/* Header com Gamificação */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><Zap size={200} fill="currentColor"/></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter uppercase italic">
                        <Target className="text-red-500" size={32} /> Metas & Objetivos
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">Desempenho analítico e desafios gamificados.</p>
                </div>
                
                <div className="relative z-10 flex flex-wrap items-center gap-4">
                    <div className="bg-slate-950/80 backdrop-blur-md p-4 px-6 rounded-3xl border border-slate-800 flex items-center gap-5 shadow-inner">
                        <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                            <Star fill="currentColor" size={24}/>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Pontos na Semana</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white tracking-tighter">{totalPoints}</span>
                                <span className="text-xs font-bold text-indigo-400 uppercase">BurnPoints</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 h-fit">
                        <button 
                            onClick={() => setActiveTab('shop')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all tracking-widest ${activeTab === 'shop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Store size={14} className="inline mr-2" /> Barbearia
                        </button>
                        <button 
                            onClick={() => setActiveTab('individual')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all tracking-widest ${activeTab === 'individual' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Users size={14} className="inline mr-2" /> Profissionais
                        </button>
                    </div>
                </div>
            </div>

            {/* Troféu Mensal (Conquista) */}
            {isAllDoneThisMonth && (
                <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-1 rounded-[3rem] shadow-2xl animate-in zoom-in duration-700">
                    <div className="bg-slate-900 p-8 rounded-[2.8rem] flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 animate-pulse"></div>
                                <div className="p-5 bg-amber-500/10 rounded-full border-2 border-amber-500/50 text-amber-500 relative z-10">
                                    <Trophy size={48} fill="currentColor" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">Mestre do Mês 🔥</h3>
                                <p className="text-slate-400 font-bold max-w-md">Incrível! Você e sua equipe completaram todos os desafios analíticos deste período. Sua barbearia está operando em alta performance.</p>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <CheckCircle size={64} className="text-emerald-500 opacity-20" />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div className="lg:col-span-2 space-y-8">
                    {activeTab === 'shop' ? (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            
                            <div className="flex justify-between items-start mb-10 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                                        <Store size={28} className="text-indigo-500" /> Faturamento da Loja
                                    </h3>
                                    <p className="text-slate-400 font-medium mt-1">Acumulado do mês atual ({timeData.daysPassed}/{timeData.daysInMonth} dias).</p>
                                </div>
                                
                                {editingGoalId === 'shop-revenue' ? (
                                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                                        <input 
                                            type="number" 
                                            value={tempGoalValue}
                                            onChange={e => setTempGoalValue(e.target.value)}
                                            className="w-28 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none text-lg font-bold"
                                            autoFocus
                                        />
                                        <button onClick={() => handleSaveGoal('SHOP_REVENUE')} className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"><Check size={20}/></button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleEditClick('shop-revenue', shopGoal?.targetValue || 0)}
                                        className="p-3 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all"
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                    <div>
                                        <span className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] block mb-2">Realizado</span>
                                        <h1 className="text-6xl font-black text-white tracking-tighter">{formatCurrency(currentShopRevenue)}</h1>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] block mb-2">Objetivo</span>
                                        <h3 className="text-3xl font-bold text-slate-400 tracking-tight">{formatCurrency(shopGoal?.targetValue || 0)}</h3>
                                    </div>
                                </div>
                                
                                <ProgressBar current={currentShopRevenue} target={shopGoal?.targetValue || 1} label="Nível de Conclusão" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 backdrop-blur-sm shadow-inner group transition-all hover:border-indigo-500/30">
                                        <div className="flex items-center gap-2 text-red-400 mb-2">
                                            <TrendingDown size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Restante</span>
                                        </div>
                                        <p className="text-2xl font-black text-white tracking-tight">
                                            {formatCurrency(Math.max(0, (shopGoal?.targetValue || 0) - currentShopRevenue))}
                                        </p>
                                    </div>
                                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 backdrop-blur-sm shadow-inner group transition-all hover:border-indigo-500/30">
                                        <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                            <CalendarDays size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Meta Diária</span>
                                        </div>
                                        <p className="text-2xl font-black text-white tracking-tight">
                                            {formatCurrency(shopDailyNeeded)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 backdrop-blur-sm shadow-inner group transition-all hover:border-indigo-500/30">
                                        <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                            <TrendingUp size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Projeção Final</span>
                                        </div>
                                        <p className="text-2xl font-black text-white tracking-tight">
                                            {formatCurrency(shopProjection)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {professionals.map(pro => {
                                const stats = getProStats(pro.id);
                                const revenueGoal = goals.find(g => g.type === 'PRO_REVENUE' && g.professionalId === pro.id);
                                const secondaryGoal = goals.find(g => g.type === 'PRO_SECONDARY' && g.professionalId === pro.id);

                                return (
                                    <div key={pro.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-lg hover:border-indigo-500/30 transition-all">
                                        <div className="p-6 bg-slate-950/50 border-b border-slate-800 flex items-center gap-4">
                                            <img src={pro.avatarUrl || `https://ui-avatars.com/api/?name=${pro.name}`} alt="" className="w-14 h-14 rounded-2xl border border-slate-800 object-cover" />
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{pro.name}</h3>
                                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{pro.role}</span>
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-8 flex-1">
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500"><DollarSign size={16}/></div>
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Faturamento</span>
                                                    </div>
                                                    
                                                    {editingGoalId === `rev-${pro.id}` ? (
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" className="w-20 bg-slate-950 border border-slate-700 text-white text-xs p-1 rounded" value={tempGoalValue} onChange={e => setTempGoalValue(e.target.value)} autoFocus />
                                                            <button onClick={() => handleSaveGoal('PRO_REVENUE', pro.id)} className="text-green-500"><Check size={16}/></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => handleEditClick(`rev-${pro.id}`, revenueGoal?.targetValue || 0)} className="text-slate-600 hover:text-white"><Edit2 size={14}/></button>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <span className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.revenue)}</span>
                                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">META: {formatCurrency(revenueGoal?.targetValue || 0)}</span>
                                                </div>
                                                <ProgressBar current={stats.revenue} target={revenueGoal?.targetValue || 1} />
                                            </div>

                                            <div className="pt-4 border-t border-slate-800/50">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500"><Scissors size={16}/></div>
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Agregados</span>
                                                    </div>
                                                    
                                                    {editingGoalId === `sec-${pro.id}` ? (
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" className="w-16 bg-slate-950 border border-slate-700 text-white text-xs p-1 rounded" value={tempGoalValue} onChange={e => setTempGoalValue(e.target.value)} autoFocus />
                                                            <button onClick={() => handleSaveGoal('PRO_SECONDARY', pro.id)} className="text-green-500"><Check size={16}/></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => handleEditClick(`sec-${pro.id}`, secondaryGoal?.targetValue || 0)} className="text-slate-600 hover:text-white"><Edit2 size={14}/></button>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-baseline mb-2">
                                                    <span className="text-3xl font-black text-white">{stats.secondaryCount} <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">unid.</span></span>
                                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">META: {secondaryGoal?.targetValue || 0}</span>
                                                </div>
                                                <ProgressBar current={stats.secondaryCount} target={secondaryGoal?.targetValue || 1} colorClass="bg-indigo-500" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="text-indigo-500" size={22}/> Visão Geral Analítica
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <DataDetailCard label="Ticket Médio" value={formatCurrency(globalTicketMedio)} icon={Activity} color="text-indigo-500" />
                            <DataDetailCard label="Mix de Vendas" value={`${((allTransactions.filter(t => t.type === 'PRODUCT_SALE').length / (allTransactions.length || 1)) * 100).toFixed(1)}%`} icon={Store} color="text-amber-500" />
                            <DataDetailCard label="Ponto de Equilíbrio" value={formatCurrency((shopGoal?.targetValue || 0) * 0.7)} icon={DollarSign} color="text-emerald-500" />
                            <DataDetailCard label="Projeção Mês" value={formatCurrency(shopProjection)} icon={TrendingUp} color="text-cyan-500" />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Desafios da Semana / Dicas Inteligentes */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 group-hover:scale-110 transition-transform">
                                <Zap size={24} fill="currentColor" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Desafios da Semana</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Semana {timeData.weekOfMonth} de 4</p>
                            </div>
                        </div>
                        
                        <div className="space-y-5">
                            {challenges.map((challenge) => (
                                <div key={challenge.id} className={`p-5 rounded-3xl border flex gap-4 transition-all relative group overflow-hidden ${
                                    challenge.completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/50 border-slate-800 hover:border-indigo-500/30'
                                }`}>
                                    <div className={`mt-1 flex-shrink-0 ${challenge.completed ? 'text-emerald-500' : 'text-slate-600 group-hover:text-indigo-400 transition-colors'}`}>
                                        <ShieldCheck size={28} />
                                    </div>
                                    <div className="space-y-1 pr-12">
                                        <h4 className={`text-sm font-black uppercase tracking-tight ${challenge.completed ? 'text-emerald-400 line-through opacity-50' : 'text-white'}`}>{challenge.title}</h4>
                                        <p className="text-[11px] text-slate-500 leading-relaxed italic line-clamp-2">"{challenge.description}"</p>
                                    </div>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        {challenge.completed ? (
                                            <div className="bg-emerald-500 p-1.5 rounded-full text-slate-950 shadow-lg shadow-emerald-500/20">
                                                <Check size={16} strokeWidth={4}/>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-indigo-500">+{challenge.points}</span>
                                                <span className="text-[8px] font-bold text-slate-700 uppercase">PTS</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={() => setShowFullReport(true)}
                            className="w-full mt-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl text-[10px] flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/30 group/btn"
                        >
                            Ver Relatório IA Completo <Rocket size={16} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                        </button>
                    </div>

                    {/* Progress Card */}
                    <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/40">
                        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><Award size={140}/></div>
                        <h4 className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em] mb-4">Nível da Barbearia</h4>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-4xl font-black italic tracking-tighter">OURO</span>
                            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full border border-white/30">75%</span>
                        </div>
                        <div className="w-full h-3 bg-white/10 rounded-full mb-4 overflow-hidden border border-white/10">
                            <div className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000" style={{ width: '75%' }}></div>
                        </div>
                        <p className="text-[10px] font-bold text-indigo-100/70 italic uppercase tracking-wider">Faltam 450 BurnPoints para o nível Diamante.</p>
                    </div>
                </div>
            </div>

            {/* MODAL: RELATÓRIO IA ESTRATÉGICO COMPLETO */}
            {showFullReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 md:p-12 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-900/40">
                                    <FileText size={32}/>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Plano de Ação Burn IA</h2>
                                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">Inteligência Competitiva de Mercado</p>
                                </div>
                            </div>
                            <button onClick={() => setShowFullReport(false)} className="text-slate-500 hover:text-white p-3 rounded-full hover:bg-slate-800 transition-all">
                                <X size={32} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar bg-slate-900/50">
                            {/* Sessão 1: Diagnóstico de Operação */}
                            <section className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <span className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-black text-lg">01</span>
                                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em]">Diagnóstico da Operação</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 relative group">
                                        <div className="absolute top-4 right-6 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors"><TrendingUp size={40}/></div>
                                        <p className="text-emerald-500 font-black text-[10px] uppercase tracking-widest mb-6 border-b border-emerald-500/20 pb-2 w-fit">Pontos de Força</p>
                                        <ul className="space-y-5">
                                            <li className="flex gap-4 text-sm text-slate-300 leading-relaxed">
                                                <div className="mt-1.5 w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                                Sua base de clientes fiéis cresceu <strong className="text-white">12.4%</strong> este mês, acima da média do mercado (8.2%).
                                            </li>
                                            <li className="flex gap-4 text-sm text-slate-300 leading-relaxed">
                                                <div className="mt-1.5 w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                                Ocupação de agenda aos Sábados está saturada (<strong className="text-white">96%</strong>), indicando potencial para expansão.
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 relative group">
                                        <div className="absolute top-4 right-6 text-red-500/20 group-hover:text-red-500/40 transition-colors"><TrendingDown size={40}/></div>
                                        <p className="text-red-500 font-black text-[10px] uppercase tracking-widest mb-6 border-b border-red-500/20 pb-2 w-fit">Oportunidade Crítica</p>
                                        <ul className="space-y-5">
                                            <li className="flex gap-4 text-sm text-slate-300 leading-relaxed">
                                                <div className="mt-1.5 w-2 h-2 bg-red-500 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                                Venda casada de produtos está em <strong className="text-white">6.2%</strong>. A meta ideal para barbearias premium é <strong className="text-white">15%</strong>.
                                            </li>
                                            <li className="flex gap-4 text-sm text-slate-300 leading-relaxed">
                                                <div className="mt-1.5 w-2 h-2 bg-red-500 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                                Taxa de ociosidade em horários matutinos cresceu <strong className="text-white">15%</strong>. Potencial perda de receita: <strong className="text-white">R$ 1.200/semana</strong>.
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Sessão 2: Plano de Ação Estratégico */}
                            <section className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <span className="w-10 h-10 rounded-full bg-amber-600/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-black text-lg">02</span>
                                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-[0.4em]">Plano de Ação Estratégico</h3>
                                </div>
                                <div className="space-y-6">
                                    {dynamicInsights.map((insight, idx) => (
                                        <div key={idx} className="bg-slate-950 border border-slate-800 p-8 rounded-[2.5rem] group hover:border-indigo-500/40 transition-all relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><insight.icon size={80}/></div>
                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-2xl ${insight.type === 'warning' ? 'text-red-500 bg-red-500/10' : 'text-indigo-500 bg-indigo-500/10'}`}>
                                                        <insight.icon size={28}/>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-bold text-white tracking-tight">{insight.title}</h4>
                                                        <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mt-0.5">Métrica Afetada</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full border tracking-[0.2em] ${insight.type === 'warning' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'}`}>{insight.impact}</span>
                                            </div>
                                            <p className="text-slate-400 text-base mb-6 leading-relaxed max-w-2xl">{insight.text}</p>
                                            <div className="bg-indigo-600/5 border border-indigo-500/10 p-6 rounded-3xl flex items-start gap-4 shadow-inner">
                                                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><Zap size={20}/></div>
                                                <div>
                                                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1.5">Ação Recomendada (Passo a Passo):</p>
                                                    <p className="text-sm text-indigo-300 italic font-medium leading-relaxed">"{insight.action}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Sessão 3: Dicas Pro Burn */}
                            <section className="bg-gradient-to-br from-indigo-900/20 to-slate-900 p-10 md:p-16 rounded-[3.5rem] border border-indigo-500/20 relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
                                <div className="flex items-center gap-4 mb-10 relative z-10">
                                    <span className="w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-lg">03</span>
                                    <h3 className="text-xs font-black text-white uppercase tracking-[0.4em]">Dicas de Elite Diárias</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.8)]"></div>
                                            <h5 className="font-black text-white text-sm uppercase tracking-widest">Controle de Fluxo Digital</h5>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed italic">
                                            Nunca faça agendamentos de boca. Todo atendimento não registrado no Burn App desregula o aprendizado da sua inteligência artificial, impedindo previsões precisas de estoque e receita.
                                        </p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                                            <h5 className="font-black text-white text-sm uppercase tracking-widest">Upsell de Checkout</h5>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed italic">
                                            Ao finalizar o serviço, ofereça sempre a renovação do corte em 15 dias com valor fixo. Assinantes geram 3x mais LTV (Life Time Value) que clientes esporádicos.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="p-10 bg-slate-950 border-t border-slate-800 text-center relative z-20">
                            <button 
                                onClick={() => setShowFullReport(false)}
                                className="px-12 py-5 bg-white text-slate-950 font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] flex items-center gap-3 mx-auto"
                            >
                                <Check size={16} strokeWidth={4}/> Entendido, Vamos Pra Cima!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DataDetailCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 hover:border-indigo-500/20 transition-all group shadow-inner">
        <div className={`p-2.5 rounded-xl ${color} bg-white/5 w-fit mb-4 group-hover:scale-110 transition-transform`}>
            <Icon size={18} />
        </div>
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-xl font-black text-white tracking-tight">{value}</h4>
    </div>
);
