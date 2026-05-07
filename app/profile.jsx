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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Hero Section */}
        <View style={styles.heroSection}>
          {!loaded ? (
            <LoadingSpinner message="Loading profile..." />
          ) : (
            <>
              <View style={styles.avatarWrapper}>
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
                  style={styles.cameraOverlay}
                  onPress={pickAndUploadAvatar}
                  disabled={saving}
                >
                  {saving && localAvatarUri ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.heroName}>{displayName || 'Set your name'}</Text>
              <Text style={styles.heroEmail}>{email}</Text>
            </>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>

          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="mail-outline" size={16} color="#000" />
              </View>
              <View>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{email}</Text>
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="calendar-outline" size={16} color="#000" />
              </View>
              <View>
                <Text style={styles.rowLabel}>Member Since</Text>
                <Text style={styles.rowValue}>{joined}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>NAME</Text>
            {loaded && !editingName && (
              <TouchableOpacity
                onPress={() => setEditingName(true)}
                disabled={saving}
                style={styles.editTextBtn}
              >
                <Text style={styles.editTextLabel}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {!loaded ? (
            <ActivityIndicator color="#000" style={{ marginVertical: 12 }} />
          ) : editingName ? (
            <View style={styles.editNameBlock}>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#999"
                value={nameInput}
                onChangeText={setNameInput}
              />
              <View style={styles.nameActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setEditingName(false);
                    setNameInput(displayName === email ? '' : displayName);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveNameBtn, (!nameInput.trim() || saving) && { opacity: 0.4 }]}
                  onPress={handleSaveName}
                  disabled={saving || !nameInput.trim()}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveNameBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="person-outline" size={16} color="#000" />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Full Name</Text>
                  <Text style={styles.rowValue}>{displayName || 'Not set'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* My Posts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVITY</Text>
          <TouchableOpacity
            style={styles.myPostsRow}
            onPress={handleMyPosts}
            disabled={saving || !loaded}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="list-outline" size={16} color="#000" />
              </View>
              <View>
                <Text style={styles.rowValue}>My Posts</Text>
                <Text style={styles.rowLabel}>View your donations & requests</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  /* Hero */
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e8e8e8' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroName: { fontSize: 22, fontWeight: '700', color: '#000', letterSpacing: -0.3, marginBottom: 4 },
  heroEmail: { fontSize: 13, color: '#888', letterSpacing: 0.1 },

  divider: { height: 8, backgroundColor: '#f5f5f5' },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  editTextBtn: { marginBottom: 16 },
  editTextLabel: { fontSize: 13, fontWeight: '600', color: '#000' },

  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 12, color: '#999', marginBottom: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#000' },

  separator: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14, marginLeft: 50 },

  myPostsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  /* Edit name */
  editNameBlock: { gap: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  nameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  saveNameBtn: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveNameBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  /* Logout */
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 12,
  },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});