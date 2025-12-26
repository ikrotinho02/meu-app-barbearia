import React from 'react';

interface StatusCardProps {
  title?: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  latency: number | null;
  error: string | null;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, status, latency, error }) => {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold mb-2 text-slate-200">{title || 'Status do Sistema'}</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex h-3 w-3">
            {(status === 'loading' || status === 'success') && (
               <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'success' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              status === 'success' ? 'bg-emerald-500' : 
              status === 'error' ? 'bg-rose-500' :
              status === 'loading' ? 'bg-amber-500' : 'bg-slate-500'
            }`}></span>
          </div>
          <span className="text-slate-300 font-medium capitalize">
            {status === 'idle' ? 'Pronto' : status === 'loading' ? 'Carregando' : status === 'success' ? 'Sucesso' : 'Erro'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {latency !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Latência</span>
            <span className="text-emerald-400 font-mono">{latency}ms</span>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-300 text-sm">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {status === 'success' && !error && (
           <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-300 text-sm">
             Conexão estabelecida com sucesso via esquema <code>public</code>.
           </div>
        )}
      </div>
    </div>
  );
};