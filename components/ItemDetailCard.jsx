import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ItemDetailCard({ visible, onClose, item, type }) {
  const router = useRouter();

  if (!item) return null;

  const isRequest = type === 'request'; // true for requests (needers), false for donations (donators)

  const handleChat = () => {
    // Generate a chat ID based on item and user
    const chatId = `chat_${item.id}_${Date.now()}`;
    onClose();
    // Navigate to chat inbox with this person
    router.push(`/chat/${chatId}?userName=${item.userName || 'User'}&itemTitle=${item.title}&isDonation=${!isRequest}`);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.cardContainer}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              style={styles.card}
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header with close button */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileInitial}>
                      {(item.userName || 'User').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.userName}>{item.userName || 'User'}</Text>
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
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Item Image Placeholder */}
              <View style={styles.imageContainer}>
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={48} color="#999" />
                </View>
              </View>

              {/* Item Details */}
              <View style={styles.detailsSection}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>

                {/* Additional Info */}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    Posted on {item.date || 'Recently'}
                  </Text>
                </View>

                {item.location && (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>
                      Near your location (distance will be shown)
                    </Text>
                  </View>
                )}

                {item.category && (
                  <View style={styles.infoRow}>
                    <Ionicons name="pricetag-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>Category: {item.category}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={handleChat}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubbles" size={20} color="#fff" />
                  <Text style={styles.chatButtonText}>Chat</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  card: {
    flex: 1,
  },
  cardContent: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
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
    alignSelf: 'flex-start',
  },
  itemBadgeText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  closeButton: {
    padding: 5,
  },
  imageContainer: {
    marginBottom: 20,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  detailsSection: {
    marginBottom: 25,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 12,
  },
  itemDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    marginTop: 10,
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
    fontSize: 16,
    fontWeight: '600',
  },
});
