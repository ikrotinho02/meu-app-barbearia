import React, { useState, useEffect } from 'react';
import { User, Scissors, AlertCircle, Flame, Mail, Lock, Store, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AuthPage: React.FC = () => {
  const { signIn } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados do Formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Limpar erros e campos ao alternar entre Login e Cadastro
  useEffect(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setName('');
  }, [isRegistering]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn({
        email,
        password,
        isRegister: isRegistering,
        name: isRegistering ? name : undefined,
        role: 'professional' // Donos e Profissionais usam o mesmo fluxo no Burn App
      });
    } catch (err: any) {
      console.error('Auth Error:', err);
      // Mensagens de erro amigáveis
      let msg = 'Ocorreu um erro inesperado.';
      if (err.message === 'Invalid login credentials') {
        msg = 'Email ou senha incorretos.';
      } else if (err.message?.includes('User already registered')) {
        msg = 'Este email já está cadastrado.';
      } else {
        msg = err.message || msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans relative overflow-hidden selection:bg-red-500 selection:text-white">
      
      {/* Background Decorativo com Gradients Suaves */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Branding Burn App */}
        <div className="text-center mb-10 group cursor-default">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] mb-6 shadow-2xl shadow-red-900/20 border border-slate-800 relative transition-transform duration-500 hover:scale-105">
            <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Flame className="text-red-600 relative z-10 drop-shadow-lg animate-pulse" size={48} fill="currentColor" />
          </div>
          <h1 className="text-6xl font-heading font-black text-white tracking-tighter flex items-center justify-center gap-2 italic uppercase">
            BURN <span className="text-red-600">APP</span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium tracking-wide uppercase text-xs">
            Gestão Premium para Barbearias
          </p>
        </div>

        {/* Card de Autenticação */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden group/card">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50"></div>
          
          <form onSubmit={handleAuth} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="mb-4">
              <h3 className="text-white font-black text-2xl uppercase italic tracking-tight">
                {isRegistering ? 'Criar Conta' : 'Acessar Painel'}
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                {isRegistering ? 'Cadastre seu negócio e comece agora.' : 'Bem-vindo de volta, Barbeiro!'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-xs animate-in shake-in duration-300">
                 <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                 <span className="font-bold">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Nome Completo (Somente Registro) */}
              {isRegistering && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase font-black text-slate-500 ml-1 tracking-[0.2em]">
                    Nome da Barbearia / Dono
                  </label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-12 py-4 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-slate-700 font-medium"
                      placeholder="Ex: Barber Shop Burn"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-[0.2em] block">
                  E-mail Profissional
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-12 py-4 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-slate-700 font-medium"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-[0.2em] block">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-12 py-4 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-slate-700 font-medium"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest py-5 rounded-2xl shadow-xl shadow-red-900/30 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-3 group/btn"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Scissors size={20} className="transition-transform group-hover/btn:rotate-12" />
                  {isRegistering ? 'Cadastrar Negócio' : 'Entrar no Sistema'}
                  <ArrowRight size={18} className="opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                </>
              )}
            </button>
          </form>

          {/* Alternar entre Login e Registro */}
          <div className="mt-10 text-center border-t border-slate-800 pt-8">
            <p className="text-slate-500 text-sm font-medium">
              {isRegistering ? 'Já possui acesso?' : 'Ainda não é parceiro?'}
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="ml-2 text-red-500 font-black uppercase tracking-widest text-[10px] hover:text-red-400 transition-colors underline-offset-4 hover:underline outline-none"
              >
                {isRegistering ? 'Fazer Login' : 'Começar Grátis'}
              </button>
            </p>
          </div>
        </div>
        
        <p className="text-center text-slate-700 text-[9px] mt-10 uppercase font-black tracking-[0.3em] opacity-40">
          Burn App CRM &copy; 2024 - Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};
