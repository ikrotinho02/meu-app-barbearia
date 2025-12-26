import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketingConfig } from '../types';

interface MarketingContextType {
  config: MarketingConfig;
  updateConfig: (newConfig: Partial<MarketingConfig>) => void;
  calculateDiscount: (coins: number) => number;
}

const DEFAULT_CONFIG: MarketingConfig = {
  currencyName: 'BurnCoins',
  exchangeRate: 1.00, // 1 Coin = R$ 1.00
  referralBonus: 10, // 10 Coins for referring a friend
  registerBonus: 5,
};

const MarketingContext = createContext<MarketingContextType>({} as MarketingContextType);

export const MarketingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<MarketingConfig>(() => {
    const saved = localStorage.getItem('burn_marketing_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('burn_marketing_config', JSON.stringify(config));
  }, [config]);

  const updateConfig = (newConfig: Partial<MarketingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const calculateDiscount = (coins: number) => {
    return coins * config.exchangeRate;
  };

  return (
    <MarketingContext.Provider value={{ config, updateConfig, calculateDiscount }}>
      {children}
    </MarketingContext.Provider>
  );
};

export const useMarketing = () => useContext(MarketingContext);