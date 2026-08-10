import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { router, Stack } from 'expo-router';
import { holeDb, leseEinstellung } from '../src/db/repo';
import { SCHLUESSEL_ONBOARDING } from './willkommen';
import { abstand, schrift, useFarben } from '../src/ui/theme';

// Ohne das blendet expo-router den Startbildschirm aus, sobald der erste Screen
// rendert — also bevor die Datenbank offen ist. Dann sieht man das gestaltete Bild
// nur aufblitzen und danach einen Ladekreis.
void SplashScreen.preventAutoHideAsync();

/**
 * Der Startbildschirm bleibt mindestens so lange stehen. Ohne das wäre er auf einem
 * schnellen Gerät nach einer halben Sekunde wieder weg — zu kurz, um ihn zu lesen,
 * und es wirkt wie ein Flackern statt wie ein Anfang.
 */
const MINDESTDAUER_MS = 2000;
const GESTARTET_UM = Date.now();

export default function RootLayout() {
  const farben = useFarben();
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeigeWillkommen, setZeigeWillkommen] = useState(false);

  // Die Datenbank muss stehen, bevor irgendein Screen sie anfragt — sonst laufen
  // Abfragen gegen eine noch nicht migrierte Datei.
  useEffect(() => {
    holeDb()
      .then(async () => {
        setZeigeWillkommen((await leseEinstellung(SCHLUESSEL_ONBOARDING)) !== 'ja');
        setBereit(true);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  }, []);

  // Der Startbildschirm bleibt stehen, bis wirklich etwas anzuzeigen ist — und dann
  // noch, bis die Mindestdauer erreicht ist.
  useEffect(() => {
    if (!bereit && !fehler) return;
    const rest = Math.max(0, MINDESTDAUER_MS - (Date.now() - GESTARTET_UM));
    const zeitgeber = setTimeout(() => void SplashScreen.hideAsync(), rest);
    return () => clearTimeout(zeitgeber);
  }, [bereit, fehler]);

  // Erst wenn der Navigator steht, darf umgeleitet werden.
  useEffect(() => {
    if (bereit && zeigeWillkommen) router.replace('/willkommen');
  }, [bereit, zeigeWillkommen]);

  if (fehler) {
    return (
      <View style={[styles.zentriert, { backgroundColor: farben.hintergrund }]}>
        <Text style={[schrift.ueberschrift, { color: farben.text, marginBottom: abstand.s }]}>
          Datenbank lässt sich nicht öffnen
        </Text>
        <Text style={[schrift.klein, { color: farben.textGedaempft, textAlign: 'center' }]}>{fehler}</Text>
      </View>
    );
  }

  if (!bereit) {
    return (
      <View style={[styles.zentriert, { backgroundColor: farben.hintergrund }]}>
        <ActivityIndicator color={farben.akzent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: farben.hintergrund },
            headerTintColor: farben.text,
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: farben.hintergrund },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="willkommen" options={{ headerShown: false }} />
          <Stack.Screen name="analyse" options={{ title: 'Tiefenanalyse' }} />
          <Stack.Screen name="pruefen" options={{ title: 'Prüfen und übernehmen', presentation: 'modal' }} />
          <Stack.Screen name="forderung/[id]" options={{ title: 'Forderung' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  zentriert: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: abstand.xl },
});
