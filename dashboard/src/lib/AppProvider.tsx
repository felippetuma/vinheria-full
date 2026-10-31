import React, { createContext, useCallback, useContext, useState } from 'react';
import { AppState } from './types';
// Estado global só em memória: configurações e triggers voltam a estes valores ao
// fechar o app (não há persistência). O host é um IP privado de exemplo e deve ser
// trocado na aba Config pelo IP da EC2.
export const DEFAULT_STATE: AppState = {
  settings: {
    host: '192.168.0.10', // <- IP FIWARE
    service: 'smart',
    servicePath: '/',
    entityType: 'Vinheria',
    cometNotifyUrl: 'http://sth-comet:8666/notify',
  },
  triggers: {
    temperature: { min: 10, max: 30 },
    humidity: { min: 60, max: 80 },
    luminosity: { min: 0, max: 40 },
  },
  selected: null,
  autoAlerts: true,
};

type Ctx = { state: AppState; ready: boolean; update: (patch: Partial<AppState>) => void };

const AppCtx = createContext<Ctx>({ state: DEFAULT_STATE, ready: true, update: () => {} });

export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  return <AppCtx.Provider value={{ state, ready: true, update }}>{children}</AppCtx.Provider>;
}