import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingSpinner from '../../components/LoadingSpinner';
import UserAvatar from '../../components/UserAvatar';
import { decodePolyline, formatDistance, isValidCoordinate } from '../../lib/geo';

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_DISTANCE_KEY || (Platform.OS === 'android' 
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY 
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY);

export default function ItemDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  
  // Get item data from params
  const itemId = params.id;
  const itemTitle = params.title || 'Item';
  const itemDescription = params.description || 'No description available';
  const userName = params.userName || 'User';
  const posterUserId = params.posterUserId || '';
  const avatarPath = params.avatarPath || '';
  const imageUrl = params.imageUrl || '';
  const itemLat = params.latitude ? Number(params.latitude) : null;
  const itemLng = params.longitude ? Number(params.longitude) : null;
  const locationLabel = params.locationLabel || '';
  const date = params.date || 'Recently';
  const itemType = params.type || 'request'; // 'request' or 'donation'
  const isRequest = itemType === 'request';
  const hasItemLocation = isValidCoordinate(itemLat, itemLng);

  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routingError, setRoutingError] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Helper to fit map to show both markers
  const fitMapToMarkers = () => {
    if (mapRef.current && userLocation && hasItemLocation) {
      const coords = [
        userLocation,
        { latitude: itemLat, longitude: itemLng }
      ];
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
    }
  };

  // Fetch road route using the modern Google Routes API
  const fetchRoadRoute = async (origin, dest) => {
    if (!GOOGLE_MAPS_APIKEY) return;
    setIsRouting(true);
    setRoutingError(false);
    
    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_APIKEY,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
          destination: { location: { latLng: { latitude: dest.latitude, longitude: dest.longitude } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      });

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setDistance(route.distanceMeters);
        // Duration comes as a string like "120s", we need seconds
        const seconds = parseInt(route.duration.replace('s', ''));
        setDuration(seconds / 60); // minutes
        
        const points = decodePolyline(route.polyline.encodedPolyline);
        setRouteCoords(points);
        
        // Fit map to show the whole route if map is ready
        if (mapRef.current && points.length > 0 && isMapReady) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
            animated: true,
          });
        }
      } else {
        console.error("No routes found:", data);
        setRoutingError(true);
        if (isMapReady) fitMapToMarkers();
      }
    } catch (error) {
      console.error("Routes API Error:", error);
      setRoutingError(true);
      if (isMapReady) fitMapToMarkers();
    } finally {
      setIsRouting(false);
    }
  };

  // Fetch user location
  useEffect(() => {
    (async () => {
      try {
        setIsLocationLoading(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsLocationLoading(false);
          return;
        }
        
        // Fast attempt: get last known position
        let loc = await Location.getLastKnownPositionAsync({});
        
        // Accurate attempt: if last known is null or old, get current
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        if (loc) {
          const userCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(userCoords);
          
          if (hasItemLocation) {
            fetchRoadRoute(userCoords, { latitude: itemLat, longitude: itemLng });
          }
        }
      } catch (e) {
        console.error("Error getting location in details:", e);
      } finally {
        setIsLocationLoading(false);
      }
    })();
  }, [hasItemLocation, itemLat, itemLng]);

  // Fit map when it becomes ready OR when location/route changes
  useEffect(() => {
    if (isMapReady) {
      if (routeCoords.length > 0) {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
          animated: true,
        });
      } else if (userLocation && hasItemLocation) {
        fitMapToMarkers();
      }
    }
  }, [isMapReady, userLocation, routeCoords, hasItemLocation, routingError]);

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
              <View style={{ flex: 1 }}>
                {isLocationLoading || isRouting ? (
                  <Text style={[styles.infoText, { color: '#999' }]}>Calculating location...</Text>
                ) : (
                  <>
                    <Text style={styles.infoText}>
                      {locationLabel || (hasItemLocation ? 'Location specified' : 'Location not provided')}
                    </Text>
                    {distance !== null && (
                      <Text style={styles.distanceSubtext}>
                        Distance: {formatDistance(distance)} from your location
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Map Section - Path between User and Item */}
        {hasItemLocation && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Road Route & Distance</Text>
            <View style={styles.mapContainer}>
              {isLocationLoading || isRouting ? (
                <View style={styles.mapLoader}>
                  <LoadingSpinner message="Calculating road route..." />
                </View>
              ) : (
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                    latitude: itemLat,
                    longitude: itemLng,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  scrollEnabled={true}
                  zoomEnabled={true}
                  onMapReady={() => setIsMapReady(true)}
                >
                  {/* Item Marker */}
                  <Marker
                    coordinate={{ latitude: itemLat, longitude: itemLng }}
                    title="Item Location"
                    pinColor="#F44336"
                  />

                  {/* User Marker */}
                  {userLocation && (
                    <Marker
                      coordinate={userLocation}
                      title="Your Location"
                      pinColor="#2196F3"
                    />
                  )}

                  {/* Actual Road Directions using modern Routes API path */}
                  {userLocation && routeCoords.length > 0 && (
                    <Polyline
                      coordinates={routeCoords}
                      strokeColor="#0a7ea4"
                      strokeWidth={4}
                    />
                  )}
                  
                  {/* Fallback Straight Line if Routing Fails */}
                  {userLocation && routingError && (
                    <Polyline
                      coordinates={[
                        userLocation,
                        { latitude: itemLat, longitude: itemLng }
                      ]}
                      strokeColor="#F44336"
                      strokeWidth={2}
                      lineDashPattern={[5, 5]}
                    />
                  )}
                </MapView>
              )}
            </View>

            {/* Distance and Time Info - Now Below Map */}
            {!(isLocationLoading || isRouting) && (
              <View style={styles.routeDetailsContainer}>
                <View style={styles.routeDetailItem}>
                  <Ionicons 
                    name={routingError ? "alert-circle-outline" : "car-outline"} 
                    size={20} 
                    color={routingError ? "#F44336" : "#11181C"} 
                  />
                  <Text style={[styles.routeDetailText, routingError && { color: '#F44336' }]}>
                    {routingError 
                      ? "Road route unavailable" 
                      : distance !== null 
                        ? `${formatDistance(distance)} road distance` 
                        : 'Location specified'}
                  </Text>
                </View>
                {duration !== null && !routingError && (
                  <View style={[styles.routeDetailItem, { marginTop: 8 }]}>
                    <Ionicons name="time-outline" size={20} color="#444" />
                    <Text style={[styles.routeDetailText, { color: '#444' }]}>
                      {Math.round(duration)} mins travel time
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
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
    color: '#11181C',
    fontWeight: '500',
  },
  distanceSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  mapSection: {
    marginTop: 25,
    paddingTop: 25,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#11181C',
    marginBottom: 15,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  mapLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  map: {
    flex: 1,
  },
  routeDetailsContainer: {
    marginTop: 15,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDetailText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#11181C',
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
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
