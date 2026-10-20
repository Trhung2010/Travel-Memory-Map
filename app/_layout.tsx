import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider } from '../src/state/Prefs';
import { C } from '../src/theme/colors';

export default function RootLayout() {
  return <SafeAreaProvider><PrefsProvider>
    <StatusBar style="light" />
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.bg},animation:'fade'}} />
  </PrefsProvider></SafeAreaProvider>;
}
