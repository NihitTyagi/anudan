import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import {
  Animated,
  Dimensions,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Promotional cards data
const promotionalCards = [
  {
    id: 1,
    text: 'Have spare things? Someone nearby might need them.',
    cta: 'Start Giving.',
    backgroundColor: '#FF6B6B', // Red-orange
  },
  {
    id: 2,
    text: 'Need a helping hand? Someone nearby might have exactly what you\'re looking for.',
    cta: '',
    backgroundColor: '#4ECDC4', // Teal
  },
  {
    id: 3,
    text: 'Clear your space, clear your mind. Find a second home for your extras',
    cta: '',
    backgroundColor: '#95E1D3', // Light green
  },
  {
    id: 4,
    text: 'Don\'t buy new just look around. Helpful neighbors are just a click away',
    cta: '',
    backgroundColor: '#F7DC6F', // Yellow
  },
  {
    id: 5,
    text: 'Your smile act of sharing can be a big change for someone else',
    cta: '',
    backgroundColor: '#BB8FCE', // Purple
  },
];

export default function HomeScreen() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const [headerAvatarPath, setHeaderAvatarPath] = useState(null);
  const [headerDisplayName, setHeaderDisplayName] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const autoRotateEnabled = useRef(true);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        // Disable auto-rotate when user starts swiping
        autoRotateEnabled.current = false;
        slideAnim.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Normalize swipe distance to [-1, 1]
        const maxSwipeRatio = 0.3;
        const dxRatio = gestureState.dx / SCREEN_WIDTH;
        const clampedRatio = Math.max(-maxSwipeRatio, Math.min(maxSwipeRatio, dxRatio));
        slideAnim.setValue(clampedRatio);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThresholdRatio = 0.2;
        const dxRatio = gestureState.dx / SCREEN_WIDTH;
        
        if (dxRatio > swipeThresholdRatio) {
          // Swipe right - go to previous card
          goToPreviousCard();
        } else if (dxRatio < -swipeThresholdRatio) {
          // Swipe left - go to next card
          goToNextCard();
        } else {
          // Return to center
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        }
        
        // Re-enable auto-rotate after a delay
        setTimeout(() => {
          autoRotateEnabled.current = true;
        }, 3000);
      },
    })
  ).current;

  const goToNextCard = () => {
    slideAnim.setValue(1);
    setCurrentCardIndex((prevIndex) => (prevIndex + 1) % promotionalCards.length);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const goToPreviousCard = () => {
    slideAnim.setValue(-1);
    setCurrentCardIndex((prevIndex) => (prevIndex - 1 + promotionalCards.length) % promotionalCards.length);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const navigateToDonate = () => {
    router.push('/(tabs)/donate');
  };

  const navigateToRequest = () => {
    router.push('/(tabs)/request');
  };

  // Auto-rotate carousel every 3 seconds with horizontal swipe
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRotateEnabled.current) {
        // Slide out to left
        Animated.timing(slideAnim, {
          toValue: -1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          // Change card
          setCurrentCardIndex((prevIndex) => (prevIndex + 1) % promotionalCards.length);
          // Reset animation and slide in from right
          slideAnim.setValue(1);
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start();
        });
      }
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [slideAnim]);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      setHeaderAvatarPath(data?.avatar_url || null);
      const meta = user.user_metadata || {};
      const name =
        data?.display_name ||
        meta.full_name ||
        [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
        user.email ||
        '';
      setHeaderDisplayName(name);
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Text style={styles.headerTitle}>Anudaan</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
          activeOpacity={0.8}
        >
          <UserAvatar
            userId={user?.id}
            name={headerDisplayName || user?.email}
            storagePath={headerAvatarPath}
            size={40}
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.donateButton]}
            onPress={navigateToDonate}
            activeOpacity={0.9}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="star" size={22} color="#fff" />
            </View>
            <Text style={styles.actionButtonText}>Donate</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.requestButton]}
            onPress={navigateToRequest}
            activeOpacity={0.9}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="radio" size={22} color="#fff" />
            </View>
            <Text style={styles.actionButtonText}>Request</Text>
          </TouchableOpacity>
        </View>

        {/* Promotional Cards Carousel */}
        <View style={styles.carouselContainer} {...panResponder.panHandlers}>
          {promotionalCards.map((card, index) => {
            const isActive = index === currentCardIndex;
            
            // Only show the active card
            if (!isActive) return null;

            const translateX = slideAnim.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH], // Slide from right to left
            });

            return (
              <Animated.View
                key={card.id}
                style={[
                  styles.promotionalCard,
                  {
                    backgroundColor: card.backgroundColor,
                    transform: [{ translateX }],
                  },
                ]}
              >
                <Text style={styles.promotionalText}>{card.text}</Text>
                {card.cta && (
                  <Text style={styles.promotionalCTA}>{card.cta}</Text>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Carousel Indicator */}
        <View style={styles.carouselIndicator}>
          {promotionalCards.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentCardIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* App Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>How Anudaan Works</Text>
          
          <View style={styles.featureCard}>
            <View style={[styles.featureIconContainer, { backgroundColor: '#FFE5E5' }]}>
              <Ionicons name="search" size={28} color="#FF6B6B" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Smart Search</Text>
              <Text style={styles.featureDescription}>
                Find items you need or people who need your items instantly with our smart matching system
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIconContainer, { backgroundColor: '#E0F7F4' }]}>
              <Ionicons name="map" size={28} color="#4ECDC4" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Hyper-Local</Text>
              <Text style={styles.featureDescription}>
                Connect with neighbors within 5-10km radius. No shipping needed, just meet and handover
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIconContainer, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="chatbubbles" size={28} color="#4CAF50" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Direct Communication</Text>
              <Text style={styles.featureDescription}>
                Chat directly with donors or requesters to coordinate safe handovers at public locations
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIconContainer, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="shield-checkmark" size={28} color="#FF9800" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Safe & Secure</Text>
              <Text style={styles.featureDescription}>
                Privacy-first approach with location masking and verified profiles for safe exchanges
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIconContainer, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="heart" size={28} color="#9C27B0" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Community Driven</Text>
              <Text style={styles.featureDescription}>
                Build stronger neighborhoods by sharing resources and helping those in need around you
              </Text>
            </View>
          </View>
        </View>

        {/* Copyright Section */}
        <View style={styles.copyrightSection}>
          <Text style={styles.copyrightText}>
            All rights reserved to Nihit Tyagi
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100, // Space for bottom nav
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  donateButton: {
    backgroundColor: '#2196F3', // Blue
  },
  requestButton: {
    backgroundColor: '#FF9800', // Orange
  },
  buttonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  carouselContainer: {
    height: 140,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  promotionalCard: {
    position: 'absolute',
    width: '100%',
    height: 140,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  promotionalText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#11181C',
    marginBottom: 8,
    lineHeight: 24,
  },
  promotionalCTA: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#11181C',
  },
  carouselIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d0d0d0',
  },
  dotActive: {
    backgroundColor: '#888',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  featuresSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
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
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  copyrightSection: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 10,
  },
  copyrightText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
});
