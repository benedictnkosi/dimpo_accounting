import { Redirect } from 'expo-router';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'has a shadow set but cannot calculate shadow efficiently',
]);

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
