import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { holeDb } from '../src/db/repo';
import { abstand, schrift, useFarben } from '../src/ui/theme';

export default function RootLayout() {
  const farben = useFarben();
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Die Datenbank muss stehen, bevor irgendein Screen sie anfragt — sonst laufen
  // Abfragen gegen eine noch nicht migrierte Datei.
  useEffect(() => {
    holeDb()
      .then(() => setBereit(true))
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  }, []);

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
