
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OperatingHours, ShopProfile, ThemeConfig } from '../types';
import { supabase } from '../services/dbClient';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  theme: ThemeConfig;
  shopProfile: ShopProfile;
  operatingHours: OperatingHours[];
  agendaDisplayUntil: string;
  setTheme: (theme: ThemeConfig) => void;
  setShopProfile: (profile: ShopProfile) => void;
  setOperatingHours: (hours: OperatingHours[]) => void;
  setAgendaDisplayUntil: (time: string) => void;
  updateBrandColor: (colorHex: string) => void;
  toggleTheme: () => void;
  applyHoursToAll: (start: string, end: string, onlyWorkDays: boolean) => void;
  saveSettingsToDb: () => Promise<void>; 
  isLoadingSettings: boolean;
}

const DEFAULT_HOURS: OperatingHours[] = [
  { dayIndex: 0, dayName: 'Domingo', isOpen: false, start: '09:00', end: '14:00' },
  { dayIndex: 1, dayName: 'Segunda', isOpen: true, start: '09:00', end: '20:00' },
  { dayIndex: 2, dayName: 'Terça', isOpen: true, start: '09:00', end: '20:00' },
  { dayIndex: 3, dayName: 'Quarta', isOpen: true, start: '09:00', end: '20:00' },
  { dayIndex: 4, dayName: 'Quinta', isOpen: true, start: '09:00', end: '20:00' },
  { dayIndex: 5, dayName: 'Sexta', isOpen: true, start: '09:00', end: '20:00' },
  { dayIndex: 6, dayName: 'Sábado', isOpen: true, start: '09:00', end: '18:00' },
];

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Estados Locais (Iniciados com Padrões)
  const [theme, setThemeState] = useState<ThemeConfig>({ mode: 'dark', brandColor: '#6366f1', agendaInterval: 30 });
  const [shopProfile, setShopProfile] = useState<ShopProfile>({ name: 'Burn App', slogan: 'A chama do seu negócio.', logoUrl: null, news: '' });
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>(DEFAULT_HOURS);
  const [agendaDisplayUntil, setAgendaDisplayUntil] = useState<string>('21:00');

  // Helper para injetar cores no CSS do Tailwind
  const updateCssVariables = useCallback((color: string) => {
    const r = document.documentElement;
    r.style.setProperty('--brand-color', color);
    r.style.setProperty('--brand-500', color);
    r.style.setProperty('--brand-600', color); 
    r.style.setProperty('--brand-400', color + 'CC');
    r.style.setProperty('--brand-700', color + 'EE');
    
    // Injeta variações de tons para o Tailwind usar var(--brand-X)
    // Nota: Em um cenário real, você poderia calcular tons mais claros/escuros aqui
  }, []);

  // 1. CARREGAMENTO INICIAL: Função para buscar dados do Supabase
  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingSettings(true);
    try {
      console.log(`[THEME] Buscando configurações persistentes para user: ${user.id}`);
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data && data.settings) {
        const s = data.settings;
        console.log('[THEME] Dados carregados com sucesso:', s);
        
        // Aplica o Tema e Cores
        if (s.theme) {
          setThemeState(s.theme);
          updateCssVariables(s.theme.brandColor);
          if (s.theme.mode === 'dark') document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }
        
        // Aplica Perfil, Horários e Agenda
        if (s.shopProfile) setShopProfile(s.shopProfile);
        if (s.operatingHours) setOperatingHours(s.operatingHours);
        if (s.agendaDisplayUntil) setAgendaDisplayUntil(s.agendaDisplayUntil);
      } else {
        console.log('[THEME] Nenhuma configuração personalizada encontrada. Usando padrões.');
      }
    } catch (err) {
      console.error('[THEME] Erro ao carregar configurações persistentes:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [user, updateCssVariables]);

  // Trigger automático ao logar
  useEffect(() => {
    if (user) {
        fetchSettings();
    }
  }, [user, fetchSettings]);

  // 2. SALVAMENTO REAL: Função que persiste no banco
  const saveSettingsToDb = async () => {
    if (!user) return;
    
    try {
      const settingsBlob = {
        theme,
        shopProfile,
        operatingHours,
        agendaDisplayUntil
      };

      console.log('[THEME] Persistindo configurações via UPSERT...');
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: settingsBlob,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      // Feedback local rápido
      localStorage.setItem('burn_last_brand_color', theme.brandColor);
    } catch (err) {
      console.error('[THEME] Falha crítica ao salvar configurações:', err);
      throw err;
    }
  };

  // Efeito para sincronizar classe 'dark' e cores CSS em tempo real (UI Responsiva)
  useEffect(() => {
    const root = document.documentElement;
    if (theme.mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    
    updateCssVariables(theme.brandColor);
  }, [theme.mode, theme.brandColor, updateCssVariables]);

  const applyHoursToAll = (start: string, end: string, onlyWorkDays: boolean) => {
    setOperatingHours(prev => prev.map(h => {
      if (onlyWorkDays && (h.dayIndex === 0 || h.dayIndex === 6)) return h;
      return { ...h, start, end, isOpen: true };
    }));
  };

  return (
    <ThemeContext.Provider value={{
      theme, shopProfile, operatingHours, agendaDisplayUntil,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState(p => ({ ...p, mode: p.mode === 'dark' ? 'light' : 'dark' })),
      setShopProfile, setOperatingHours, setAgendaDisplayUntil,
      updateBrandColor: (brandColor) => setThemeState(p => ({ ...p, brandColor })),
      applyHoursToAll, saveSettingsToDb, isLoadingSettings
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
