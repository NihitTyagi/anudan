import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../components/AuthProvider'
import LoadingSpinner from '../../components/LoadingSpinner'
import UserAvatar from '../../components/UserAvatar'
import { DEFAULT_REGION, haversineMeters, isValidCoordinate, isWithinRadiusMeters, NEARBY_RADIUS_M, normalizeSearch } from '../../lib/geo'
import { supabase } from '../../lib/supabaseClient'

async function fetchDonations() {
  const { data, error } = await supabase
    .from('donation_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export default function RequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState(DEFAULT_REGION);
  const [hasPreciseLocation, setHasPreciseLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedMode, setFeedMode] = useState('nearby');
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profileMap, setProfileMap] = useState({});
  const [avatarMap, setAvatarMap] = useState({});
  const [imageMap, setImageMap] = useState({});

  // AFTER — graceful fallback to Delhi default if GPS fails
useEffect(() => {
  (async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // lastKnownPositionAsync is fast and doesn't throw on emulators
      let location = await Location.getLastKnownPositionAsync({});

      // If last known is null (fresh device/emulator), try getCurrentPosition
      // with a timeout so it doesn't hang
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // less strict, works on more devices
          timeInterval: 5000,
          distanceInterval: 0,
        });
      }

      if (location) {
        setUserLocation({
          ...DEFAULT_REGION,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setHasPreciseLocation(true);
      }
      // if still null, stays on Delhi default — that's fine
    } catch (_e) {
      // GPS unavailable (emulator, denied at OS level, airplane mode)
      // Map will just show the Delhi default — no crash
    }
  })();
}, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!mapRef.current) return;

    // If there is a search active and we have items, fit the map to show them all
    if (debouncedSearch && visibleMarkerItems.length > 0) {
      const coords = [
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        ...visibleMarkerItems.map(d => ({
          latitude: Number(d.latitude),
          longitude: Number(d.longitude)
        }))
      ];
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
      return;
    }

    // Default: animate to user location
    mapRef.current.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: userLocation.latitudeDelta,
        longitudeDelta: userLocation.longitudeDelta,
      },
      400
    );
  }, [
    userLocation.latitude,
    userLocation.longitude,
    userLocation.latitudeDelta,
    userLocation.longitudeDelta,
    visibleMarkerItems,
    debouncedSearch
  ]);

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await fetchDonations()
      setDonations(rows)
      setImageMap({})
      const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))
      let map = {}
      const avatars = {}
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', ids)
        ;(profs || []).forEach((p) => {
          map[p.user_id] = p.display_name || ''
          if (p.avatar_url) avatars[p.user_id] = p.avatar_url
        })
      }
      if (user && ids.includes(user.id) && !map[user.id]) {
        const meta = user.user_metadata || {}
        const fullFromMeta =
          meta.full_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
          user.email ||
          'User'
        map[user.id] = fullFromMeta
      }
      setProfileMap(map)
      setAvatarMap(avatars)

      // Build signed URLs for donation images (works even if bucket is private)
      const imageRows = (rows || []).filter(r => r.image_path)
      if (imageRows.length) {
        const pairs = await Promise.all(
          imageRows.map(async (r) => {
            try {
              const { data, error } = await supabase
                .storage
                .from('donation-images')
                .createSignedUrl(r.image_path, 60 * 60)
              if (error || !data?.signedUrl) return [r.id, null]
              return [r.id, data.signedUrl]
            } catch (_e) {
              return [r.id, null]
            }
          })
        )
        const nextMap = {}
        pairs.forEach(([id, url]) => { if (id && url) nextMap[id] = url })
        setImageMap(nextMap)
      } else {
        setImageMap({})
      }
    } catch (error) {
      console.error('Error loading donations:', error)
      Alert.alert('Error', 'Server is not responding. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const visibleItems = useMemo(() => {
    const q = normalizeSearch(debouncedSearch);
    const filtered = (donations || []).filter((donation) => {
      // Don't show items posted by the logged in user
      if (donation.user_id === user?.id) return false;

      const lat = Number(donation.latitude);
      const lng = Number(donation.longitude);
      const hasCoords = isValidCoordinate(lat, lng);
      const isNearby = hasCoords && isWithinRadiusMeters(userLocation, lat, lng, NEARBY_RADIUS_M);
      
      // Basic text search filter
      const posterName = donation.poster_name || profileMap[donation.user_id] || '';
      const haystack = normalizeSearch(`${donation.title} ${donation.description} ${posterName}`);
      const matchesSearch = !q || haystack.includes(q);

      if (!matchesSearch) return false;

      // In nearby mode, we filter by radius for the list
      if (feedMode === 'nearby' && !isNearby) return false;

      return true;
    });

    // If searching, or if in "all" mode, sort by distance from userLocation
    // This helps the user see the nearest items first even if far away.
    if (q || feedMode === 'all') {
      return [...filtered].sort((a, b) => {
        const aValid = isValidCoordinate(a.latitude, a.longitude);
        const bValid = isValidCoordinate(b.latitude, b.longitude);
        
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        
        const distA = haversineMeters(userLocation.latitude, userLocation.longitude, Number(a.latitude), Number(a.longitude));
        const distB = haversineMeters(userLocation.latitude, userLocation.longitude, Number(b.latitude), Number(b.longitude));
        return distA - distB;
      });
    }

    return filtered;
  }, [donations, debouncedSearch, feedMode, userLocation, profileMap, user?.id]);

  // Marker items should show all items matching search, regardless of radius filter
  // This addresses "even if it is not in the radius it has to show the locator on the map if the item is present"
  const visibleMarkerItems = useMemo(() => {
    const q = normalizeSearch(debouncedSearch);
    return (donations || []).filter((donation) => {
      // Don't show items posted by the logged in user
      if (donation.user_id === user?.id) return false;

      const lat = Number(donation.latitude);
      const lng = Number(donation.longitude);
      if (!isValidCoordinate(lat, lng)) return false;

      const posterName = donation.poster_name || profileMap[donation.user_id] || '';
      const haystack = normalizeSearch(`${donation.title} ${donation.description} ${posterName}`);
      return !q || haystack.includes(q);
    });
  }, [donations, debouncedSearch, profileMap, user?.id]);

  // Auto-switch feedMode if searching and no results in 'nearby'
  useEffect(() => {
    if (feedMode === 'nearby' && debouncedSearch && visibleItems.length === 0) {
      // Check if there ARE items that would show in 'all' mode
      const hasAnyMatch = donations.some(d => {
        const posterName = d.poster_name || profileMap[d.user_id] || '';
        const haystack = normalizeSearch(`${d.title} ${d.description} ${posterName}`);
        return haystack.includes(normalizeSearch(debouncedSearch));
      });
      if (hasAnyMatch) {
        setFeedMode('all');
      }
    }
  }, [debouncedSearch, visibleItems.length, feedMode, donations, profileMap]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Map Section - Top 40% */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {/* User Location - Blue Pin */}
          <Marker
            coordinate={userLocation}
            pinColor="blue"
            title="Your Location"
          >
            <View style={styles.bluePin}>
              <View style={styles.bluePinInner} />
            </View>
          </Marker>
          {visibleMarkerItems.map((donation) => (
            <Marker
              key={donation.id}
              coordinate={{
                latitude: Number(donation.latitude),
                longitude: Number(donation.longitude),
              }}
              title={donation.title}
              description={donation.description || ''}
            >
              <View style={styles.greenPin}>
                <View style={styles.greenPinInner} />
              </View>
            </Marker>
          ))}

          {/* Radius Circle */}
          {hasPreciseLocation ? (
            <Circle
              center={userLocation}
              radius={NEARBY_RADIUS_M}
              strokeColor="rgba(100, 181, 246, 0.3)"
              fillColor="rgba(100, 181, 246, 0.1)"
              strokeWidth={2}
            />
          ) : null}
        </MapView>

        {/* Search Bar Overlay */}
        <View style={[styles.searchBarContainer, { top: insets.top}]}>
          <TextInput
            style={styles.searchBar}
            placeholder="search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Ionicons
            name="search"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
        </View>
      </View>

      {/* Content Feed Section - White Card Overlay */}
      <View style={styles.contentCard}>
        <Text style={styles.contentTitle}>People donating nearby!</Text>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, feedMode === 'nearby' && styles.modeBtnActive]}
            onPress={() => setFeedMode('nearby')}
          >
            <Text style={[styles.modeText, feedMode === 'nearby' && styles.modeTextActive]}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, feedMode === 'all' && styles.modeBtnActive]}
            onPress={() => setFeedMode('all')}
          >
            <Text style={[styles.modeText, feedMode === 'all' && styles.modeTextActive]}>Show all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && visibleItems.length === 0 ? (
            <LoadingSpinner message="Searching nearby..." />
          ) : (
            visibleItems.map((donation) => {
              const img = imageMap[donation.id] || null
              const posterName =
                donation.poster_name ||
                profileMap[donation.user_id] ||
                'User'
              return (
              <TouchableOpacity
                key={donation.id}
                style={styles.donationCard}
                onPress={() => {
                  router.push({
                    pathname: '/item/[id]',
                    params: {
                      id: String(donation.id),
                      title: donation.title,
                      description: donation.description,
                      userName: posterName,
                      posterUserId: donation.user_id || '',
                      avatarPath: avatarMap[donation.user_id] || '',
                      imageUrl: img || '',
                      latitude: donation.latitude != null ? String(donation.latitude) : '',
                      longitude: donation.longitude != null ? String(donation.longitude) : '',
                      locationLabel: donation.location_label || '',
                      date: donation.created_at
                        ? new Date(donation.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          })
                        : 'Recently',
                      type: 'donation',
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                {img ? (
    <Image
      source={{ uri: img }}
      style={styles.imagePlaceholder}
      onError={() => {
        // Remove broken URL so placeholder shows on re-render
        setImageMap(prev => {
          const next = { ...prev };
          delete next[donation.id];
          return next;
        })
      }}
    />
  ) : (
    <View style={styles.imagePlaceholder}>
      <Ionicons name="image-outline" size={32} color="#999" />
    </View>
  )}

                {/* Item Details */}
                <View style={styles.donationDetails}>
                  <Text style={styles.donationTitle}>{donation.title}</Text>
                  <Text style={styles.donationDescription}>
                    {donation.description}
                  </Text>
                  <View style={styles.posterRow}>
                    <UserAvatar
                      userId={donation.user_id}
                      name={posterName}
                      storagePath={avatarMap[donation.user_id]}
                      size={28}
                    />
                    <Text style={styles.posterName} numberOfLines={1}>
                      {posterName}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              )
            })
          )}
          {!loading && visibleItems.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#666' }}>
              No matching donations found.
            </Text>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => router.push('/request/add')}>
          <Ionicons name="add" size={28} color="#fff" />
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
  mapContainer: {
    height: '40%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  searchBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchBar: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    padding: 0,
  },
  searchIcon: {
    marginLeft: 10,
  },
  bluePin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  bluePinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  greenPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  greenPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#11181C',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
  },
  modeBtnActive: {
    backgroundColor: '#fff',
  },
  modeText: {
    color: '#666',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#11181C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  donationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  donationDetails: {
    flex: 1,
  },
  donationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 4,
  },
  donationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  posterName: {
    fontSize: 13,
    color: '#11181C',
    flex: 1,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
