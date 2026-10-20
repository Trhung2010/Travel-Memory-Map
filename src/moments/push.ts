import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import * as api from './api';

const TOKEN_KEY='luma.push.token.v1';
export async function enablePush():Promise<string>{
  if(Platform.OS!=='android')throw new Error('Thông báo đẩy hiện được triển khai cho Android.');
  if(!api.configured())throw new Error('Chưa cấu hình Supabase.');
  const projectId=Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if(typeof projectId!=='string'||!projectId)throw new Error('Cần EAS projectId trong cấu hình build để đăng ký thông báo đẩy.');
  await Notifications.setNotificationChannelAsync('moments',{name:'Khoảnh khắc',importance:Notifications.AndroidImportance.HIGH});
  let permission=await Notifications.getPermissionsAsync();
  if(!permission.granted)permission=await Notifications.requestPermissionsAsync();
  if(!permission.granted)throw new Error('Bạn chưa cấp quyền thông báo.');
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  await api.registerPushToken(token);
  await AsyncStorage.setItem(TOKEN_KEY,token);
  return token;
}
export async function disablePush(){
  const token=await AsyncStorage.getItem(TOKEN_KEY);
  if(token){
    await api.removePushToken(token);
    await Notifications.unregisterForNotificationsAsync();
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}
export async function pushEnabled(){return Boolean(await AsyncStorage.getItem(TOKEN_KEY));}
