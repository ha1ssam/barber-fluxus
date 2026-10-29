'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Toast } from './ui/basic';

type ToastType = 'success' | 'error' | 'info';
interface Item {
  id: number;
  type: ToastType;
  message: string;
}

const Ctx = createContext<(type: ToastType, message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, type, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((i) => (
          <Toast key={i.id} type={i.type}>
            {i.message}
          </Toast>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
