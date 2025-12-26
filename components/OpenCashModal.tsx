import React, { useState, useEffect } from 'react';
import { Unlock, X } from 'lucide-react';
import { useCash } from '../contexts/CashContext';
import { useAuth } from '../contexts/AuthContext';

interface OpenCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialValue?: number; // Optional initial value override
}

export const OpenCashModal: React.FC<OpenCashModalProps> = ({ isOpen, onClose, onSuccess, initialValue }) => {
  const { openCash, dailyCash } = useCash();
  const { user } = useAuth();
  
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [openingObservation, setOpeningObservation] = useState('');

  // Initialize input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Logic: Use provided initialValue, or previous closing balance, or 0
      let val = '0';
      if (initialValue !== undefined) {
        val = initialValue.toString();
      } else if (dailyCash.closingBalance !== null && dailyCash.closingBalance !== undefined) {
        val = dailyCash.closingBalance.toString();
      }
      setOpeningBalanceInput(val);
      setOpeningObservation('');
    }
  }, [isOpen, initialValue, dailyCash.closingBalance]);

  const handleConfirm = async () => {
    const amount = parseFloat(openingBalanceInput);
    if (isNaN(amount)) return alert('Insira um valor inicial válido');
    
    // Call Context Open Action
    await openCash(amount, user?.user_metadata?.name || 'Usuário Atual', openingObservation);
    
    if (onSuccess) onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl relative">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Unlock className="text-emerald-500" /> Abertura de Caixa
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Saldo Inicial (Fundo de Troco)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
              <input 
                type="number" 
                autoFocus
                value={openingBalanceInput}
                onChange={e => setOpeningBalanceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-2xl font-bold text-white outline-none focus:border-emerald-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Observações</label>
            <textarea 
              value={openingObservation}
              onChange={e => setOpeningObservation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-indigo-500 h-24 resize-none"
              placeholder="Alguma observação sobre a abertura..."
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
