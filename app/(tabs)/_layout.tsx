import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useFarben } from '../../src/ui/theme';

/**
 * Drei Tabs, mehr braucht es nicht: was liegt an, etwas Neues erfassen, und die
 * eigenen Zahlen. Symbole als Text, damit keine Icon-Bibliothek nötig ist.
 */
function TabSymbol({ zeichen, farbe }: { zeichen: string; farbe: ColorValue }) {
  return <Text style={{ fontSize: 22, color: farbe }}>{zeichen}</Text>;
}

export default function TabsLayout() {
  const farben = useFarben();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: farben.akzent,
        tabBarInactiveTintColor: farben.textGedaempft,
        tabBarStyle: { backgroundColor: farben.flaeche, borderTopColor: farben.rand },
        headerStyle: { backgroundColor: farben.hintergrund },
        headerTintColor: farben.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: farben.hintergrund },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Übersicht',
          tabBarIcon: ({ color }) => <TabSymbol zeichen="≡" farbe={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Brief erfassen',
          tabBarLabel: 'Scannen',
          tabBarIcon: ({ color }) => <TabSymbol zeichen="⌗" farbe={color} />,
        }}
      />
      <Tabs.Screen
        name="einstellungen"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color }) => <TabSymbol zeichen="⚙" farbe={color} />,
        }}
      />
    </Tabs>
  );
}
