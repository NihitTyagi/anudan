import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase } from '../lib/supabaseClient';

export default function MyPostsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to view your posts.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Login', onPress: () => router.replace('/auth/login') },
        ]);
        return;
      }
      const [{ data: donationRows }, { data: requestRows }] = await Promise.all([
        supabase.from('donation_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('request_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setDonations(donationRows || []);
      setRequests(requestRows || []);
    } catch (_e) {
      Alert.alert('Error', 'Failed to load your posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const removePost = async (type, id) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const table = type === 'donation' ? 'donation_items' : 'request_items';
              const user = (await supabase.auth.getUser()).data.user;
              if (!user) return;
              const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
              if (error) throw error;
              load();
            } catch (_e) {
              Alert.alert('Error', 'Failed to delete post.');
            }
          },
        },
      ]
    );
  };

  const renderPost = (item, type) => {
    return (
      <View key={`${type}-${item.id}`} style={styles.postCard}>
        <View style={styles.postHeader}>
          <Text style={styles.postTitle}>{item.title}</Text>
        </View>
        <Text style={styles.postDescription}>{item.description}</Text>
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => {
              const pathname = type === 'donation' ? '/donate/add' : '/request/add';
              router.push({
                pathname,
                params: { id: String(item.id) },
              });
            }}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#F44336' }]}
            onPress={() => removePost(type, item.id)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#11181C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Posts</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading your posts..." />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        >
          <Text style={styles.sectionTitle}>Donations</Text>
          {donations.length === 0 ? (
            <Text style={styles.emptyText}>You have not created any donations yet.</Text>
          ) : (
            donations.map((d) => renderPost(d, 'donation'))
          )}

          <Text style={styles.sectionTitle}>Requests</Text>
          {requests.length === 0 ? (
            <Text style={styles.emptyText}>You have not created any requests yet.</Text>
          ) : (
            requests.map((r) => renderPost(r, 'request'))
          )}
        </ScrollView>
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#11181C', marginBottom: 10, marginTop: 10 },
  emptyText: { fontSize: 14, color: '#666', marginBottom: 10 },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  postTitle: { fontSize: 16, fontWeight: '600', color: '#11181C', flex: 1, marginRight: 8 },
  postDescription: { fontSize: 14, color: '#666', marginBottom: 10 },
  postActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

