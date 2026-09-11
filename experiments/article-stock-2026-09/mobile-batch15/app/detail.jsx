import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
export default function Detail() {
  const { item } = useLocalSearchParams();
  return <View style={{ flex: 1, backgroundColor: '#e7f2e9', padding: 30 }}><Text>Article startup lab: detail {item}</Text></View>;
}
