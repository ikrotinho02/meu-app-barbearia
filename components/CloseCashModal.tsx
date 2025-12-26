
import React, { useState } from 'react';
import { X, Lock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useCash } from '../contexts/CashContext';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const CloseCashModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { summary, closeCash } = useCash();
  const [physicalCash, setPhysicalCash] = useState('');
  const [step, setStep] = useState(1);

  const expected = summary.cashInHand;
  const actual = parseFloat(physicalCash) || 0;
  const diff = actual - expected;

  const handleFinish = async () => {
    await closeCash(actual);
    onClose();
    setStep(1);
    setPhysicalCash('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="text-rose-500" size={20} /> Fechamento de Caixa
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="p-8">
          {step === 1 ? (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1 uppercase font-bold tracking-widest">Saldo Esperado em Espécie</p>
                <h3 className="text-4xl font-heading font-bold text-white">{formatCurrency(expected)}</h3>
              </div>

              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-3 text-center">Quanto há de dinheiro físico na gaveta?</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input 
                    type="number" step="0.01" autoFocus
                    value={physicalCash}
                    onChange={e => setPhysicalCash(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-5 pl-12 pr-4 text-3xl font-bold text-white outline-none focus:border-indigo-500 text-center"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!physicalCash}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                Conferir Valores <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 text-center">
              <div className={`inline-flex p-4 rounded-full ${Math.abs(diff) < 0.01 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {Math.abs(diff) < 0.01 ? <CheckCircle2 size={40}/> : <AlertTriangle size={40}/>}
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {Math.abs(diff) < 0.01 ? 'Tudo certo!' : 'Diferença Encontrada'}
                </h3>
                <p className="text-slate-400 text-sm">
                  {Math.abs(diff) < 0.01 
                    ? 'Os valores do sistema batem perfeitamente com o físico.' 
                    : `Existe uma diferença de ${formatCurrency(diff)} em relação ao esperado.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Esperado</p>
                  <p className="text-white font-bold">{formatCurrency(expected)}</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Informado</p>
                  <p className="text-white font-bold">{formatCurrency(actual)}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 text-slate-400 font-bold hover:text-white">Corrigir</button>
                <button onClick={handleFinish} className="flex-[2] bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl shadow-lg">Finalizar e Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
