import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notification
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ visible, type, message, onDismiss }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      const timer = setTimeout(onDismiss, 4500);
      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const configs = {
    error:   { bg: '#111', icon: 'close-circle',       iconColor: '#fff', border: '#333', textColor: '#fff' },
    success: { bg: '#111', icon: 'checkmark-circle',   iconColor: '#fff', border: '#444', textColor: '#fff' },
    info:    { bg: '#fff', icon: 'information-circle', iconColor: '#000', border: '#ddd', textColor: '#000' },
  };
  const cfg = configs[type] || configs.error;

  return (
    <Animated.View
      style={[
        toastStyles.container,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
      <Text style={[toastStyles.text, { color: cfg.textColor }]}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="close"
          size={18}
          color={type === 'info' ? '#666' : '#aaa'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  text: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 19,
    marginLeft: 10,
    marginRight: 10,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Success Modal
// ─────────────────────────────────────────────────────────────────────────────

function SuccessModal({ visible, onClose, title, message }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={modalStyles.backdrop}>
        <Animated.View
          style={[modalStyles.box, { opacity, transform: [{ scale }] }]}
        >
          <View style={modalStyles.iconRing}>
            <Ionicons name="mail-outline" size={32} color="#000" />
          </View>
          <Text style={modalStyles.title}>{title || 'Check your inbox'}</Text>
          <Text style={modalStyles.body}>
            {message || "We've sent a confirmation link to your email. Please verify to activate your account."}
          </Text>
          <TouchableOpacity
            style={modalStyles.button}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={modalStyles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password Modal
// ─────────────────────────────────────────────────────────────────────────────

function ForgotPasswordModal({ visible, onClose, onSendCode, onVerifyCode }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'code'
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setLoading(true);
    const success = await onSendCode(email);
    setLoading(false);
    if (success) setStep('code');
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) return;
    setLoading(true);
    await onVerifyCode(email, code);
    setLoading(false);
    // Modal will be closed by parent on success
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setCode('');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.box}>
          <Text style={modalStyles.title}>
            {step === 'email' ? 'Reset Password' : 'Verify Code'}
          </Text>
          <Text style={modalStyles.body}>
            {step === 'email' 
              ? 'Enter your email to receive a 6-digit verification code.' 
              : `Enter the 6-digit code sent to ${email}`}
          </Text>
          
          <View style={{ width: '100%', marginBottom: 20 }}>
            {step === 'email' ? (
              <InputField
                label="Email Address"
                icon="mail-outline"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <InputField
                label="Verification Code"
                icon="key-outline"
                placeholder="123456"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              style={[modalStyles.button, { flex: 1, backgroundColor: '#eee' }]} 
              onPress={handleClose}
            >
              <Text style={[modalStyles.buttonText, { color: '#000' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[modalStyles.button, { flex: 2 }]} 
              onPress={step === 'email' ? handleSend : handleVerify}
              disabled={loading || (step === 'email' ? !email : code.length !== 6)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={modalStyles.buttonText}>
                  {step === 'email' ? 'Send Code' : 'Verify & Reset'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// InputField
// ─────────────────────────────────────────────────────────────────────────────

function InputField({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  icon,
  hasError,
  errorText,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.group}>
      <Text style={fieldStyles.label}>
        {label}
        {required ? <Text style={fieldStyles.required}> *</Text> : null}
      </Text>
      <View
        style={[
          fieldStyles.inputWrap,
          focused ? fieldStyles.inputFocused : null,
          hasError ? fieldStyles.inputError : null,
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={hasError ? '#E53935' : focused ? '#000' : '#aaa'}
          style={fieldStyles.icon}
        />
        <TextInput
          style={fieldStyles.input}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'sentences'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {hasError ? (
          <Ionicons name="alert-circle" size={16} color="#E53935" />
        ) : null}
      </View>
      {hasError && errorText ? (
        <Text style={fieldStyles.errorText}>{errorText}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  group: { marginTop: 14 },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  required: { color: '#000' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e4e4e4',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#E53935',
    backgroundColor: '#fff8f8',
  },
  icon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
  },
  errorText: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 5,
    marginLeft: 2,
    fontWeight: '500',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'error', message: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: '', message: '' });
  const [passwordError, setPasswordError] = useState('');

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
  };

  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setFirstName('');
    setLastName('');
    setConfirmPassword('');
    setPasswordError('');
    hideToast();
  };

  const validate = () => {
    if (!email || !password) {
      showToast('error', 'Please enter your email and password.');
      return false;
    }
    if (mode === 'signup') {
      if (!firstName.trim()) {
        showToast('error', 'First name is required.');
        return false;
      }
      if (!confirmPassword) {
        showToast('error', 'Please confirm your password.');
        return false;
      }
      if (password !== confirmPassword) {
        showToast('error', 'Passwords do not match.');
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    if (!validate()) return;
    setLoading(true);
    hideToast();
    setPasswordError('');
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        router.replace('/(tabs)');
      } else {
        const fullName = `${firstName.trim()}${
          lastName.trim() ? ' ' + lastName.trim() : ''
        }`;
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim() || null,
              full_name: fullName || null,
            },
            emailRedirectTo: 'anudan://auth/reset-password',
          },
        });

        // Handle already registered error
        if (err) {
          if (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('user already exists')) {
            showToast('info', 'This email is already registered. Please sign in instead.');
            setMode('signin');
            return;
          }
          throw err;
        }

        if (data.user) {
          try {
            await supabase.from('profiles').upsert({
              user_id: data.user.id,
              display_name: fullName || null,
            });
          } catch (_e) {
            // ignore profile errors
          }
        }
        if (data.user && !data.session) {
          setSuccessModalData({
            title: 'Check your inbox',
            message: "We've sent a confirmation link to your email. Please verify to activate your account."
          });
          setShowSuccessModal(true);
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (e) {
      const msg = e?.message || '';
      // Show inline error on password field for credential/password errors
      const isPasswordError =
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('invalid credentials');
      if (isPasswordError) {
        setPasswordError('Incorrect password. Please try again.');
      } else {
        showToast('error', msg || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (emailToReset) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToReset);
      if (error) throw error;
      
      showToast('info', 'Verification code sent to your email.');
      return true; // Success
    } catch (e) {
      showToast('error', e.message || 'Failed to send reset code.');
      return false;
    }
  };

  const handleVerifyCode = async (emailToVerify, token) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailToVerify,
        token: token,
        type: 'recovery',
      });
      if (error) throw error;
      
      setShowForgotModal(false);
      router.push('/auth/reset-password');
    } catch (e) {
      showToast('error', e.message || 'Invalid or expired code.');
    }
  };

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Floating Toast */}
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={hideToast}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={successModalData.title}
        message={successModalData.message}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        visible={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSendCode={handleForgotPassword}
        onVerifyCode={handleVerifyCode}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>A</Text>
            </View>
            <Text style={styles.brand}>Anudaan</Text>
            <Text style={styles.subtitle}>Share more, waste less.</Text>
          </View>

          {/* Sign In / Sign Up Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.togglePill,
                !isSignup ? styles.togglePillActive : null,
              ]}
              onPress={() => mode !== 'signin' && toggleMode()}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.togglePillText,
                  !isSignup ? styles.togglePillTextActive : null,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.togglePill,
                isSignup ? styles.togglePillActive : null,
              ]}
              onPress={() => mode !== 'signup' && toggleMode()}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.togglePillText,
                  isSignup ? styles.togglePillTextActive : null,
                ]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isSignup ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.cardSub}>
              {isSignup ? 'Join the community today.' : 'Sign in to continue.'}
            </Text>

            {isSignup && (
              <View style={styles.nameRow}>
                <View style={styles.nameCol}>
                  <InputField
                    label="First Name"
                    required
                    placeholder="First"
                    value={firstName}
                    onChangeText={setFirstName}
                    icon="person-outline"
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.nameGap} />
                <View style={styles.nameCol}>
                  <InputField
                    label="Last Name"
                    placeholder="Last"
                    value={lastName}
                    onChangeText={setLastName}
                    icon="person-outline"
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <InputField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <InputField
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(''); }}
              icon="lock-closed-outline"
              secureTextEntry
              autoCapitalize="none"
              hasError={!!passwordError}
              errorText={passwordError}
            />

            {!isSignup && (
              <TouchableOpacity 
                style={styles.forgotPass} 
                onPress={() => setShowForgotModal(true)}
              >
                <Text style={styles.forgotPassText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {isSignup && (
              <InputField
                label="Confirm Password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon="shield-checkmark-outline"
                secureTextEntry
                autoCapitalize="none"
              />
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                loading ? { opacity: 0.65 } : null,
              ]}
              onPress={handleAuth}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignup ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isSignup
                  ? 'Already have an account?'
                  : "Don't have an account?"}
              </Text>
              <TouchableOpacity
                onPress={toggleMode}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.switchLink}>
                  {isSignup ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerText}>
            {"By continuing, you agree to Anudaan's Terms & Privacy Policy."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#888',
    marginTop: 4,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  togglePillTextActive: {
    color: '#fff',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000',
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },

  // Name row
  nameRow: {
    flexDirection: 'row',
  },
  nameCol: {
    flex: 1,
  },
  nameGap: {
    width: 12,
  },

  // Button
  primaryButton: {
    backgroundColor: '#000',
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '500',
    marginLeft: 10,
    marginRight: 10,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#888',
    fontSize: 13.5,
    marginRight: 4,
  },
  switchLink: {
    color: '#000',
    fontSize: 13.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPassText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },

  // Footer
  footerText: {
    color: '#bbb',
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 17,
  },
});