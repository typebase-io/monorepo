import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { authClient } from '../../lib/typebase/client/auth-client';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

export default function SignUpScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');
    setLoading(true);

    const response = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (response.data) {
      router.back();
      return;
    }

    setLoading(false);
    setError(response.error.message ?? 'Unknown error.');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerLargeTitle: true,
          title: 'Sign Up',
          headerTitleStyle: {
            color: '#18181b',
          },
        }}
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="pt-2 px-4">
        <View className="gap-y-4">
          <TextInput
            inputMode="text"
            placeholder="Name"
            value={name}
            onChangeText={(e) => setName(e)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500"
          />

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

          <Button disabled={loading} title={loading ? 'Loading...' : 'Sign up'} onPress={handleSignUp} />
        </View>
      </ScrollView>
    </>
  );
}
