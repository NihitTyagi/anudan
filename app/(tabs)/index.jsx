import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { useAuth } from '../../components/AuthProvider';
import UserAvatar from '../../components/UserAvatar';
import { supabase } from '../../lib/supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Promotional cards — dark monochrome theme with decorative accents
const promotionalCards = [
  {
    id: 1,
    text: 'Have spare things? Someone nearby might need them.',
    cta: 'Start Giving.',
    bg: '#0D0D0D',
    textColor: '#F5F5F5',
    ctaColor: '#FFFFFF',
    icon: 'gift-outline',
    pattern: 'dots',
  },
  {
    id: 2,
    text: "Need a helping hand? Someone nearby might have exactly what you're looking for.",
    cta: '',
    bg: '#1A1A1A',
    textColor: '#E8E8E8',
    ctaColor: '#fff',
    icon: 'hand-left-outline',
    pattern: 'lines',
  },
  {
    id: 3,
    text: 'Clear your space, clear your mind. Find a second home for your extras.',
    cta: '',
    bg: '#262626',
    textColor: '#E0E0E0',
    ctaColor: '#fff',
    icon: 'home-outline',
    pattern: 'dots',
  },
  {
    id: 4,
    text: "Don't buy new — just look around. Helpful neighbors are a click away.",
    cta: '',
    bg: '#111111',
    textColor: '#EBEBEB',
    ctaColor: '#fff',
    icon: 'search-outline',
    pattern: 'lines',
  },
  {
    id: 5,
    text: 'Your small act of sharing can be a big change for someone else.',
    cta: '',
    bg: '#1C1C1C',
    textColor: '#E5E5E5',
    ctaColor: '#fff',
    icon: 'heart-outline',
    pattern: 'dots',
  },
];

