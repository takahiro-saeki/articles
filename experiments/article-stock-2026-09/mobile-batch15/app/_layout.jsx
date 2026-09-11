import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { initialURL, trace } from '../trace';

trace('prevent-request');
void SplashScreen.preventAutoHideAsync().then(value => trace('prevent-result', { value }));

export default function RootLayout() {
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({ ProbeFont: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') });
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState(null);
  const ready = (fontsLoaded || fontError) && authReady && mode !== null;

  useEffect(() => {
    trace('root-effect', { currentState: AppState.currentState });
    const state = AppState.addEventListener('change', value => trace('app-state', { value }));
    const url = Linking.addEventListener('url', value => trace('url-event', value));
    void Promise.all([initialURL, fetch('http://127.0.0.1:9915/mode').then(response => response.json())])
      .then(([url, config]) => setMode(url?.includes('mode=early') ? 'early' : config.mode));
    trace('auth-start', { implementation: 'local delayed fixture; no credentials' });
    let active = true;
    void fetch('http://127.0.0.1:9915/auth').then(response => response.json()).then(() => {
      if (active) { trace('auth-ready'); setAuthReady(true); }
    });
    return () => { active = false; state.remove(); url.remove(); };
  }, []);
  useEffect(() => { trace('router-path', { pathname }); }, [pathname]);
  useEffect(() => {
    if (fontsLoaded || fontError) trace('font-ready', { fontsLoaded, error: fontError?.message ?? null });
  }, [fontsLoaded, fontError]);
  useEffect(() => {
    if (mode === 'early' && (fontsLoaded || fontError)) {
      trace('hide-request', { mode, authReady });
      void SplashScreen.hideAsync().then(() => trace('hide-result', { mode }));
    }
  }, [mode, fontsLoaded, fontError]);
  if (!ready) return null;
  return <View style={{ flex: 1 }} onLayout={() => {
    trace('content-layout', { mode, authReady });
    if (mode === 'coordinated') {
      trace('hide-request', { mode, authReady });
      void SplashScreen.hideAsync().then(() => trace('hide-result', { mode }));
    }
  }}><Stack /></View>;
}
