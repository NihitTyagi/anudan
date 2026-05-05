import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';
import UserAvatar from '../../components/UserAvatar';
import { DEFAULT_REGION, haversineMeters, isValidCoordinate, isWithinRadiusMeters, NEARBY_RADIUS_M, normalizeSearch } from '../../lib/geo';
import { supabase } from '../../lib/supabaseClient';

// The Donate tab shows people in need nearby -> load request_items from DB
async function fetchRequests() {
  const { data, error } = await supabase
    .from('request_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function DonateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(DEFAULT_REGION);
  const [hasPreciseLocation, setHasPreciseLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedMode, setFeedMode] = useState('nearby');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profileMap, setProfileMap] = useState({});
  const [avatarMap, setAvatarMap] = useState({});

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const location =
          (await Location.getLastKnownPositionAsync({})) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!location) return;
        const next = {
          ...DEFAULT_REGION,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(next);
        setHasPreciseLocation(true);
      } catch (_e) {
        // keep default region
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
        ...visibleMarkerItems.map(r => ({
          latitude: Number(r.latitude),
          longitude: Number(r.longitude)
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
      setLoading(true);
      const rows = await fetchRequests();
      setRequests(rows);
      const ids = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
      let map = {};
      const avatars = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', ids);
        (profs || []).forEach((p) => {
          map[p.user_id] = p.display_name || '';
          if (p.avatar_url) avatars[p.user_id] = p.avatar_url;
        });
      }
      // Fallback for current user if profile display_name is missing
      if (user && ids.includes(user.id) && !map[user.id]) {
        const meta = user.user_metadata || {};
        const fullFromMeta =
          meta.full_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
          user.email ||
          'User';
        map[user.id] = fullFromMeta;
      }
      setProfileMap(map);
      setAvatarMap(avatars);
    } catch (_e) {
      // ignore for now
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visibleItems = useMemo(() => {
    const q = normalizeSearch(debouncedSearch);
    const filtered = (requests || []).filter((request) => {
      const lat = Number(request.latitude);
      const lng = Number(request.longitude);
      const hasCoords = isValidCoordinate(lat, lng);
      const isNearby = hasCoords && isWithinRadiusMeters(userLocation, lat, lng, NEARBY_RADIUS_M);
      
      // Basic text search filter
      const posterName = request.poster_name || profileMap[request.user_id] || '';
      const haystack = normalizeSearch(`${request.title} ${request.description} ${posterName}`);
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
  }, [requests, debouncedSearch, feedMode, userLocation, profileMap]);

  // Marker items should show all items matching search, regardless of radius filter
  // This addresses "even if it is not in the radius it has to show the locator on the map if the item is present"
  const visibleMarkerItems = useMemo(() => {
    const q = normalizeSearch(debouncedSearch);
    return (requests || []).filter((request) => {
      const lat = Number(request.latitude);
      const lng = Number(request.longitude);
      if (!isValidCoordinate(lat, lng)) return false;

      const posterName = request.poster_name || profileMap[request.user_id] || '';
      const haystack = normalizeSearch(`${request.title} ${request.description} ${posterName}`);
      return !q || haystack.includes(q);
    });
  }, [requests, debouncedSearch, profileMap]);

  // Auto-switch feedMode if searching and no results in 'nearby'
  useEffect(() => {
    if (feedMode === 'nearby' && debouncedSearch && visibleItems.length === 0) {
      // Check if there ARE items that would show in 'all' mode
      const hasAnyMatch = requests.some(r => {
        const posterName = r.poster_name || profileMap[r.user_id] || '';
        const haystack = normalizeSearch(`${r.title} ${r.description} ${posterName}`);
        return haystack.includes(normalizeSearch(debouncedSearch));
      });
      if (hasAnyMatch) {
        setFeedMode('all');
      }
    }
  }, [debouncedSearch, visibleItems.length, feedMode, requests, profileMap]);

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
          {visibleMarkerItems.map((request) => (
            <Marker
              key={request.id}
              coordinate={{
                latitude: Number(request.latitude),
                longitude: Number(request.longitude),
              }}
              title={request.title}
              description={request.description || ''}
            >
              <View style={styles.redPin}>
                <View style={styles.redPinInner} />
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
        <Text style={styles.contentTitle}>People in need nearby!</Text>
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
            visibleItems.map((request) => {
              const posterName = request.poster_name || profileMap[request.user_id] || 'User';
              return (
              <TouchableOpacity
                key={request.id}
                style={styles.requestCard}
                onPress={() => {
                  router.push({
                    pathname: '/item/[id]',
                    params: {
                      id: String(request.id),
                      title: request.title,
                      description: request.description,
                      userName: posterName,
                      posterUserId: request.user_id || '',
                      avatarPath: avatarMap[request.user_id] || '',
                      latitude: request.latitude != null ? String(request.latitude) : '',
                      longitude: request.longitude != null ? String(request.longitude) : '',
                      locationLabel: request.location_label || '',
                      date: request.created_at
                        ? new Date(request.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          })
                        : 'Recently',
                      type: 'request',
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestDescription}>{request.description}</Text>
                <View style={styles.requestUserInfo}>
                  <UserAvatar
                    userId={request.user_id}
                    name={posterName}
                    storagePath={avatarMap[request.user_id]}
                    size={32}
                  />
                  <Text style={styles.userName}>
                    {posterName}
                  </Text>
                  <Text style={styles.requestDate}>
                    {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'Recently'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
            })
          )}
          {!loading && visibleItems.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#666' }}>
              No matching requests found.
            </Text>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => router.push('/donate/add')}>
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
  redPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
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
  redPinInner: {
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
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 6,
  },
  requestDescription: {
    fontSize: 14,
    color: '#11181C',
    marginBottom: 10,
    lineHeight: 20,
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  userName: {
    fontSize: 14,
    color: '#11181C',
    flex: 1,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
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
