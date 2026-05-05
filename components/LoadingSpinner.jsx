import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const LoadingSpinner = ({ message = 'Loading...', size = 'large', color = '#11181C', fullScreen = false }) => {
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={[styles.message, { color }]}>{message}</Text> : null}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoadingSpinner;
