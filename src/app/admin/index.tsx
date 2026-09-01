import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useTransactionStore } from '@/store/transactionStore';
import { UserProfile } from '@/types';
import { formatRupiah } from '@/utils/formatters';

export default function AdminPanelScreen() {
  const router = useRouter();
  const {
    getAllUsers,
    createUserByAdmin,
    impersonateUser,
    user: currentUser,
  } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { loadData } = useTransactionStore();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('PT. Nama Perusahaan');
  const [department, setDepartment] = useState('Divisi Operasional');
  const [projectName, setProjectName] = useState('Head Office / Proyek 1');
  const [city, setCity] = useState('Jakarta');
  const [cashAdvance, setCashAdvance] = useState('5000000');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const list = await getAllUsers();
    setUsers(list);
    setIsLoading(false);
  };

  const handleCreateUser = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Perhatian', 'Nama lengkap dan email wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    const res = await createUserByAdmin({
      full_name: fullName.trim(),
      email: email.trim(),
      password: password.trim() || 'password123',
      company_name: companyName.trim(),
      department: department.trim(),
      project_name: projectName.trim(),
      city: city.trim(),
      cash_advance_amount: Number(cashAdvance) || 5000000,
    });
    setIsSubmitting(false);

    if (res.success) {
      Alert.alert('Berhasil! 🎉', `Akun untuk "${fullName}" telah berhasil didaftarkan.`);
      setShowAddModal(false);
      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } else {
      Alert.alert('Gagal', res.error || 'Terjadi kesalahan saat menambahkan pengguna.');
    }
  };

  const handleEnterUserDashboard = async (targetUser: UserProfile) => {
    impersonateUser(targetUser);
    await loadData();
    router.push('/(tabs)');
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.company_name && u.company_name.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Navbar */}
      <View style={[styles.navbar, { borderBottomColor: theme.border }]}>
        <View style={styles.navLeft}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.cardHover }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.navTitle, { color: theme.text }]}>Panel Admin</Text>
            <Text style={[styles.navSubtitle, { color: theme.textSecondary }]}>
              Manajemen Pengguna & Dashboard
            </Text>
          </View>
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.cardHover }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={mode === 'dark' ? 'sunny' : 'moon'}
              size={18}
              color={mode === 'dark' ? Palette.amber : Palette.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Admin Action */}
        <View
          style={[
            styles.bannerCard,
            {
              backgroundColor:
                mode === 'dark' ? 'rgba(88, 101, 242, 0.15)' : 'rgba(88, 101, 242, 0.08)',
              borderColor: 'rgba(88, 101, 242, 0.3)',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <View style={styles.shieldIconBox}>
              <Ionicons name="shield-checkmark" size={26} color={Palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>
                Akses Master Pengguna
              </Text>
              <Text style={[styles.bannerDesc, { color: theme.textSecondary }]}>
                Pilih pengguna di bawah untuk melihat dashboard & struk belanja mereka, atau tambahkan anggota baru.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addUserBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.addUserBtnText}>Tambah User Baru</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cari berdasarkan nama, email, atau divisi..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Users Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Daftar Pengguna ({filteredUsers.length})
          </Text>
          <TouchableOpacity onPress={fetchUsers}>
            <Ionicons name="refresh" size={18} color={Palette.primaryLight} />
          </TouchableOpacity>
        </View>

        {/* User Cards List */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Memuat data pengguna...
            </Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Tidak ada pengguna ditemukan
            </Text>
          </View>
        ) : (
          filteredUsers.map((u) => {
            const isCurrent = currentUser?.id === u.id;
            return (
              <View
                key={u.id}
                style={[
                  styles.userCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  isCurrent && styles.activeUserCardBorder,
                ]}
              >
                <View style={styles.userCardTop}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {u.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfoCol}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: theme.text }]}>
                        {u.full_name}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Sedang Aktif</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                      {u.email}
                    </Text>
                    <Text style={[styles.userCompany, { color: theme.textMuted }]}>
                      🏢 {u.company_name || 'PT. Nama Perusahaan'} • {u.department || 'Operasional'}
                    </Text>
                  </View>
                </View>

                {/* Cash Advance & Actions Row */}
                <View style={[styles.userCardFooter, { borderTopColor: theme.border }]}>
                  <View>
                    <Text style={[styles.cashAdvanceLabel, { color: theme.textMuted }]}>
                      Cash Advance
                    </Text>
                    <Text style={[styles.cashAdvanceVal, { color: theme.text }]}>
                      {formatRupiah(u.cash_advance_amount ?? 5000000)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.switchDashboardBtn,
                      isCurrent && { backgroundColor: theme.cardHover },
                    ]}
                    onPress={() => handleEnterUserDashboard(u)}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={16}
                      color={isCurrent ? theme.text : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.switchDashboardBtnText,
                        isCurrent && { color: theme.text },
                      ]}
                    >
                      {isCurrent ? 'Lihat Dashboard' : 'Masuk ke Dashboard'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Tambah User Baru */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Tambah Pengguna Baru
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalForm}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Nama Lengkap *
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Contoh: User 2"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Email Akun *
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="user2@company.com"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Kata Sandi Awal
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimal 6 Karakter (Default: password123)"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                  />
                </View>

                <View style={styles.rowTwoCols}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Perusahaan
                    </Text>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                      ]}
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder="PT. Nama Perusahaan"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Divisi / Dept
                    </Text>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                      ]}
                      value={department}
                      onChangeText={setDepartment}
                      placeholder="Operasional"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Jumlah Cash Advance (Rp)
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={cashAdvance}
                    onChangeText={setCashAdvance}
                    keyboardType="numeric"
                    placeholder="5000000"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleCreateUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Simpan & Buat Akun</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  navSubtitle: {
    fontSize: 11,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerCard: {
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    gap: 12,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  shieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(88, 101, 242, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  bannerDesc: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  addUserBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  userCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  activeUserCardBorder: {
    borderColor: Palette.primary,
    borderWidth: 1.5,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  currentBadge: {
    backgroundColor: 'rgba(35, 165, 90, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: Palette.greenOnline,
    fontSize: 10,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  userCompany: {
    fontSize: 10,
    marginTop: 3,
  },
  userCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cashAdvanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cashAdvanceVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  switchDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  switchDashboardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalForm: {
    gap: 10,
  },
  fieldGroup: {
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSubmitBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
