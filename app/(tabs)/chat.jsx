import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';
import UserAvatar from '../../components/UserAvatar';
import { supabase } from '../../lib/supabaseClient';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState({});

  const loadRooms = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Fetch rooms where user is participant
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (roomError) {
        console.error('Room fetch error:', roomError);
        throw roomError;
      }

      // 1. Fetch all unique participant profiles first
      const otherParticipantIds = Array.from(new Set((roomData || []).map(r => 
        r.participant1_id === user.id ? r.participant2_id : r.participant1_id
      )));

      let profileMap = {};
      if (otherParticipantIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', otherParticipantIds);
        
        if (profileError) {
          console.error('Profile fetch error:', profileError);
        }

        (profileData || []).forEach(p => {
          profileMap[p.user_id] = p;
        });
        setProfiles(profileMap);
      }

      // 2. Now get last messages and construct room objects
      const roomsWithLastMsg = await Promise.all((roomData || []).map(async (room) => {
        // Last message
        const { data: lastMsg } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Unread count
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        const otherId = room.participant1_id === user.id ? room.participant2_id : room.participant1_id;
        let profile = profileMap[otherId];

        // FALLBACK: If profile missing, try to find their name from their posts
        if (!profile || !profile.display_name) {
          const { data: donationItem } = await supabase
            .from('donation_items')
            .select('poster_name')
            .eq('user_id', otherId)
            .not('poster_name', 'is', null)
            .limit(1)
            .maybeSingle();
          
          let name = donationItem?.poster_name;
          
          if (!name) {
            const { data: requestItem } = await supabase
              .from('request_items')
              .select('poster_name')
              .eq('user_id', otherId)
              .not('poster_name', 'is', null)
              .limit(1)
              .maybeSingle();
            name = requestItem?.poster_name;
          }

          if (name) {
            profile = { ...profile, user_id: otherId, display_name: name };
            // Update profile map so we don't query again for same user
            profileMap[otherId] = profile;
          }
        }

        return {
          ...room,
          otherUser: profile || { user_id: otherId },
          lastMessage: lastMsg?.text || 'No messages yet',
          timestamp: lastMsg ? new Date(lastMsg.created_at).toLocaleDateString() : '',
          unreadCount: unreadCount || 0,
        };
      }));

      setRooms(roomsWithLastMsg);
    } catch (error) {
      console.error('Error loading rooms:', error);
      Alert.alert('Error', 'Server is not responding. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  const navigateToChat = (room) => {
    const otherId = room.participant1_id === user.id ? room.participant2_id : room.participant1_id;
    const profile = (profiles && profiles[otherId]) || room.otherUser || {};
    
    const q = [
      `userName=${encodeURIComponent(profile.display_name || 'User')}`,
      `avatarPath=${encodeURIComponent(profile.avatar_url || '')}`,
      `posterUserId=${encodeURIComponent(otherId)}`,
    ].join('&');

    router.push(`/chat/${room.id}?${q}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 10 }]}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {loading && rooms.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <LoadingSpinner message="Loading chats..." />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {rooms.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#999', fontSize: 16 }}>No chats yet</Text>
            </View>
          ) : (
            rooms.map((room) => {
              const otherUser = room.otherUser || {};
              const name = otherUser.display_name || 'User';

              return (
                <TouchableOpacity
                  key={room.id}
                  style={styles.chatCard}
                  onPress={() => navigateToChat(room)}
                  activeOpacity={0.7}
                >
                  <UserAvatar
                    userId={otherUser.user_id}
                    name={name}
                    storagePath={otherUser.avatar_url}
                    size={50}
                  />

                  <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                      <Text style={styles.userName}>{name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.timestamp}>{room.timestamp}</Text>
                        {room.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{room.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {room.lastMessage}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  chatCard: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 15,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#11181C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  lastMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  itemTitle: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});
