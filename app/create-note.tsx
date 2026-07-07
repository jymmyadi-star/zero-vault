import { View, Text, Pressable, StyleSheet, TextInput, Animated, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions } from 'react-native';
import { createVaultItem, updateVaultItem, getVaultItemById } from '../lib/services/vault-service';
import { NoteBackground } from '../components/NoteBackground';

import { hapticSuccess } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function CreateNoteScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folder, setFolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const loadNote = async () => {
      try {
        const params = (globalThis as any).__zerovault_lastParams || {};
        const id = params.editId as string;
        if (!id) return;
        const item = await getVaultItemById(id);
        if (item && item.itemType === 'note') {
          setEditId(id);
          setTitle(item.title);
          setContent((item.payload as any).content || '');
          setFolder(item.folder || '');
        }
      } catch {}
    };
    loadNote();
  }, []);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      router.back();
      return;
    }

    const noteTitle = title.trim() || 'Untitled Note';

    setIsLoading(true);
    try {
      const payload = { content: content.trim() };

      if (editId) {
        await updateVaultItem(editId, {
          title: noteTitle,
          plainPayload: payload,
          folder: folder.trim() || null,
        });
      } else {
        await createVaultItem('note', noteTitle, payload, {
          folder: folder.trim() || undefined,
          icon: 'document-text',
        });
      }
      await hapticSuccess();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to encrypt note.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >

      <NoteBackground />

      {/* Note Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={handleSave} style={styles.backButton} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          <Text style={styles.backText}>Notes</Text>
        </Pressable>
        
        <Pressable 
          onPress={handleSave} 
          disabled={isLoading} 
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.7 }
          ]}
        >
          <Text style={styles.saveBtnText}>
            {isLoading ? 'ENCRYPTING...' : 'DONE'}
          </Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.editorBody, { opacity: fadeAnim }]}>
        {/* Meta Row */}
        <View style={styles.metaRow}>
          <View style={styles.folderRow}>
            <Ionicons name="folder-outline" size={14} color="#8E8E93" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.folderInput}
              placeholder="ADD CATEGORY..."
              placeholderTextColor="rgba(255,255,255,0.15)"
              value={folder}
              onChangeText={setFolder}
              autoCapitalize="characters"
              selectionColor="#FFFFFF"
              cursorColor="#FFFFFF"
            />
          </View>
          {content.length > 0 && (
            <Text style={styles.statsText}>
              [ {content.trim().split(/\s+/).filter(Boolean).length} WORDS // {content.length} CHARS ]
            </Text>
          )}
        </View>

        {/* Note Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          selectionColor="#FFFFFF"
          cursorColor="#FFFFFF"
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Samsung-style Massive Note Canvas */}
        <View style={styles.canvasContainer}>
          <TextInput
            style={styles.contentInput}
            placeholder="Start writing here..."
            placeholderTextColor="rgba(255,255,255,0.18)"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            selectionColor="#FFFFFF"
            cursorColor="#FFFFFF"
            keyboardAppearance="dark"
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pitch black
  },
  ambientGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    top: '20%', // Move the epicenter lower, between the buttons and the content
  },
  glowOrb: {
    position: 'absolute',
    width: height * 0.6,
    height: height * 0.9, // Taller than it is wide (elongated vertical ellipse)
    borderRadius: height * 0.45,
    backgroundColor: '#7E22CE', // Slightly deeper violet/purple to match the new image
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  editorBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  folderInput: {
    color: '#8E8E93',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1.5,
    padding: 0,
    margin: 0,
    minWidth: 90,
  },
  statsText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 1,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
    margin: 0,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
  },
  canvasContainer: {
    flex: 1,
  },
  contentInput: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    lineHeight: 26,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
  },
});
