import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocationPickerModal from '../../components/LocationPickerModal';
import { isValidCoordinate } from '../../lib/geo';
import { supabase } from '../../lib/supabaseClient';

export default function AddRequest() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.id ? String(params.id) : null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('request_items')
          .select('*')
          .eq('id', editId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setLatitude(data.latitude ?? null);
          setLongitude(data.longitude ?? null);
          setLocationLabel(data.location_label || '');
        }
      } catch (_e) {}
    })();
  }, [editId]);

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow location access to autofill item location.');
        return;
      }
      const current =
        (await Location.getLastKnownPositionAsync({})) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!current) {
        Alert.alert('Location unavailable', 'Could not fetch current location.');
        return;
      }
      setLatitude(current.coords.latitude);
      setLongitude(current.coords.longitude);
      setLocationLabel('');
    } catch (_e) {
      Alert.alert('Location unavailable', 'Could not fetch current location.');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setUploading(false);
        Alert.alert('Sign in required', 'Please sign in to submit a request.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Login', onPress: () => router.replace('/auth/login') },
        ]);
        return;
      }

      let posterName = null;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        posterName = prof?.display_name || null;
      } catch (_e) {}
      if (!posterName) {
        const meta = user.user_metadata || {};
        posterName =
          meta.full_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
          user.email ||
          null;
      }

      if (editId) {
        const { error } = await supabase
          .from('request_items')
          .update({
            title,
            description,
            poster_name: posterName,
            latitude: isValidCoordinate(latitude, longitude) ? latitude : null,
            longitude: isValidCoordinate(latitude, longitude) ? longitude : null,
            location_label: locationLabel.trim() || null,
          })
          .eq('id', editId)
          .eq('user_id', user.id);
        if (error) throw error;
        Alert.alert('Success', 'Request updated!');
      } else {
        const { error } = await supabase.from('request_items').insert([
          {
            user_id: user.id,
            title,
            description,
            poster_name: posterName,
            latitude: isValidCoordinate(latitude, longitude) ? latitude : null,
            longitude: isValidCoordinate(latitude, longitude) ? longitude : null,
            location_label: locationLabel.trim() || null,
          },
        ]);
        if (error) throw error;
        Alert.alert('Success', 'Request submitted!');
      }
      setTitle('');
      setDescription('');
      setLatitude(null);
      setLongitude(null);
      setLocationLabel('');
      router.back();
    } catch (e) {
      Alert.alert('Submission failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const hasLocation = isValidCoordinate(latitude, longitude);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>{editId ? 'EDIT REQUEST' : 'NEW REQUEST'}</Text>
          <Text style={styles.headerTitle}>Request an Item</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Section: Details */}
        <Text style={styles.sectionLabel}>ITEM DETAILS</Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            placeholder="What do you need?"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            placeholder="Size, quantity, urgency, any useful details..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />
        </View>

        {/* Section: Location */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>NEEDED AT</Text>

        <View style={styles.locationCard}>
          <View style={styles.locationInfo}>
            <View style={[styles.locationDot, hasLocation && styles.locationDotActive]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCoords}>
                {hasLocation
                  ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
                  : 'No location set'}
              </Text>
              {locationLabel ? (
                <Text style={styles.locationLabel}>{locationLabel}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.locationActions}>
            <TouchableOpacity onPress={useCurrentLocation} style={styles.btnSecondary} activeOpacity={0.7}>
              <Text style={styles.btnSecondaryText}>Use Current</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.btnPrimary} activeOpacity={0.7}>
              <Text style={styles.btnPrimaryText}>Pick on Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
        <View style={styles.divider} />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={uploading}
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{editId ? 'Save Changes' : 'Submit Request'}</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      <LocationPickerModal
        visible={pickerVisible}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onClose={() => setPickerVisible(false)}
        onConfirm={({ latitude: lat, longitude: lng, locationLabel: label }) => {
          setLatitude(lat);
          setLongitude(lng);
          setLocationLabel(label || '');
          setPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // Header
  header: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#999',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },

  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#999',
    marginBottom: 14,
  },

  // Inputs
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  // Location
  locationCard: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fafafa',
    gap: 14,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d0d0d0',
    marginTop: 3,
  },
  locationDotActive: {
    backgroundColor: '#000',
  },
  locationCoords: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#555',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});