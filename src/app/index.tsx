import { Redirect } from 'expo-router';

// Entry point — redirect to tabs; the tabs layout handles onboarding check.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
