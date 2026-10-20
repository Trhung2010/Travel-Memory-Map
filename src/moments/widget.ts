import AsyncStorage from '@react-native-async-storage/async-storage';
import {Directory,File,Paths} from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import {widgetModule} from '../../modules/luma-widget';
import * as api from './api';

const SOURCE_KEY='luma.widget.sender.v1';
export const widgetAvailable=()=>widgetModule()!==null;
export const getWidgetSource=()=>AsyncStorage.getItem(SOURCE_KEY);
export const setWidgetSource=async (id:string|null)=>{
  if(id)await AsyncStorage.setItem(SOURCE_KEY,id);
  else await AsyncStorage.removeItem(SOURCE_KEY);
  await syncWidget();
};
let syncing=false;
export async function syncWidget(){
  const native=widgetModule();
  if(!native||syncing||!api.configured())return;
  syncing=true;
  try{
    const account=await api.session();
    if(!account){await native.clear();return;}
    const sender=await getWidgetSource();
    const recent=await api.moments('inbox');
    const latest=recent.find(m=>!sender||m.owner_id===sender);
    if(!latest){await native.clear();return;}
    const signed=await api.photoUrl(latest.media_path);
    const folder=new Directory(Paths.cache,'LUMA-widget');
    if(!folder.exists)folder.create({intermediates:true,idempotent:true});
    const target=new File(folder,'latest.jpg');
    const response=await LegacyFS.downloadAsync(signed,target.uri);
    if(response.status<200||response.status>=300)throw new Error('Không tải được ảnh widget');
    await native.setLatest(target.uri,`LUMA · ${new Date(latest.created_at).toLocaleString('vi-VN')}`);
  }finally{syncing=false;}
}
export async function clearWidget(){
  await AsyncStorage.removeItem(SOURCE_KEY);
  await widgetModule()?.clear();
}
