import AsyncStorage from './storage';
import React,{createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import type {JourneyMemory,JourneyState,MemoryDraft,Trip,TripDraft} from './types';
import {deriveTripStatus,parseJourneyState,validateTripDraft} from './validation';
import {removeJourneyAsset,removeOrphanJourneyAssets} from './media';
import {createJourneyStore} from './persistence';

const STORAGE_KEY='travel-memory-map:v1';
type JourneyContextValue=JourneyState&{
  ready:boolean;storageError:string;trash:JourneyMemory[];activeTrip?:Trip;
  setActiveTripId:(id:string)=>void;
  cleanStorage:()=>Promise<number>;
  createTrip:(input:TripDraft)=>Trip;
  updateTrip:(id:string,input:TripDraft)=>void;
  deleteTrip:(id:string)=>void;
  createMemory:(input:MemoryDraft)=>JourneyMemory;
  updateMemory:(id:string,changes:Partial<MemoryDraft>)=>void;
  deleteMemory:(id:string)=>void;
  restoreMemory:(id:string)=>void;
  purgeMemory:(id:string)=>void;
  updateTripExtras:(id:string,changes:Pick<Trip,'coverUri'|'itinerary'|'trace'>)=>void;
  importTrip:(input:TripDraft & Pick<Trip,'coverUri'|'itinerary'>,memories:Array<Omit<MemoryDraft,'tripId'>>)=>Promise<Trip>;
};
const initialState:JourneyState={trips:[],memories:[]};
const JourneyContext=createContext<JourneyContextValue|null>(null);
function makeId(prefix:string){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}

export function JourneyProvider({children}:PropsWithChildren){
  const [state,setState]=useState<JourneyState>(initialState);
  const [activeTripId,setActiveTripId]=useState('');
  const [ready,setReady]=useState(false);
  const [storageError,setStorageError]=useState('');
  const store=useRef<ReturnType<typeof createJourneyStore>|null>(null);
  useEffect(()=>{
    let mounted=true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw=>{
      if(!mounted)return;
      const loaded=raw?parseJourneyState(raw):initialState;
      store.current=createJourneyStore(loaded,{
        write:snapshot=>AsyncStorage.setItem(STORAGE_KEY,snapshot),remove:removeJourneyAsset,
        onChange:next=>{if(mounted)setState(next);},onError:message=>{if(mounted)setStorageError(message);},
      });
      setState(loaded);
    }).catch(()=>{if(mounted)setStorageError('Không thể đọc dữ liệu hành trình. Dữ liệu cũ được giữ nguyên; đã tạm dừng ghi.');})
      .finally(()=>{if(mounted)setReady(true);});
    return()=>{mounted=false;};
  },[]);
  const currentStore=()=>{
    if(!store.current)throw new Error('Dữ liệu chưa sẵn sàng hoặc không thể đọc.');
    return store.current;
  };
  const createTrip=(input:TripDraft)=>{
    const valid=validateTripDraft(input);
    const trip:Trip={...valid,id:makeId('trip'),status:deriveTripStatus(valid.startDate,valid.endDate)};
    currentStore().mutate(current=>({...current,trips:[trip,...current.trips]}));
    setActiveTripId(trip.id);return trip;
  };
  const updateTripExtras=(id:string,changes:Partial<Trip>)=>currentStore().mutate(current=>{
    if(!current.trips.some(trip=>trip.id===id))throw new Error('Chuyến đi không còn tồn tại.');
    const trip=current.trips.find(item=>item.id===id)!;
    const next={...trip,...changes};
    if(next.itinerary?.some(item=>item.date<next.startDate||item.date>next.endDate))throw new Error('Ngày chuyến đi phải bao gồm các điểm lịch trình. Hãy chỉnh lịch trình trước.');
    return {...current,trips:current.trips.map(trip=>trip.id===id?{...trip,...changes,id:trip.id}:trip)};
  });
  const updateTrip=(id:string,input:TripDraft)=>updateTripExtras(id,validateTripDraft(input));
  const deleteTrip=(id:string)=>{
    currentStore().mutate(current=>({trips:current.trips.filter(trip=>trip.id!==id),memories:current.memories.filter(memory=>memory.tripId!==id)}));
    setActiveTripId('');
  };
  const createMemory=(input:MemoryDraft)=>{
    const memory:JourneyMemory={...input,id:makeId('memory'),title:input.title.trim()||'Kỷ niệm mới',note:input.note.trim(),createdAt:input.createdAt||new Date().toISOString()};
    currentStore().mutate(current=>({...current,memories:[memory,...current.memories]}));return memory;
  };
  const updateMemory=(id:string,changes:Partial<MemoryDraft>)=>currentStore().mutate(current=>{
    if(!current.memories.some(memory=>memory.id===id))throw new Error('Kỷ niệm không còn tồn tại.');
    return {...current,memories:current.memories.map(memory=>memory.id===id?{...memory,...changes,id:memory.id,title:changes.title?.trim()||memory.title,note:changes.note?.trim()??memory.note}:memory)};
  });
  const deleteMemory=(id:string)=>updateMemory(id,{deletedAt:new Date().toISOString()});
  const restoreMemory=(id:string)=>updateMemory(id,{deletedAt:undefined});
  const purgeMemory=(id:string)=>currentStore().mutate(current=>{
    const memory=current.memories.find(item=>item.id===id&&item.deletedAt);
    if(!memory)return current;
    if(memory.uri&&current.trips.some(trip=>trip.coverUri===memory.uri))throw new Error('Ảnh này đang làm ảnh bìa. Hãy đổi ảnh bìa trước khi xóa vĩnh viễn.');
    return {...current,memories:current.memories.filter(item=>item.id!==id)};
  });
  const importTrip=async(input:TripDraft & Pick<Trip,'coverUri'|'itinerary'>,memories:Array<Omit<MemoryDraft,'tripId'>>)=>{
    const valid=validateTripDraft(input);
    const trip:Trip={...valid,id:makeId('trip'),status:deriveTripStatus(valid.startDate,valid.endDate)};
    const imported=memories.map(memory=>({...memory,id:makeId('memory'),tripId:trip.id,createdAt:memory.createdAt||''}));
    await currentStore().import(current=>({trips:[trip,...current.trips],memories:[...imported,...current.memories]}));
    setActiveTripId(trip.id);return trip;
  };
  const activeTrip=state.trips.find(trip=>trip.id===activeTripId)??state.trips[0];
  const cleanStorage=()=>currentStore().cleanup(removeOrphanJourneyAssets);
  return <JourneyContext.Provider value={{...state,ready,storageError,activeTrip,setActiveTripId,cleanStorage,createTrip,updateTrip,deleteTrip,createMemory,updateMemory,deleteMemory,restoreMemory,purgeMemory,updateTripExtras,importTrip,memories:state.memories.filter(memory=>!memory.deletedAt),trash:state.memories.filter(memory=>!!memory.deletedAt)}}>{children}</JourneyContext.Provider>;
}
export function useJourney(){
  const context=useContext(JourneyContext);
  if(!context)throw new Error('useJourney must be used inside JourneyProvider');
  return context;
}
