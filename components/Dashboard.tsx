
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/dbClient';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Clock, 
  Scissors,
  ChevronRight,
  Target,
  RefreshCw,
  PieChart as PieChartIcon,
  Crown,
  Activity,
  ArrowRight,
  History
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useProfessionals } from '../contexts/ProfessionalContext';
import { useAppointments } from '../contexts/AppointmentContext';

type PeriodType = 'week' | 'month';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { professionals } = useProfessionals();
  const { appointments } = useAppointments(); 
  const [period, setPeriod] = useState<PeriodType>('month');
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState<any>({
    revenue: 0,
    count: 0,
    avgTicket: 0,
    returnRate: 0,
    avgVisitInterval: 0,
    mrr: 0,
    chartData: [],
    categoryBreakdown: [],
    proRanking: [],
    nextAppointments: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, [period, user, professionals, appointments]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    let startDate = new Date();
    if (period === 'week') {
      const day = now.getDay();
      startDate.setDate(now.getDate() - day);
    } else {
      startDate.setDate(1);
    }
    startDate.setHours(0,0,0,0);

    try {
      const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', user.id)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true });

      const safeAppts = appts || [];
      const completed = safeAppts.filter(a => a.status === 'COMPLETED');
      
      // Standardizing Ticket Médio and Revenue to use total_value which maps to the 'price' snapshot in sales
      const revenue = completed.reduce((acc, curr) => acc + (curr.total_value || 0), 0);
      const count = completed.length;
      const avgTicket = count > 0 ? revenue / count : 0;

      let serviceRev = 0;
      let productRev = 0;
      completed.forEach(a => {
        if (a.items) {
          a.items.forEach((item: any) => {
            if (item.type === 'service') serviceRev += (item.price || 0);
            else if (item.type === 'product') productRev += (item.price || 0);
          });
        }
      });
      const categoryBreakdown = [
        { name: 'Serviços', value: serviceRev, color: '#6366f1' },
        { name: 'Produtos', value: productRev, color: '#10b981' }
      ];

      const uniqueClientsInPeriod = new Set(completed.map(a => a.customer_id).filter(id => id !== null));
      let returningCount = 0;
      let totalIntervals = 0;
      let intervalCount = 0;

      if (uniqueClientsInPeriod.size > 0) {
        const { data: history } = await supabase
          .from('appointments')
          .select('customer_id, start_time')
          .eq('client_id', user.id)
          .eq('status', 'COMPLETED')
          .in('customer_id', Array.from(uniqueClientsInPeriod))
          .order('start_time', { ascending: true });

        if (history) {
           const clientVisitsMap: Record<string, string[]> = {};
           history.forEach(h => {
             if (!clientVisitsMap[h.customer_id]) clientVisitsMap[h.customer_id] = [];
             clientVisitsMap[h.customer_id].push(h.start_time);
           });

           Object.values(clientVisitsMap).forEach(visits => {
             if (visits.length > 1) {
                returningCount++;
                for(let i = 1; i < visits.length; i++) {
                   const d1 = new Date(visits[i-1]);
                   const d2 = new Date(visits[i]);
                   totalIntervals += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                   intervalCount++;
                }
             }
           });
        }
      }

      const returnRate = uniqueClientsInPeriod.size > 0 ? (returningCount / uniqueClientsInPeriod.size) * 100 : 0;
      const avgVisitInterval = intervalCount > 0 ? Math.round(totalIntervals / intervalCount) : 0;

      const { data: activeSubs } = await supabase
        .from('subscriptions')
        .select('amount')
        .eq('client_id', user.id)
        .eq('status', 'active');
      
      const mrr = activeSubs?.reduce((acc, s) => acc + (s.amount || 0), 0) || 0;

      const proRanking = professionals.map(pro => {
        const proAppts = completed.filter(a => a.professional_id === pro.id || a.items?.some((i: any) => i.realBarberId === pro.id));
        const proRev = proAppts.reduce((acc, a) => acc + (a.total_value || 0), 0);
        return {
          id: pro.id,
          name: pro.name,
          revenue: proRev,
          avatar: pro.avatarUrl,
          retention: returnRate 
        };
      }).sort((a, b) => b.revenue - a.revenue);

      const dayMap: any = {};
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      dayNames.forEach(name => dayMap[name] = 0);
      completed.forEach(a => {
        const dayName = dayNames[new Date(a.start_time).getDay()];
        dayMap[dayName] += a.total_value;
      });
      const chartData = Object.entries(dayMap).map(([name, value]) => ({ name, value }));

      const todayStr = new Date().toISOString().split('T')[0];
      const nextAppointments = safeAppts
        .filter(a => a.start_time.startsWith(todayStr) && a.status === 'SCHEDULED' && new Date(a.start_time) > new Date())
        .slice(0, 4);

      setData({ 
        revenue, count, avgTicket, returnRate, avgVisitInterval, mrr, 
        chartData, categoryBreakdown, proRanking, nextAppointments
      });
    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data.revenue) return (
    <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-extrabold text-slate-900 dark:text-white">Visão Geral</h2>
          <p className="text-slate-500 font-medium">Resumo estratégico atualizado em tempo real.</p>
        </div>
        <div className="flex bg-slate-900/5 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
          <button onClick={() => setPeriod('week')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${period === 'week' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>Semanal</button>
          <button onClick={() => setPeriod('month')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${period === 'month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>Mensal</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Faturamento Bruto" value={formatCurrency(data.revenue)} icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" trend="+12%" />
        <KpiCard label="Ticket Médio" value={formatCurrency(data.avgTicket)} icon={Activity} color="text-indigo-500" bg="bg-indigo-500/10" trend="Real" />
        <KpiCard label="Taxa de Retorno" value={`${data.returnRate.toFixed(1)}%`} icon={RefreshCw} color="text-amber-500" bg="bg-amber-500/10" trend="Fidelidade" />
        <KpiCard label="Média de Vindas" value={`${data.avgVisitInterval} dias`} icon={History} color="text-purple-500" bg="bg-purple-500/10" trend="Intervalo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Calendar className="text-indigo-500" size={20}/> Faturamento Diário</h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} className="dark:opacity-10" />
                  <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} fontSize={12} dy={10} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#6366f108'}} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={45}>
                    {data.chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === new Date().getDay() ? '#6366f1' : '#cbd5e1'} className="dark:opacity-40" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><PieChartIcon size={18} className="text-indigo-500"/> Mix de Receita</h3>
                <div className="flex items-center gap-8">
                   <div className="w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart><Pie data={data.categoryBreakdown} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                               {data.categoryBreakdown.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie></PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="flex-1 space-y-3">
                      {data.categoryBreakdown.map((item: any) => (
                         <div key={item.name} className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>{item.name}</span>
                            <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(item.value)}</span>
                         </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12"><Crown size={120}/></div>
                <h3 className="text-lg font-bold mb-2">Previsão MRR</h3>
                <p className="text-indigo-100 text-xs mb-6">Receita recorrente de assinaturas.</p>
                <div className="text-5xl font-black mb-4">{formatCurrency(data.mrr)}</div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Saúde das Assinaturas: Ativa</p>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Target className="text-red-500" size={20}/> Performance Equipe</h3>
          </div>
          <div className="space-y-5 flex-1">
            {data.proRanking.map((pro: any) => (
              <div key={pro.id} className="flex items-center gap-4">
                <img src={pro.avatar || `https://ui-avatars.com/api/?name=${pro.name}`} className="w-12 h-12 rounded-xl object-cover border border-slate-100 dark:border-slate-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{pro.name}</p>
                  <div className="flex justify-between items-center mt-0.5">
                     <p className="text-[10px] text-slate-500 font-bold uppercase">{formatCurrency(pro.revenue)}</p>
                     <p className="text-[10px] font-black text-emerald-500">{pro.retention.toFixed(0)}% Retenção</p>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                     <div className="bg-indigo-500 h-full transition-all duration-1000" style={{width: `${(pro.revenue / (data.revenue || 1)) * 100}%`}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, icon: Icon, color, bg, trend }: any) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
      <div><p className="text-slate-500 text-xs font-bold uppercase tracking-tight">{label}</p><h3 className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3></div>
    </div>
  </div>
);
