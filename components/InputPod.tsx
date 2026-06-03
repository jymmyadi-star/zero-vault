import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function InputPod({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  numberOfLines,
  autoCapitalize = 'none',
  autoCorrect = false,
  contextMenuHidden,
  rightElement,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  contextMenuHidden?: boolean;
  rightElement?: React.ReactNode;
  style?: any;
}) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.05)', '#00F0FF'],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.02)', 'rgba(0, 240, 255, 0.02)'],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text style={[styles.labelText, focused && styles.labelTextFocused]}>
          {label.toUpperCase()}
        </Text>
      )}
      <Animated.View style={[
        styles.inputRow, 
        { borderColor, backgroundColor },
        multiline && styles.inputRowMultiline
      ]}>
        <View style={[styles.iconContainer, multiline && styles.iconContainerMultiline]}>
          <Ionicons
            name={icon as any}
            size={20}
            color={focused ? '#00F0FF' : '#8E8E93'}
          />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            numberOfLines={numberOfLines}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            contextMenuHidden={contextMenuHidden}
            onFocus={onFocus}
            onBlur={onBlur}
            selectionColor="#00F0FF"
            keyboardAppearance="dark"
          />
        </View>
        {rightElement}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 4,
  },
  labelText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  labelTextFocused: {
    color: '#00F0FF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
  },
  inputRowMultiline: {
    height: 'auto',
    minHeight: 180,
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  iconContainer: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconContainerMultiline: {
    paddingTop: 4,
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    padding: 0,
    margin: 0,
  },
  inputMultiline: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
});
