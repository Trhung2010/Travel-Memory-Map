import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider } from '../src/state/Prefs';
import { JourneyProvider } from '../src/journey/JourneyContext';
import { C } from '../src/theme/colors';
import {DiaryLock,DiaryNotifications} from '../src/journey/Privacy';

export default function RootLayout() {
  return <SafeAreaProvider><PrefsProvider><JourneyProvider>
    <StatusBar style="light" />
    <DiaryLock>
      <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.bg},animation:'fade'}} />
      <DiaryNotifications/>
    </DiaryLock>
  </JourneyProvider></PrefsProvider></SafeAreaProvider>;
}
