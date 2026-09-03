import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';

export const CompanyInfoRequiredModal: React.FC = () => {
  const { user, updateProfile } = useAuthStore();
  const { theme } = useThemeStore();
  const { t, language } = useLanguageStore();

  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Periksa apakah data informasi perusahaan masih kosong
  const isMissing = Boolean(
    user &&
      (!user.company_name ||
        user.company_name.trim() === '' ||
        !user.department ||
        user.department.trim() === '')
  );

  React.useEffect(() => {
    if (user) {
      if (user.company_name) setCompanyName(user.company_name);
      if (user.department) setDepartment(user.department);
      if (user.full_name) setFullName(user.full_name);
    }
  }, [user]);

  if (!isMissing) return null;

  const handleSave = async () => {
    if (!companyName.trim()) {
      setErrorMessage(
        language === 'id'
          ? 'Nama Perusahaan wajib diisi.'
          : 'Company Name is required.'
      );
      return;
    }
    if (!department.trim()) {
      setErrorMessage(
        language === 'id'
          ? 'Departemen / Divisi wajib diisi.'
          : 'Department / Division is required.'
      );
      return;
    }

    setErrorMessage('');
    setIsSaving(true);
    try {
      await updateProfile({
        company_name: companyName.trim(),
        department: department.trim(),
        full_name: fullName.trim() || user?.full_name || 'Pengguna',
      });
      if (Platform.OS === 'web') {
        // Berhasil disimpan
      } else {
        Alert.alert(t('common.success'), 'Data perusahaan berhasil disimpan!');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={isMissing} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {/* Badge Alert */}
          <View style={styles.headerIconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="business" size={28} color={Palette.primary} />
            </View>
            <View style={styles.mandatoryBadge}>
              <Ionicons name="alert-circle" size={12} color="#FFFFFF" />
              <Text style={styles.mandatoryBadgeText}>
                {language === 'id' ? 'Wajib Dilengkapi' : 'Mandatory Setup'}
              </Text>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: theme.text }]}>
            {language === 'id'
              ? 'Informasi Perusahaan & Rekapitulasi Klaim'
              : 'Company Information & Claim Setup'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {language === 'id'
              ? 'Sebelum mengeksplorasi fitur ScanFinance, Anda wajib melengkapi data nama perusahaan dan departemen/divisi untuk keperluan rekapitulasi klaim resmi.'
              : 'Before exploring ScanFinance, please complete your company name and department/division for official claim reporting.'}
          </Text>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Palette.coral} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {language === 'id' ? 'Nama Perusahaan / Organisasi *' : 'Company / Organization Name *'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Ionicons name="business-outline" size={18} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={companyName}
                  onChangeText={(val) => {
                    setCompanyName(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Contoh: PT. San Kawan Abadi"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {language === 'id' ? 'Departemen / Divisi Kerja *' : 'Department / Division *'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Ionicons name="briefcase-outline" size={18} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={department}
                  onChangeText={(val) => {
                    setDepartment(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Contoh: Divisi Operasional & Lapangan"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {language === 'id' ? 'Nama Lengkap Pengaju' : 'Employee Full Name'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Ionicons name="person-outline" size={18} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nama Lengkap Anda"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.saveButton, { opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>
                  {language === 'id' ? 'Simpan & Lanjutkan Eksplorasi' : 'Save & Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mandatoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242, 63, 67, 0.1)',
    borderColor: Palette.coral,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Palette.coral,
    fontSize: 12,
    fontWeight: '500',
  },
  form: {
    gap: 14,
    marginBottom: 22,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  saveButton: {
    backgroundColor: Palette.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
