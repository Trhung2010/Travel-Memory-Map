import type {JourneyState} from './types';
import {parseJourneyState} from './validation.ts';

export function referencedMedia(state:JourneyState){
  return new Set([...state.memories.flatMap(item=>item.uri?[item.uri]:[]),...state.trips.flatMap(item=>item.coverUri?[item.coverUri]:[])]);
}

type Options={write:(raw:string)=>Promise<void>;remove:(uri:string)=>void;onChange:(state:JourneyState)=>void;onError:(error:string)=>void};

// Single owner of live state and the disk queue. Import is exclusive until durable.
export function createJourneyStore(initial:JourneyState,options:Options){
  let state=initial;
  let queue=Promise.resolve();
  let failed=false;
  let importing=false;
  const fail=()=>{
    if(!failed){failed=true;options.onError('Không thể lưu dữ liệu. Các thay đổi gần đây có thể chưa được ghi. Hãy giữ ứng dụng mở và sao lưu trước khi khởi động lại.');}
  };
  const available=()=>{
    if(failed)throw new Error('Lưu trữ đang có lỗi. Đã tạm dừng thay đổi dữ liệu.');
    if(importing)throw new Error('Đang khôi phục chuyến đi. Vui lòng chờ hoàn tất.');
  };
  const checked=(next:JourneyState)=>parseJourneyState(JSON.stringify(next));
  return {
    getState:()=>state,
    flush:()=>queue,
    async cleanup(run:(uris:string[])=>number){
      available();await queue;available();
      return run([...referencedMedia(state)]);
    },
    mutate(update:(current:JourneyState)=>JourneyState){
      available();
      const next=checked(update(state));
      const retained=referencedMedia(next);
      const removed=[...referencedMedia(state)].filter(uri=>!retained.has(uri));
      const snapshot=JSON.stringify(next);
      state=next;options.onChange(state);
      queue=queue.then(async()=>{
        await options.write(snapshot);
        const live=referencedMedia(state);
        for(const uri of removed)if(!live.has(uri)){try{options.remove(uri);}catch{/* Orphans can be cleaned later. */}}
      });
      void queue.catch(fail);
    },
    async import(update:(current:JourneyState)=>JourneyState){
      available();
      const next=checked(update(state));
      importing=true;
      try{
        await queue;
        await options.write(JSON.stringify(next));
        state=next;options.onChange(state);
      }catch(error){fail();throw error;}finally{importing=false;}
    },
  };
}