// Feature data
const features = [
  {
    icon: 'search',
    title: 'Smart Search',
    description: 'Find items you need or people who need yours with our smart matching system.',
  },
  {
    icon: 'navigate',
    title: 'Hyper-Local',
    description: 'Connect with neighbors within 5–10 km. No shipping — just meet and hand over.',
  },
  {
    icon: 'chatbubble-ellipses',
    title: 'Direct Chat',
    description: 'Coordinate safe handovers at public locations directly with donors or requesters.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Safe & Secure',
    description: 'Privacy-first with location masking and verified profiles for secure exchanges.',
  },
  {
    icon: 'people',
    title: 'Community',
    description: 'Build stronger neighbourhoods by sharing resources with people around you.',
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
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderGrant: () => {
        autoRotateEnabled.current = false;
        slideAnim.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const maxSwipeRatio = 0.3;
        const dxRatio = gestureState.dx / SCREEN_WIDTH;
        const clampedRatio = Math.max(-maxSwipeRatio, Math.min(maxSwipeRatio, dxRatio));
        slideAnim.setValue(clampedRatio);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThresholdRatio = 0.2;
        const dxRatio = gestureState.dx / SCREEN_WIDTH;
        if (dxRatio > swipeThresholdRatio) {
          goToPreviousCard();
        } else if (dxRatio < -swipeThresholdRatio) {
          goToNextCard();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        }
        setTimeout(() => { autoRotateEnabled.current = true; }, 3000);
      },
    })
  ).current;

  const goToNextCard = () => {
    slideAnim.setValue(1);
    setCurrentCardIndex((prev) => (prev + 1) % promotionalCards.length);
    Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const goToPreviousCard = () => {
    slideAnim.setValue(-1);
    setCurrentCardIndex((prev) => (prev - 1 + promotionalCards.length) % promotionalCards.length);
    Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const navigateToDonate = () => router.push('/(tabs)/donate');
  const navigateToRequest = () => router.push('/(tabs)/request');

  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRotateEnabled.current) {
        Animated.timing(slideAnim, { toValue: -1, duration: 400, useNativeDriver: true }).start(() => {
          setCurrentCardIndex((prev) => (prev + 1) % promotionalCards.length);
          slideAnim.setValue(1);
          Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        });
      }
    }, 3000);
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
    return () => { mounted = false; };
  }, [user?.id]);

  const currentCard = promotionalCards[currentCardIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

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
            size={42}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.donateButton]}
            onPress={navigateToDonate}
            activeOpacity={0.85}
          >
            <View style={styles.buttonIconWrap}>
              <Ionicons name="arrow-up-circle" size={20} color="#111" />
            </View>
            <Text style={styles.donateButtonText}>Donate</Text>
            <Ionicons name="chevron-forward" size={16} color="#111" style={{ opacity: 0.4 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.requestButton]}
            onPress={navigateToRequest}
            activeOpacity={0.85}
          >
            <View style={styles.buttonIconWrapDark}>
              <Ionicons name="arrow-down-circle" size={20} color="#fff" />
            </View>
            <Text style={styles.requestButtonText}>Request</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" style={{ opacity: 0.4 }} />
          </TouchableOpacity>
        </View>

        {/* Section Label */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Community Stories</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Promotional Cards Carousel */}
        <View style={styles.carouselContainer} {...panResponder.panHandlers}>
          {promotionalCards.map((card, index) => {
            if (index !== currentCardIndex) return null;
            const translateX = slideAnim.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
            });
            return (
              <Animated.View
                key={card.id}
                style={[
                  styles.promotionalCard,
                  { backgroundColor: card.bg, transform: [{ translateX }] },
                ]}
              >
                {/* Decorative large circle in background */}
                <View style={styles.cardDecorCircle} />
                {/* Decorative small circle */}
                <View style={styles.cardDecorCircleSmall} />

                {/* Left: text content */}
                <View style={styles.cardContentLeft}>
                  <Text style={[styles.promotionalText, { color: card.textColor }]}>
                    {card.text}
                  </Text>
                  {card.cta ? (
                    <Text style={[styles.promotionalCTA, { color: card.ctaColor }]}>
                      {card.cta}
                    </Text>
                  ) : null}
                </View>

                {/* Right: icon */}
                <View style={styles.cardIconWrap}>
                  <Ionicons name={card.icon} size={32} color="rgba(255,255,255,0.18)" />
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Carousel Dots */}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>How It Works</Text>

          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              {/* Icon circle */}
              <View style={styles.featureIconCircle}>
                <Ionicons name={f.icon} size={20} color="#111" />
              </View>

              {/* Right: text */}
              <View style={styles.featureTextBlock}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDescription}>{f.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>© Nihit Tyagi · All rights reserved</Text>
          <View style={styles.footerDot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0D0D0D',
    letterSpacing: -0.5,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 110,
  },

  /* ── Action Buttons ── */
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 8,
  },
  donateButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  requestButton: {
    backgroundColor: '#111',
  },
  buttonIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIconWrapDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donateButtonText: {
    flex: 1,
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  requestButtonText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* ── Section Label ── */
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#888',
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4E4E4',
  },

  /* ── Carousel ── */
  carouselContainer: {
    height: 155,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
  },
  promotionalCard: {
    position: 'absolute',
    width: '100%',
    height: 155,
    borderRadius: 20,
    paddingVertical: 22,
    paddingLeft: 22,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  /* Decorative circles baked into the card */
  cardDecorCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    right: -30,
    top: -30,
  },
  cardDecorCircleSmall: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.05)',
    right: 50,
    bottom: -20,
  },
  cardContentLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  promotionalText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginBottom: 6,
  },
  promotionalCTA: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  /* Dots */
  carouselIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D8D8D8',
  },
  dotActive: {
    backgroundColor: '#0D0D0D',
    width: 18,
    borderRadius: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 28,
  },

  /* ── Features ── */
  featuresSection: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D0D0D',
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 14,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextBlock: {
    flex: 1,
    paddingTop: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  featureDescription: {
    fontSize: 13,
    color: '#777',
    lineHeight: 19,
  },

  /* ── Footer ── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
  },
  footerText: {
    fontSize: 11,
    color: '#BBB',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});