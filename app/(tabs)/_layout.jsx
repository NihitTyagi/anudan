import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabaseClient';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkUnread = async () => {
      try {
        // Step 1: get all room IDs where this user is a participant
        const { data: roomData, error: roomError } = await supabase
          .from('chat_rooms')
          .select('id')
          .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

        if (roomError) {
          console.error('Room fetch error:', roomError);
          return;
        }

        const roomIds = (roomData || []).map(r => r.id);

        if (roomIds.length === 0) {
          setHasUnread(false);
          return;
        }

        // Step 2: count unread messages only in those rooms, not sent by current user
        const { count, error: msgError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('room_id', roomIds)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        if (msgError) {
          console.error('Check unread error:', msgError);
          return;
        }

        setHasUnread(count > 0);
      } catch (err) {
        console.error('Unread check catch:', err);
      }
    };

    checkUnread();

    // Subscribe to message changes and re-check
    const channel = supabase
      .channel('global-unread-dot')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        checkUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#687076',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 5) : 5,
          paddingTop: 5,
          height: Platform.OS === 'android' ? 60 + Math.max(insets.bottom - 5, 0) : 60,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="donate"
        options={{
          title: 'Donate',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              {hasUnread && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    top: -2,
                    backgroundColor: '#11181C',
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: '#fff',
                  }}
                />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}