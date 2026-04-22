import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { authClient } from '../../lib/typebase/client/auth-client';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';

export default function IndexScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setLoading(true);

    const response = await authClient.signIn.email({
      email,
      password,
    });

    if (response.data) {
      router.replace('/(authed)');
      return;
    }

    setLoading(false);
    setError(response.error.message ?? 'Unknown error.');
  };

  return (
    <>
      <Stack.Screen
        options={{
          animation: 'none',
          headerLargeTitle: true,
          title: 'Sign In',
          headerTitleStyle: {
            color: '#18181b',
          },
          headerRight: () => (
            <Link href="/sign-up" asChild>
              <Button title="Sign up" />
            </Link>
          ),
        }}
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="pt-2 px-4">
        <View className="gap-y-4">
          <TextInput
            inputMode="email"
            placeholder="Email"
            value={email}
            onChangeText={(e) => setEmail(e)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500"
          />

          <TextInput
            inputMode="text"
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={(e) => setPassword(e)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500"
          />

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button disabled={loading} title={loading ? 'Loading...' : 'Sign in'} onPress={handleSignIn} />
        </View>
      </ScrollView>
    </>
  );
}
