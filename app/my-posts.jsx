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
    const isDonation = type === 'donation';
    return (
      <View key={`${type}-${item.id}`} style={styles.postCard}>
        {/* Card top accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: isDonation ? '#000' : '#444' }]} />

        <View style={styles.cardContent}>
          <View style={styles.postHeaderRow}>
            <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.typeBadge, { backgroundColor: isDonation ? '#000' : '#f0f0f0' }]}>
              <Text style={[styles.typeBadgeText, { color: isDonation ? '#fff' : '#000' }]}>
                {isDonation ? 'Donate' : 'Request'}
              </Text>
            </View>
          </View>

          {!!item.description && (
            <Text style={styles.postDescription} numberOfLines={2}>{item.description}</Text>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                const pathname = type === 'donation' ? '/donate/add' : '/request/add';
                router.push({
                  pathname,
                  params: { id: String(item.id) },
                });
              }}
            >
              <Ionicons name="create-outline" size={14} color="#000" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removePost(type, item.id)}
            >
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSection = (title, items, type, icon) => (
    <View style={styles.sectionBlock}>
      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{items.length}</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="file-tray-outline" size={28} color="#ccc" />
          <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
        </View>
      ) : (
        items.map((item) => renderPost(item, type))
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Posts</Text>
        <View style={{ width: 38 }} />
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
          showsVerticalScrollIndicator={false}
        >
          {/* Summary strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{donations.length}</Text>
              <Text style={styles.summaryLabel}>Donations</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{requests.length}</Text>
              <Text style={styles.summaryLabel}>Requests</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{donations.length + requests.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>

          {renderSection('Donations', donations, 'donation', 'gift-outline')}
          {renderSection('Requests', requests, 'request', 'hand-left-outline')}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },

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

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  /* Summary strip */
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#000',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    paddingVertical: 20,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2, fontWeight: '500', letterSpacing: 0.5 },
  summaryDivider: { width: 1, backgroundColor: '#333', marginVertical: 4 },

  /* Section */
  sectionBlock: { marginHorizontal: 16, marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', flex: 1 },
  countBadge: {
    backgroundColor: '#e8e8e8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#555' },

  /* Empty */
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: '#bbb', fontWeight: '500' },

  /* Post card */
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ebebeb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardAccent: { height: 3, width: '100%' },
  cardContent: { padding: 14 },

  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#000', flex: 1 },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  postDescription: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },

  postActions: { flexDirection: 'row', gap: 8 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  editButtonText: { color: '#000', fontSize: 13, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  deleteButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});