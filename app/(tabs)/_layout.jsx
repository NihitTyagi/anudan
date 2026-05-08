import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabaseClient';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const latestRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const debounceRef = useRef(null);
  const isCheckingRef = useRef(false);
  const rerunRequestedRef = useRef(false);

  const checkUnread = useCallback(async () => {
    if (!user?.id || !mountedRef.current) return;

    if (isCheckingRef.current) {
      rerunRequestedRef.current = true;
      return;
    }

    const requestId = ++latestRequestRef.current;
    isCheckingRef.current = true;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

      if (!mountedRef.current || requestId !== latestRequestRef.current) return;

      if (roomError) {
        console.error('Room fetch error:', roomError);
        return;
      }

      const roomIds = (roomData || []).map((r) => r.id);
      if (roomIds.length === 0) {
        setHasUnread(false);
        return;
      }

      const { count, error: msgError } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('room_id', roomIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (!mountedRef.current || requestId !== latestRequestRef.current) return;

      if (msgError) {
        console.error('Check unread error:', msgError);
        return;
      }

      setHasUnread((count || 0) > 0);
    } catch (err) {
      if (mountedRef.current) {
        console.error('Unread check catch:', err);
      }
    } finally {
      isCheckingRef.current = false;
      if (rerunRequestedRef.current && mountedRef.current) {
        rerunRequestedRef.current = false;
        checkUnread();
      }
    }
  }, [user?.id]);

  const scheduleUnreadCheck = useCallback(() => {
    if (!mountedRef.current) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      checkUnread();
    }, 150);
  }, [checkUnread]);

  useEffect(() => {
    if (!user?.id) return;
    mountedRef.current = true;
    checkUnread();

    // Subscribe to message changes and re-check
    const channel = supabase
      .channel('global-unread-dot')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        scheduleUnreadCheck();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        scheduleUnreadCheck();
      })
      .subscribe();

    const readSubscription = DeviceEventEmitter.addListener(
      'chat:unread-changed',
      () => {
        scheduleUnreadCheck();
      }
    );

    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
      isCheckingRef.current = false;
      rerunRequestedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      readSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id, checkUnread, scheduleUnreadCheck]);

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