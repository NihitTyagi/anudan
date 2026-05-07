import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';
import UserAvatar from '../../components/UserAvatar';
import { supabase } from '../../lib/supabaseClient';

function paramStr(v) {
  if (v == null) return '';
  return Array.isArray(v) ? v[0] ?? '' : String(v);
}

export default function ChatInboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const chatId = params.id;
  const scrollViewRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const roomRef = useRef(null); // keep a ref so markAllRead can always access current room

  // Params from navigation
  const initialUserName = paramStr(params.userName);
  const itemTitle = paramStr(params.itemTitle);
  const itemId = paramStr(params.itemId);
  const itemType = paramStr(params.itemType) || (paramStr(params.isDonation) === 'true' ? 'donation' : 'request');
  const avatarPath = paramStr(params.avatarPath);
  const posterUserId = paramStr(params.posterUserId);

  const isNewChat = chatId && chatId.startsWith('chat_');

  // ─── Mark ALL unread messages in this room as read ───────────────────────
  const markAllRead = useCallback(async (roomId) => {
    if (!roomId || !user?.id) return;
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch (e) {
      console.error('markAllRead error:', e);
    }
  }, [user?.id]);

  // ─── Load or Create Room ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function initChat() {
      try {
        setLoading(true);
        let currentRoom = null;
        let otherId = posterUserId;

        if (isNewChat) {
          if (!otherId) throw new Error('Recipient ID missing');
          const [p1, p2] = [user.id, otherId].sort();

          const { data: existingRooms } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('participant1_id', p1)
            .eq('participant2_id', p2);

          currentRoom = existingRooms?.[0];

          if (!currentRoom) {
            const { data: newRoom, error: createError } = await supabase
              .from('chat_rooms')
              .insert({ participant1_id: p1, participant2_id: p2 })
              .select()
              .single();

            if (createError) throw createError;
            currentRoom = newRoom;

            if (itemTitle) {
              const welcomeText = `Hi! I'm interested in your ${itemType} for ${itemTitle}.`;
              await supabase.from('chat_messages').insert({
                room_id: currentRoom.id,
                sender_id: user.id,
                text: welcomeText,
              });
            }
          } else {
            if (itemTitle) {
              const welcomeText = `Hi! I'm interested in your ${itemType} for ${itemTitle}.`;
              await supabase.from('chat_messages').insert({
                room_id: currentRoom.id,
                sender_id: user.id,
                text: welcomeText,
              });
            }
          }
        } else {
          const { data: existingRoom } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('id', chatId)
            .single();
          currentRoom = existingRoom;
          if (currentRoom) {
            otherId = currentRoom.participant1_id === user.id
              ? currentRoom.participant2_id
              : currentRoom.participant1_id;
          }
        }

        roomRef.current = currentRoom;
        setRoom(currentRoom);

        if (currentRoom && otherId) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherId)
            .maybeSingle();
          
          setOtherUser({
            id: otherId,
            displayName: profileData?.display_name || initialUserName || 'User',
            avatarUrl: profileData?.avatar_url || avatarPath || null,
          });

          // Fetch messages AND mark as read together
          await fetchMessages(currentRoom.id);
        }
      } catch (error) {
        console.error('Chat init error:', error);
      } finally {
        setLoading(false);
      }
    }

    initChat();
  }, [chatId, user, posterUserId]);

  // ─── Re-mark as read every time screen comes into focus ─────────────────
  // This is the KEY fix: if the user left and came back, dot clears immediately
  useFocusEffect(
    useCallback(() => {
      const currentRoom = roomRef.current;
      if (currentRoom?.id) {
        markAllRead(currentRoom.id);
      }
    }, [markAllRead])
  );

  // ─── Realtime subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!room?.id || !user?.id) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${room.id}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          const isMyMessage = newMessage.sender_id === user.id;

          setMessages(prev => {
            if (isMyMessage) {
              const optimisticIdx = prev.findIndex(
                m => m.isOptimistic && m.text === newMessage.text
              );
              if (optimisticIdx !== -1) {
                const next = [...prev];
                next[optimisticIdx] = {
                  id: newMessage.id,
                  text: newMessage.text,
                  isSent: true,
                  isRead: newMessage.is_read,
                  timestamp: new Date(newMessage.created_at).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit',
                  }),
                };
                return next;
              }
            }

            if (prev.find(m => m.id === newMessage.id)) return prev;

            return [...prev, {
              id: newMessage.id,
              text: newMessage.text,
              isSent: isMyMessage,
              isRead: newMessage.is_read,
              timestamp: new Date(newMessage.created_at).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit',
              }),
            }];
          });

          // If it's an incoming message, mark it read immediately
          if (!isMyMessage) {
            await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new;
          setMessages(prev =>
            prev.map(m =>
              m.id === updatedMessage.id ? { ...m, isRead: updatedMessage.is_read } : m
            )
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, user?.id]);

  // ─── Fetch messages + mark as read ──────────────────────────────────────
  async function fetchMessages(roomId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        text: m.text,
        isSent: m.sender_id === user.id,
        isRead: m.is_read,
        timestamp: new Date(m.created_at).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        }),
      })));

      // Mark all unread messages from the other person as read
      await markAllRead(roomId);
    }
  }

  // ─── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // ─── Send message ────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (messageText.trim() && room && user) {
      const text = messageText.trim();
      setMessageText('');

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg = {
        id: tempId,
        text,
        isSent: true,
        isRead: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOptimistic: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);

      const { error } = await supabase.from('chat_messages').insert({
        room_id: room.id,
        sender_id: user.id,
        text,
      });

      if (error) {
        console.error('Send message error:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  };

  // ─── Delete chat ─────────────────────────────────────────────────────────
  const handleDeleteChat = () => {
    if (!room) return;

    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('chat_rooms')
                .delete()
                .eq('id', room.id);
              if (error) throw error;
              router.replace('/(tabs)/chat');
            } catch (error) {
              console.error('Delete chat error:', error);
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          },
        },
      ]
    );
  };

  const displayName = otherUser?.displayName || initialUserName || 'User';
  const displayAvatar = otherUser?.avatarUrl || avatarPath;
  const displayUserId = otherUser?.id || posterUserId;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatarWrap}>
              <UserAvatar
                userId={displayUserId}
                name={displayName}
                storagePath={displayAvatar}
                size={40}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{displayName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleDeleteChat} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={20} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading && messages.length === 0 ? (
            <View style={styles.loadingWrapper}>
              <LoadingSpinner message="Loading messages..." />
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.isSent ? styles.sentMessage : styles.receivedMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.isSent ? styles.sentText : styles.receivedText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.isSent ? styles.sentTime : styles.receivedTime,
                  ]}
                >
                  {message.timestamp}
                  {message.isSent && (
                    <Ionicons
                      name={message.isRead ? "checkmark-done" : "checkmark"}
                      size={14}
                      color={message.isRead ? "#4CAF50" : "rgba(255,255,255,0.6)"}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={[
          styles.inputContainer,
          { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 20 },
        ]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={[styles.sendButton, messageText.trim() ? styles.sendButtonActive : null]}
            disabled={!messageText.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() ? '#fff' : '#999'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: { marginRight: 10, padding: 5 },
  menuButton: { padding: 5, marginLeft: 5 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatarWrap: { marginRight: 12 },
  headerText: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '600', color: '#11181C', marginBottom: 2 },
  messagesContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  messagesContent: { padding: 15, paddingBottom: 10, flexGrow: 1 },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageBubble: {
    maxWidth: '75%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#11181C',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: { fontSize: 15, lineHeight: 20, marginBottom: 4 },
  sentText: { color: '#fff' },
  receivedText: { color: '#11181C' },
  messageTime: { fontSize: 11, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' },
  sentTime: { color: 'rgba(255,255,255,0.7)' },
  receivedTime: { color: '#999' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    color: '#11181C',
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: { backgroundColor: '#11181C' },
});