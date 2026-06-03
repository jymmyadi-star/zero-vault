import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="upgrade-identity" />
      <Stack.Screen name="join-vault" />
    </Stack>
  );
}
