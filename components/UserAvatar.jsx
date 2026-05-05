import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarPlaceholderColor, getAvatarPublicUrl, initialsFromName } from '../lib/avatarHelpers';

/**
 * Shows profile image from storage path or full URI, else initials on colored circle.
 */
export default function UserAvatar({
  userId,
  name,
  storagePath,
  uri,
  size = 40,
}) {
  const imageUri = useMemo(() => {
    if (uri) return uri;
    if (storagePath) return getAvatarPublicUrl(storagePath);
    return '';
  }, [uri, storagePath]);

  const bg = avatarPlaceholderColor(userId || name);
  const initials = initialsFromName(name);

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#e0e0e0',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '700',
    color: '#fff',
  },
});
