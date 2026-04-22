import { View, Text } from 'react-native';

export default function TodosSkeleton() {
  return (
    <>
      <Text className="mb-4 h-4 w-24 rounded bg-zinc-200 animate-pulse" />

      <View className="gap-2 w-full">
        {Array.from({ length: 5 }).map((_, idx) => (
          <View key={idx} className="flex-row items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <View className="flex-row items-center gap-3">
              <View className="h-4 w-4 rounded bg-zinc-200 animate-pulse" />
              <View className="h-4 flex-1 rounded bg-zinc-200 animate-pulse" style={{ maxWidth: `${40 + ((idx * 17) % 40)}%` }} />
            </View>

            <View className="h-9 w-5 flex-row items-center justify-center">
              <View className="h-5 w-5 rounded bg-zinc-200 animate-pulse" />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}
