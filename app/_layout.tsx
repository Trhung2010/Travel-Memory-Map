import React, {useEffect} from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider } from '../src/state/Prefs';
import { C } from '../src/theme/colors';
import {AppState} from 'react-native';
import {flushOutgoing} from '../src/moments/queue';
import {syncWidget} from '../src/moments/widget';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({handleNotification:async()=>({
  shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false,
})});

export default function RootLayout() {
  const router=useRouter();
  useEffect(()=>{
    void flushOutgoing().catch(console.warn);
    void syncWidget().catch(console.warn);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active'){
      void flushOutgoing().catch(console.warn);
      void syncWidget().catch(console.warn);
    }});
    const response=Notifications.addNotificationResponseReceivedListener(event=>{
      const id=event.notification.request.content.data?.momentId;
      if(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id))router.push({pathname:'/moments/[scene]',params:{scene:'moment',id}});
      else router.push({pathname:'/moments/[scene]',params:{scene:'notifications'}});
    });
    return ()=>{subscription.remove();response.remove();};
  },[router]);
  return <SafeAreaProvider><PrefsProvider>
    <StatusBar style="light" />
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.bg},animation:'fade'}} />
  </PrefsProvider></SafeAreaProvider>;
}
