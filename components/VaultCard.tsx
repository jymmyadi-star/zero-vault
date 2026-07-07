import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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

const ArtisticBukovinaBand = ({ color, style }: { color: string, style?: any }) => {
  const cols = 40;
  const rows = 8;
  const s = 3.5;

  const paths = useMemo(() => {
    let main = "";
    let accent = "";
    const stitch = (x: number, y: number) => `M${x},${y} l2,2 M${x + 2},${y} l-2,2 `;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * s;
        const py = y * s;

        const wave = Math.sin(x / 4) * 3 + 4;
        const distToWave = Math.abs(y - wave);
        const isRhombus = (Math.abs((x % 10) - 5) + Math.abs((y % 10) - 5)) <= 3;

        if (isRhombus) {
          main += stitch(px, py);
        } else if (distToWave < 1.2) {
          accent += stitch(px, py);
        }
      }
    }
    return { main, accent };
  }, []);

  return (
    <View style={[{ position: 'absolute', height: 24, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="24" viewBox={`0 0 ${cols * s} ${rows * s}`} preserveAspectRatio="xMaxYMid slice">
        <Defs>
          <SvgLinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={color} stopOpacity="0" />
            <Stop offset="40%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Path d={paths.main} stroke="url(#fade)" strokeWidth="1.4" strokeLinecap="round" opacity={0.25} />
        <Path d={paths.accent} stroke="url(#fade)" strokeWidth="1.2" opacity={0.15} />
      </Svg>
    </View>
  );
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
  // Use a deep, dark red for normal items, gold for favorites
  const accentColor = item.favorite ? '#FFD60A' : '#8C1212';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      delayLongPress={500}
    >
      <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
        <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />

        {/* Folklore Design - Bottom Right Half (Faded) */}
        <ArtisticBukovinaBand 
          color={accentColor} 
          style={{ bottom: -2, right: 0, width: '60%' }} 
        />
        
        <View style={styles.container}>
          {/* Gradient Border Wrapper */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 0, 51, 0.45)']}
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 15,
              padding: 1, // Creates the border thickness
              marginRight: 16,
            }}
          >
            <View style={[
              styles.iconBox, 
              { 
                width: '100%',
                height: '100%',
                marginRight: 0,
                borderWidth: 0,
                borderRadius: 14,
                backgroundColor: `${color}08`, 
                overflow: 'hidden' 
              }
            ]}>
              <LinearGradient 
                colors={['transparent', 'rgba(255, 0, 51, 0.25)']} 
                start={{ x: 0.2, y: 0.2 }} 
                end={{ x: 1, y: 1 }} 
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} 
              />
              <Ionicons name={icon as any} size={18} color={color} />
            </View>
          </LinearGradient>

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
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 0, 2, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 16,
    paddingLeft: 18,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
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
