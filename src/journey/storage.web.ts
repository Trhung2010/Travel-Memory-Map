import AsyncStorage from '@react-native-async-storage/async-storage';

function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  const request=indexedDB.open('travel-memory-map',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('state');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});}
export default {
  async getItem(key:string):Promise<string|null>{
    const db=await open();
    const value=await new Promise<string|undefined>((resolve,reject)=>{
      const tx=db.transaction('state','readonly');
      const request=tx.objectStore('state').get(key);
      tx.oncomplete=()=>{db.close();resolve(request.result);};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
    return value??await AsyncStorage.getItem(key);
  },
  async setItem(key:string,value:string):Promise<void>{
    const db=await open();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('state','readwrite');
      tx.objectStore('state').put(value,key);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onabort=()=>{db.close();reject(tx.error||new Error('Không đủ dung lượng lưu trữ trình duyệt.'));};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  },
};
