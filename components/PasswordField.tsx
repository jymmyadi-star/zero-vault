import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InputPod } from './InputPod';
import { hapticTouch } from '../lib/haptics';

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  icon = 'lock-closed',
  keyboardType = 'default',
  contextMenuHidden = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon?: string;
  keyboardType?: any;
  contextMenuHidden?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <InputPod
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      icon={icon}
      keyboardType={keyboardType}
      secureTextEntry={!visible}
      contextMenuHidden={contextMenuHidden}
      rightElement={
        <TouchableOpacity
          onPress={() => { hapticTouch(); setVisible(!visible); }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={{ marginLeft: 8 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="rgba(255,255,255,0.25)"
          />
        </TouchableOpacity>
      }
    />
  );
}
