import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabaseClient';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setFirstName('');
    setLastName('');
    setError('');
    setInfo('');
    setConfirmPassword('');
  };

  const validate = () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return false;
    }
    if (mode === 'signup') {
      if (!firstName.trim()) {
        setError('Please enter your first name');
        return false;
      }
      if (!confirmPassword) {
        setError('Please confirm your password');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace('/(tabs)');
      } else {
        const fullName = `${firstName.trim()}${lastName.trim() ? ' ' + lastName.trim() : ''}`;
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim() || null,
              full_name: fullName || null,
            }
          }
        });
        if (err) throw err;
        if (data.user) {
          try {
            await supabase.from('profiles').upsert({
              user_id: data.user.id,
              display_name: fullName || null,
            });
          } catch (_e) {
            // ignore profile errors for now
          }
        }
        if (data.user && !data.session) {
          setInfo('Sign up successful. Please check your email to confirm your account.');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (e) {
      setError(e?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>Anudaan</Text>
            <Text style={styles.subtitle}>Share more, waste less. Join the community.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: mode === 'signin' ? '#2196F3' : '#FF9800' }]}>
              <Ionicons name={mode === 'signin' ? 'log-in' : 'person-add'} size={24} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>{mode === 'signin' ? 'Welcome back' : 'Create an account'}</Text>
            <Text style={styles.cardSubtitle}>{mode === 'signin' ? 'Sign in to continue' : 'Sign up to get started'}</Text>
            </View>

            {mode === 'signup' && (
              <>
                <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name<Text style={{ color: '#F44336' }}> *</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor="#999"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                </View>

                <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Last name"
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={setLastName}
                />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            </View>

            <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            </View>

            {mode === 'signup' && (
              <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#999"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                />
              </View>
            )}

            {error ? (
              <View style={styles.alertError}><Ionicons name="alert-circle" size={18} color="#fff" /><Text style={styles.alertText}>{error}</Text></View>
            ) : null}
            {info ? (
              <View style={styles.alertInfo}><Ionicons name="information-circle" size={18} color="#11181C" /><Text style={styles.alertInfoText}>{info}</Text></View>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} activeOpacity={0.8} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name={mode === 'signin' ? 'log-in' : 'person-add'} size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}</Text>
              <TouchableOpacity onPress={toggleMode}>
                <Text style={styles.switchLink}>{mode === 'signin' ? 'Sign Up' : 'Sign In'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{`By continuing, you agree to Anudaan's Terms and Privacy Policy.`}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  header: { marginTop: 10, marginBottom: 20, alignItems: 'center' },
  brand: { fontSize: 28, fontWeight: 'bold', color: '#11181C' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  cardHeader: { alignItems: 'center', marginBottom: 10 },
  iconBadge: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#11181C' },
  cardSubtitle: { fontSize: 13, color: '#687076', marginTop: 4 },
  inputGroup: { marginTop: 12 },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff'
  },
  alertError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F44336', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  alertText: { color: '#fff', fontSize: 13, flex: 1 },
  alertInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F7DC6F', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  alertInfoText: { color: '#11181C', fontSize: 13, flex: 1 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2196F3', paddingVertical: 12, borderRadius: 14, marginTop: 16 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  switchText: { color: '#666', fontSize: 13 },
  switchLink: { color: '#FF9800', fontSize: 13, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 16 },
  footerText: { color: '#999', fontSize: 12, textAlign: 'center' }
});
