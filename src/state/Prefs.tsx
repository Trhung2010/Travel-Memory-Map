import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Preferences = { grid: boolean; timer: 0|3|5|10; quality: number; autoGeoTag:boolean };
const defaults: Preferences = { grid: true, timer: 0, quality: 1, autoGeoTag:false };
const PrefContext = createContext<{prefs:Preferences; setPrefs:(updates:Partial<Preferences>)=>void} | null>(null);

export function PrefsProvider({ children }: {children:React.ReactNode}) {
  const [prefs, setState] = useState<Preferences>(defaults);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { let mounted = true;
    AsyncStorage.getItem('luma.prefs.v1').then(value => {
      if(mounted&&value){const parsed:unknown=JSON.parse(value);if(typeof parsed==='object'&&parsed!==null){const input=parsed as Partial<Preferences>;setState({grid:typeof input.grid==='boolean'?input.grid:defaults.grid,timer:[0,3,5,10].includes(Number(input.timer))?input.timer as Preferences['timer']:defaults.timer,quality:typeof input.quality==='number'&&input.quality>=.1&&input.quality<=1?input.quality:defaults.quality,autoGeoTag:typeof input.autoGeoTag==='boolean'?input.autoGeoTag:defaults.autoGeoTag});}}
    }).catch(console.warn).finally(()=> {if(mounted) setHydrated(true);});
    return ()=>{mounted=false};
  }, []);
  useEffect(()=>{if(hydrated) AsyncStorage.setItem('luma.prefs.v1',JSON.stringify(prefs)).catch(console.warn)},[prefs,hydrated]);
  const context = useMemo(()=>({prefs,setPrefs:(changes:Partial<Preferences>)=>setState(p=>({...p,...changes}))}),[prefs]);
  return <PrefContext.Provider value={context}>{children}</PrefContext.Provider>;
}
export function usePrefs(){const ctx=useContext(PrefContext); if(!ctx) throw new Error('PrefsProvider missing');return ctx;}
