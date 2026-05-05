import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import UserAvatar from '../components/UserAvatar';
import { supabase } from '../lib/supabaseClient';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [avatarPath, setAvatarPath] = useState(null);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);

  const handleLogout = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  const email = user?.email || 'Not available';

  const reloadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const meta = user.user_metadata || {};
    const fullFromProfile = data?.display_name || '';
    const fullFromMeta =
      meta.full_name ||
      [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
      '';
    const fallback = fullFromProfile || fullFromMeta || email;
    setDisplayName(fallback);
    setNameInput(fallback === email ? '' : fallback);
    setAvatarPath(data?.avatar_url || null);
    setLocalAvatarUri(null);
    setLoaded(true);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      await reloadProfile();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const uploadAvatarToStorage = async (uri, path, mimeType = 'image/jpeg') => {
    const expoFile = new ExpoFile(uri);
    const arrayBuffer = await expoFile.arrayBuffer();
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { upsert: true, contentType: mimeType });
    if (error) throw error;
    const returnedPath = data.path || data.Key || path;
    const prefix = 'avatars/';
    return returnedPath.startsWith(prefix) ? returnedPath.slice(prefix.length) : returnedPath;
  };

  const pickAndUploadAvatar = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLocalAvatarUri(asset.uri);
    setSaving(true);
    try {
      const storageKey = `${user.id}/avatar.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      const path = await uploadAvatarToStorage(asset.uri, storageKey, mimeType);
      await supabase.from('profiles').upsert({
        user_id: user.id,
        avatar_url: path,
      });
      setAvatarPath(path);
      setLocalAvatarUri(null);
      Alert.alert('Success', 'Profile photo updated.');
    } catch (e) {
      setLocalAvatarUri(null);
      Alert.alert('Upload failed', e?.message || 'Could not upload photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleMyPosts = () => {
    if (!user || saving) return;
    setSaving(true);
    router.push('/my-posts');
    setSaving(false);
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const parts = trimmed.split(' ').filter(Boolean);
      const first_name = parts[0] || null;
      const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
      await supabase.from('profiles').upsert({
        user_id: user.id,
        display_name: trimmed,
      });
      await supabase.auth.updateUser({
        data: {
          full_name: trimmed,
          first_name,
          last_name,
        },
      });
      setDisplayName(trimmed);
      setEditingName(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#11181C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Profile photo</Text>
          {!loaded ? (
            <LoadingSpinner message="Loading profile..." />
          ) : (
            <View style={styles.avatarRow}>
              {localAvatarUri ? (
                <Image source={{ uri: localAvatarUri }} style={styles.avatarLarge} />
              ) : (
                <UserAvatar
                  userId={user?.id}
                  name={displayName || email}
                  storagePath={avatarPath}
                  size={96}
                />
              )}
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={pickAndUploadAvatar}
                disabled={saving}
              >
                {saving && localAvatarUri ? (
                  <ActivityIndicator color="#2196F3" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={20} color="#2196F3" />
                    <Text style={styles.changePhotoText}>Change photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Your Account</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={18} color="#666" />
            <Text style={styles.infoText}>{email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#666" />
            <Text style={styles.infoText}>Joined on {joined}</Text>
          </View>
          <View style={{ height: 8 }} />
          <View style={styles.nameHeader}>
            <Text style={styles.sectionTitle}>Name</Text>
            {loaded && (
              <TouchableOpacity
                onPress={() => setEditingName(true)}
                style={styles.editIconButton}
                disabled={saving}
              >
                <Ionicons name="create-outline" size={18} color="#2196F3" />
              </TouchableOpacity>
            )}
          </View>
          {!loaded ? (
            <ActivityIndicator />
          ) : editingName ? (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#999"
                value={nameInput}
                onChangeText={setNameInput}
              />
              <View style={styles.nameActions}>
                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: '#e0e0e0' }]}
                  onPress={() => {
                    setEditingName(false);
                    setNameInput(displayName === email ? '' : displayName);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.smallButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: '#2196F3' }]}
                  onPress={handleSaveName}
                  disabled={saving || !nameInput.trim()}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.smallButtonText, { color: '#fff' }]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.infoText}>{displayName || 'Not set'}</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>My Posts</Text>
          <Text style={styles.infoText}>
            View and manage all donation and request posts you have created.
          </Text>
          <TouchableOpacity style={styles.saveButton} onPress={handleMyPosts} disabled={saving || !loaded}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>View My Posts</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: { padding: 5, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#11181C', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#11181C', marginBottom: 10 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e0e0e0' },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  changePhotoText: { color: '#2196F3', fontWeight: '600', fontSize: 15 },
  nameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  editIconButton: { padding: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  infoText: { fontSize: 14, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  nameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  smallButton: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  smallButtonText: { color: '#11181C', fontWeight: '600', fontSize: 13 },
  saveButton: { backgroundColor: '#2196F3', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
