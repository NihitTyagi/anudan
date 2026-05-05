import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { DEFAULT_REGION, isValidCoordinate, toNumberOrNull } from '../lib/geo';

export default function LocationPickerModal({
  visible,
  initialLatitude,
  initialLongitude,
  onClose,
  onConfirm,
  title = 'Select item location',
}) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const initialPoint = useMemo(() => {
    if (isValidCoordinate(initialLatitude, initialLongitude)) {
      return {
        latitude: Number(initialLatitude),
        longitude: Number(initialLongitude),
      };
    }
    return null;
  }, [initialLatitude, initialLongitude]);

  useEffect(() => {
    if (!visible) return;
    if (initialPoint) {
      const nextRegion = { ...DEFAULT_REGION, ...initialPoint };
      setSelected(initialPoint);
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 250);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) return;
        const last = await Location.getLastKnownPositionAsync({});
        const current =
          last ||
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (!current || !mounted) return;
        const next = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        const nextRegion = { ...DEFAULT_REGION, ...next };
        setSelected(next);
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 300);
      } catch (_e) {
        // keep default region
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible, initialPoint]);

  const handleLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelected({ latitude, longitude });
  };

  const handleUseCurrent = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const current =
        (await Location.getLastKnownPositionAsync({})) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!current) return;
      const next = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setSelected(next);
      const nextRegion = { ...DEFAULT_REGION, ...next };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 300);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      let locationLabel = '';
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: selected.latitude,
          longitude: selected.longitude,
        });
        if (places?.length) {
          const p = places[0];
          locationLabel = [p.name, p.street, p.city || p.subregion, p.region]
            .filter(Boolean)
            .slice(0, 2)
            .join(', ');
        }
      } catch (_e) {
        // label is optional
      }
      onConfirm?.({
        latitude: toNumberOrNull(selected.latitude),
        longitude: toNumberOrNull(selected.longitude),
        locationLabel: locationLabel || '',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#11181C" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          onLongPress={handleLongPress}
          onRegionChangeComplete={setRegion}
          showsCompass
          toolbarEnabled={false}
        >
          {selected ? (
            <Marker
              coordinate={selected}
              draggable
              onDragEnd={(e) => setSelected(e.nativeEvent.coordinate)}
              title="Item location"
            />
          ) : null}
        </MapView>

        <View style={styles.footer}>
          <Text style={styles.hint}>
            Long press or drag the pin to set where this item is actually available.
          </Text>
          <Text style={styles.coords}>
            {selected && selected.latitude !== null && selected.longitude !== null
              ? `${Number(selected.latitude).toFixed(6)}, ${Number(selected.longitude).toFixed(6)}`
              : 'No location selected'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn]}
              onPress={handleUseCurrent}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#11181C" />
              ) : (
                <Text style={styles.secondaryText}>Use Current</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn, !selected && styles.disabled]}
              onPress={handleConfirm}
              disabled={!selected || loading}
            >
              <Text style={styles.primaryText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#11181C' },
  headerSpacer: { width: 34 },
  map: { flex: 1 },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#ececec',
    gap: 8,
    backgroundColor: '#fff',
  },
  hint: { color: '#555', fontSize: 13 },
  coords: { color: '#11181C', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtn: { backgroundColor: '#2196F3' },
  secondaryBtn: { borderWidth: 1, borderColor: '#d7d7d7', backgroundColor: '#fff' },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#11181C', fontWeight: '600' },
});
