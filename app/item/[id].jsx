import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../../components/UserAvatar';
import { isValidCoordinate } from '../../lib/geo';

export default function ItemDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  // Get item data from params
  const itemId = params.id;
  const itemTitle = params.title || 'Item';
  const itemDescription = params.description || 'No description available';
  const userName = params.userName || 'User';
  const posterUserId = params.posterUserId || '';
  const avatarPath = params.avatarPath || '';
  const imageUrl = params.imageUrl || '';
  const latitude = params.latitude ? Number(params.latitude) : null;
  const longitude = params.longitude ? Number(params.longitude) : null;
  const locationLabel = params.locationLabel || '';
  const date = params.date || 'Recently';
  const itemType = params.type || 'request'; // 'request' or 'donation'
  const isRequest = itemType === 'request';
  const hasLocation = isValidCoordinate(latitude, longitude);

  const handleChat = () => {
    const chatId = `chat_${itemId}_${Date.now()}`;
    const q = [
      `userName=${encodeURIComponent(userName)}`,
      `itemTitle=${encodeURIComponent(itemTitle)}`,
      `itemId=${encodeURIComponent(itemId)}`,
      `itemType=${encodeURIComponent(itemType)}`,
      `avatarPath=${encodeURIComponent(avatarPath)}`,
      `posterUserId=${encodeURIComponent(posterUserId)}`,
    ].join('&');
    router.push(`/chat/${chatId}?${q}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#11181C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Section */}
        <View style={styles.userSection}>
          <UserAvatar
            userId={posterUserId || userName}
            name={userName}
            storagePath={avatarPath || null}
            size={60}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.itemBadge}>
              <Ionicons
                name={isRequest ? 'radio' : 'star'}
                size={12}
                color={isRequest ? '#F44336' : '#4CAF50'}
              />
              <Text style={styles.itemBadgeText}>
                {isRequest ? 'Request' : 'Donation'}
              </Text>
            </View>
          </View>
        </View>

        {/* Item Image Placeholder - Only show for donations */}
        {!isRequest && (
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.itemImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={64} color="#999" />
              </View>
            )}
          </View>
        )}

        {/* Item Details Section */}
        <View style={styles.detailsSection}>
          <Text style={styles.itemTitle}>{itemTitle}</Text>
          <Text style={styles.itemDescription}>{itemDescription}</Text>

          {/* Additional Info */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.infoText}>Posted on {date}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.infoText}>
                {locationLabel
                  ? locationLabel
                  : hasLocation && latitude !== null && longitude !== null
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : 'Location not provided'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Chat Button - Fixed at Bottom */}
      <View style={[styles.actionContainer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles" size={22} color="#fff" />
          <Text style={styles.chatButtonText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  headerSpacer: {
    width: 34, // Same width as back button to center title
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Space for fixed chat button
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 6,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  itemBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  imageContainer: {
    marginBottom: 25,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  detailsSection: {
    marginBottom: 20,
  },
  itemTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 12,
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 25,
  },
  infoContainer: {
    gap: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  chatButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
