import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VaultItemMetadata } from '../lib/services/vault-service';

const TYPE_ICONS: Record<string, string> = {
  password: 'key',
  seed_phrase: 'leaf',
  note: 'document-text',
};

const TYPE_COLORS: Record<string, string> = {
  password: '#E4E4E7',
  seed_phrase: '#E4E4E7',
  note: '#E4E4E7',
};

export function VaultCard({
  item,
  onPress,
  onLongPress,
}: {
  item: VaultItemMetadata;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const icon = TYPE_ICONS[item.itemType] || 'lock-closed';
  const color = TYPE_COLORS[item.itemType] || '#8E8E93';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      delayLongPress={500}
    >
      <View style={styles.container}>
        <View style={[styles.iconBox, { backgroundColor: `${color}10`, borderColor: `${color}25` }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.urlHint ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.urlHint}
            </Text>
          ) : item.folder ? (
            <View style={styles.folderRow}>
              <Ionicons name="folder-outline" size={11} color="#52525b" />
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.folder.toUpperCase()}
              </Text>
            </View>
          ) : (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.itemType.toUpperCase().replace('_', ' ')}
            </Text>
          )}
        </View>

        {item.favorite && (
          <Ionicons name="star" size={14} color="#FFD60A" style={styles.star} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D12',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  star: {
    marginLeft: 8,
  },
});
