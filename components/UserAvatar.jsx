import React, { useMemo } from 'react';
import { Image, StyleSheet } from 'react-native';
import { getAvatarPublicUrl } from '../lib/avatarHelpers';

/**
 * Shows profile image from storage path or full URI, else a shared default avatar image.
 */
export default function UserAvatar({
  storagePath,
  uri,
  size = 40,
}) {
  const imageUri = useMemo(() => {
    if (uri) return uri;
    if (storagePath) return getAvatarPublicUrl(storagePath);
    return '';
  }, [uri, storagePath]);

  return (
    <Image
      source={imageUri ? { uri: imageUri } : require('../assets/images/default-avatar.png')}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#e0e0e0',
  },
});
