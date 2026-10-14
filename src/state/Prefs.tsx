import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Preferences = { grid: boolean; timer: 0|3|5|10; quality: number };
const defaults: Preferences = { grid: true, timer: 0, quality: 1 };
const PrefContext = createContext<{prefs:Preferences; setPrefs:(updates:Partial<Preferences>)=>void} | null>(null);

export function PrefsProvider({ children }: {children:React.ReactNode}) {
  const [prefs, setState] = useState<Preferences>(defaults);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { let mounted = true;
    AsyncStorage.getItem('luma.prefs.v1').then(value => {
      if (mounted && value) setState({...defaults, ...JSON.parse(value)});
    }).catch(console.warn).finally(()=> {if(mounted) setHydrated(true);});
    return ()=>{mounted=false};
  }, []);
  useEffect(()=>{if(hydrated) AsyncStorage.setItem('luma.prefs.v1',JSON.stringify(prefs)).catch(console.warn)},[prefs,hydrated]);
  const context = useMemo(()=>({prefs,setPrefs:(changes:Partial<Preferences>)=>setState(p=>({...p,...changes}))}),[prefs]);
  return <PrefContext.Provider value={context}>{children}</PrefContext.Provider>;
}
export function usePrefs(){const ctx=useContext(PrefContext); if(!ctx) throw new Error('PrefsProvider missing');return ctx;}
