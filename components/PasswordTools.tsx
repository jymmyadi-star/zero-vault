import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { estimatePasswordStrength, type StrengthResult } from '@/lib/password-strength';
import { generatePassword, generatePassphrase, type GeneratorOptions } from '@/lib/password-generator';
import { importVaultCSV, type ImportedItem } from '@/lib/vault-import';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

// ─── Password Strength Meter ─────────────────────────────────

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = estimatePasswordStrength(password);
  if (!password) return null;

  return (
    <Animated.View entering={FadeInDown.duration(200)} className="mt-2">
      <View className="flex-row items-center gap-1.5 mb-1">
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View
            key={level}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: level <= strength.score ? strength.color : '#E5E7EB' }}
          />
        ))}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs font-semibold" style={{ color: strength.color }}>
          {strength.label}
        </Text>
        <Text className="text-xs text-text-tertiary">
          {strength.crackTimeDisplay} to crack
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Password Generator ──────────────────────────────────────

export function PasswordGenerator({
  onSelect,
  onClose,
}: {
  onSelect: (password: string) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<GeneratorOptions>({
    length: 16,
    includeUppercase: true,
    includeDigits: true,
    includeSymbols: true,
    excludeAmbiguous: false,
  });
  const [generated, setGenerated] = useState(() => generatePassword(options));
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [wordCount, setWordCount] = useState(4);

  const regenerate = useCallback(() => {
    if (mode === 'passphrase') {
      setGenerated(generatePassphrase(wordCount));
    } else {
      setGenerated(generatePassword(options));
    }
  }, [options, mode, wordCount]);

  return (
    <View className="bg-white rounded-bento-lg p-5 shadow-bento-md border border-gray-100/50">
      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          onPress={() => setMode('password')}
          className={`flex-1 py-2 rounded-pill items-center ${mode === 'password' ? 'bg-brand-indigo' : 'bg-gray-100'}`}
        >
          <Text className={`text-xs font-semibold ${mode === 'password' ? 'text-white' : 'text-gray-500'}`}>Password</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode('passphrase')}
          className={`flex-1 py-2 rounded-pill items-center ${mode === 'passphrase' ? 'bg-brand-indigo' : 'bg-gray-100'}`}
        >
          <Text className={`text-xs font-semibold ${mode === 'passphrase' ? 'text-white' : 'text-gray-500'}`}>Passphrase</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
        <Text className="text-base font-mono text-text-primary text-center select-all" selectable>
          {generated}
        </Text>
        <PasswordStrengthMeter password={generated} />
      </View>

      {mode === 'password' ? (
        <View className="gap-2 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-text-secondary">Length: {options.length}</Text>
            <View className="flex-row gap-1">
              {[8, 12, 16, 24, 32].map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => setOptions({ ...options, length: l })}
                  className={`px-2 py-0.5 rounded-pill ${options.length === l ? 'bg-brand-indigo' : 'bg-gray-200'}`}
                >
                  <Text className={`text-[10px] font-semibold ${options.length === l ? 'text-white' : 'text-gray-500'}`}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-text-secondary">Uppercase</Text>
            <Switch value={options.includeUppercase} onValueChange={(v) => setOptions({ ...options, includeUppercase: v })} />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-text-secondary">Digits</Text>
            <Switch value={options.includeDigits} onValueChange={(v) => setOptions({ ...options, includeDigits: v })} />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-text-secondary">Symbols</Text>
            <Switch value={options.includeSymbols} onValueChange={(v) => setOptions({ ...options, includeSymbols: v })} />
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs text-text-secondary">Words</Text>
          <View className="flex-row gap-1">
            {[3, 4, 5, 6, 8].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setWordCount(n)}
                className={`px-2 py-0.5 rounded-pill ${wordCount === n ? 'bg-brand-indigo' : 'bg-gray-200'}`}
              >
                <Text className={`text-[10px] font-semibold ${wordCount === n ? 'text-white' : 'text-gray-500'}`}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View className="flex-row gap-2">
        <TouchableOpacity onPress={regenerate} className="flex-1 bg-gray-100 rounded-pill py-3 items-center">
          <Text className="text-sm font-semibold text-text-secondary">Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSelect(generated)} className="flex-1 bg-brand-indigo rounded-pill py-3 items-center">
          <Text className="text-sm font-bold text-white">Use Password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CSV Import ──────────────────────────────────────────────

export function VaultImport({
  onImport,
  onClose,
}: {
  onImport: (items: ImportedItem[]) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [csvText, setCsvText] = useState('');

  const handleParseCSV = () => {
    setLoading(true);
    const importResult = importVaultCSV(csvText);
    if (importResult.errors.length > 0) {
      setError(importResult.errors[0]!);
      setPreview(null);
    } else {
      setPreview(importResult.items);
      setError(null);
    }
    setLoading(false);
  };

  const confirmImport = () => {
    if (preview && preview.length > 0) {
      onImport(preview);
    }
  };

  return (
    <View className="bg-white rounded-bento-lg p-5 shadow-bento-md border border-gray-100/50">
      <Text className="text-sm font-bold text-text-primary mb-1">Import Vault</Text>
      <Text className="text-xs text-text-tertiary mb-4">
        Import passwords from Bitwarden or 1Password CSV export.
      </Text>

      {!preview && (
        <View>
          <TextInput
            placeholder="Paste your Bitwarden/1Password CSV export here..."
            value={csvText}
            onChangeText={setCsvText}
            multiline
            numberOfLines={5}
            className="bg-gray-50 rounded-lg p-3 text-xs text-text-primary mb-3 border border-gray-100 min-h-[80px]"
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            onPress={handleParseCSV}
            disabled={loading || !csvText.trim()}
            className="bg-brand-indigo rounded-pill py-3.5 items-center mb-3"
            style={{ opacity: csvText.trim() ? 1 : 0.5 }}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-bold text-sm">Parse CSV</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View className="bg-red-50 rounded-lg p-3 mb-3">
          <Text className="text-xs text-red-600">{error}</Text>
        </View>
      )}

      {preview && (
        <Animated.View entering={FadeInUp.duration(300)}>
          <View className="bg-green-50 rounded-lg p-3 mb-3 flex-row items-center gap-2">
            <Text className="text-sm font-bold text-green-700">{preview.length} items found</Text>
            <Text className="text-xs text-green-600">
              ({preview.filter(i => i.type === 'password').length} passwords, {preview.filter(i => i.type === 'note').length} notes)
            </Text>
          </View>

          <ScrollView className="max-h-48 mb-3">
            {preview.slice(0, 20).map((item, i) => (
              <View key={i} className="flex-row items-center gap-2 py-1.5 border-b border-gray-50">
                <Text className="text-xs font-semibold text-text-primary flex-1" numberOfLines={1}>{item.title}</Text>
                <Text className="text-[10px] text-text-tertiary">{item.type}</Text>
              </View>
            ))}
            {preview.length > 20 && (
              <Text className="text-xs text-text-tertiary text-center mt-2">... and {preview.length - 20} more</Text>
            )}
          </ScrollView>

          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => { setPreview(null); setError(null); }} className="flex-1 bg-gray-100 rounded-pill py-3 items-center">
              <Text className="text-sm font-semibold text-text-secondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmImport} className="flex-1 bg-brand-indigo rounded-pill py-3 items-center">
              <Text className="text-sm font-bold text-white">Import {preview.length} Items</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
