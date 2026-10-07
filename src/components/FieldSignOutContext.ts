import { createContext } from 'react';
export const FieldSignOutContext = createContext<(() => Promise<void>) | null>(null);
