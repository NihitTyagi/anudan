import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LocationPickerModal from '../../components/LocationPickerModal';
import { isValidCoordinate } from '../../lib/geo';
import { supabase } from '../../lib/supabaseClient';

export default function AddDonation() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.id ? String(params.id) : null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [existingImagePath, setExistingImagePath] = useState(null);
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
          .from('donation_items')
          .select('*')
          .eq('id', editId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setExistingImagePath(data.image_path || null);
          setLatitude(data.latitude ?? null);
          setLongitude(data.longitude ?? null);
          setLocationLabel(data.location_label || '');
        }
      } catch (_e) {
        // ignore
      }
    })();
  }, [editId]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const uploadImage = async (uri, path, mimeType = 'image/jpeg') => {
    // New expo-file-system v19+ API — File class reads native URIs directly
    // No fetch(), no base64, no deprecated methods
    const expoFile = new ExpoFile(uri);
    const arrayBuffer = await expoFile.arrayBuffer();
  
    const { data, error } = await supabase
      .storage
      .from('donation-images')
      .upload(path, arrayBuffer, { upsert: true, contentType: mimeType });
  
    if (error) throw error;
  
    const returnedPath = data.path || data.Key || path;
    const prefix = 'donation-images/';
    return returnedPath.startsWith(prefix)
      ? returnedPath.slice(prefix.length)
      : returnedPath;
  };

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
    if (!editId && !image) {
      Alert.alert('Error', 'Please select an image.');
      return;
    }
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setUploading(false);
        Alert.alert('Sign in required', 'Please sign in to upload donations.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Login', onPress: () => router.replace('/auth/login') },
        ]);
        return;
      }

      // Compute poster name once (persist it on the post)
      let posterName = null;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name')   // ← only query what actually exists
          .eq('user_id', user.id)
          .maybeSingle();
        posterName = prof?.display_name || null;
      } catch (_e) {
        // ignore
      }
      if (!posterName) {
        const meta = user.user_metadata || {};
        posterName =
          meta.full_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
          user.email ||
          null;
      }

      let finalImagePath = existingImagePath;
      if (image) {
        const imagePath = `${user.id}/${Date.now()}_${image.fileName || 'donation.jpg'}`;
        const mimeType = image.mimeType || 'image/jpeg';
        finalImagePath = await uploadImage(image.uri, imagePath, mimeType);
      } else if (!editId) {
        // new post requires image, but this case is already guarded above
      }

      if (editId) {
        const { error } = await supabase
          .from('donation_items')
          .update({
            title,
            description,
            image_path: finalImagePath,
            poster_name: posterName,
            latitude: isValidCoordinate(latitude, longitude) ? latitude : null,
            longitude: isValidCoordinate(latitude, longitude) ? longitude : null,
            location_label: locationLabel.trim() || null,
          })
          .eq('id', editId)
          .eq('user_id', user.id);
        if (error) throw error;
        Alert.alert('Success', 'Donation item updated!');
      } else {
        const { error } = await supabase.from('donation_items').insert([
          {
            user_id: user.id,
            title,
            description,
            image_path: finalImagePath,
            poster_name: posterName,
            latitude: isValidCoordinate(latitude, longitude) ? latitude : null,
            longitude: isValidCoordinate(latitude, longitude) ? longitude : null,
            location_label: locationLabel.trim() || null,
          },
        ]);
        if (error) throw error;
        Alert.alert('Success', 'Donation item uploaded!');
      }
      setTitle('');
      setDescription('');
      setImage(null);
      setLatitude(null);
      setLongitude(null);
      setLocationLabel('');
      router.back();
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Upload Donation Product</Text>
        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 8 }}
        />
        <TextInput
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 8, minHeight: 60 }}
        />
        <TouchableOpacity onPress={pickImage} style={{ marginBottom: 10 }}>
          <View style={{ backgroundColor: '#e6f4fe', padding: 12, borderRadius: 8, alignItems: 'center' }}>
            <Text>{image ? 'Change Image' : 'Pick an Image'}</Text>
          </View>
        </TouchableOpacity>
        {image && (
          <Image source={{ uri: image.uri }} style={{ width: 120, height: 120, marginBottom: 10, borderRadius: 8 }} />
        )}
        <View style={{ borderWidth: 1, borderColor: '#e3e3e3', borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 }}>
          <Text style={{ fontWeight: '700', color: '#11181C' }}>Item Location</Text>
          <Text style={{ color: '#666', fontSize: 13 }}>
            Set where this item is actually available for pickup.
          </Text>
          <Text style={{ color: '#11181C', fontSize: 13 }}>
            {isValidCoordinate(latitude, longitude)
              ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
              : 'No location selected'}
          </Text>
          {locationLabel ? <Text style={{ color: '#444', fontSize: 12 }}>{locationLabel}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={useCurrentLocation} style={{ flex: 1 }}>
              <View style={{ backgroundColor: '#f4f4f4', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text>Use Current</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerVisible(true)} style={{ flex: 1 }}>
              <View style={{ backgroundColor: '#e6f4fe', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text>Select on Map</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <Button title={uploading ? 'Uploading...' : 'Submit'} onPress={handleSubmit} disabled={uploading} />
        {uploading && <ActivityIndicator style={{ marginTop: 10 }} />}
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
