import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const hapticTouch = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

export const hapticMedium = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
};

export const hapticHeavy = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
};

export const hapticSuccess = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

export const hapticWarning = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
};

export const hapticError = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
};
