import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Mock / static data (replace with real API calls later) ───────────────────
const MOCK_ME = { name: 'Nguyễn Văn An' };
const MOCK_HAS_COMPANY = true; // set false to see the "join company" screen

const MOCK_TODAY = {
  checkin: '08:02',
  checkout: '—',
  worked: '4:12',
  status: 'in' as 'in' | 'idle',
};

const MOCK_MONTH_STATS = { days: 14, late: 2, leaveRemaining: 8 };

const MOCK_LEAVE_BALANCE = {
  annual: { remaining: 8, percent: 67 },
  sick: { remaining: 3, percent: 50 },
};

const MOCK_STREAK = {
  title: 'Chuỗi chuyên cần',
  countLabel: '5/7',
  weekSummary: '14 ngày công • 2 lần muộn',
  days: [
    { label: 'T2', state: 'done' as const },
    { label: 'T3', state: 'done' as const },
    { label: 'T4', state: 'late' as const },
    { label: 'T5', state: 'done' as const },
    { label: 'T6', state: 'done' as const },
    { label: 'T7', state: 'miss' as const },
    { label: 'CN', state: 'today' as const },
  ],
};

const MOCK_RECENT_LOGS = [
  {
    id: '1',
    day: '14',
    dow: 'Th 6',
    checkin: '07:58',
    checkout: '17:05',
    hours: '8.5',
    status: 'ok' as const,
  },
  {
    id: '2',
    day: '13',
    dow: 'Th 5',
    checkin: '08:15',
    checkout: '17:00',
    hours: '8.2',
    status: 'late' as const,
  },
  {
    id: '3',
    day: '12',
    dow: 'Th 4',
    checkin: '07:55',
    checkout: '17:10',
    hours: '8.6',
    status: 'ok' as const,
  },
  {
    id: '4',
    day: '11',
    dow: 'Th 3',
    checkin: '08:00',
    checkout: '17:00',
    hours: '8.0',
    status: 'ok' as const,
  },
  {
    id: '5',
    day: '10',
    dow: 'Th 2',
    checkin: '07:59',
    checkout: '17:05',
    hours: '8.4',
    status: 'ok' as const,
  },
];

const MOCK_TODAY_SHIFT = { name: 'Ca hành chính', start: '08:00', end: '17:00' };

const MOCK_INVITATIONS = [
  { id: 1, company_id: 1, company: { name: 'Công ty TNHH Tương Lai', code: 'TL2024' } },
];

// ─── Colors / design tokens ───────────────────────────────────────────────────
const C = {
  indigo: '#5b4fe8',
  indigoMid: '#7b6ff0',
  indigoLight: '#eeeafd',
  green: '#34c877',
  greenLight: '#e7faf0',
  amber: '#f5a623',
  amberLight: '#fff7e6',
  rose: '#e84f6b',
  roseLight: '#fdeef1',
  surface: '#ffffff',
  surface2: '#f7f7fb',
  border: '#ebebf5',
  ink: '#18181b',
  ink2: '#3f3f46',
  ink3: '#71717a',
  ink4: '#a1a1aa',
  paper: '#f4f4fb',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return (name || 'ME')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

const DAYS_VI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ name, initials, now }: { name: string; initials: string; now: Date }) {
  const dayLabel = `${DAYS_VI[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  return (
    <View style={s.header}>
      {/* decorative orbs */}
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <View style={s.headerTop}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={s.greetingName}>Xin chào, {name.split(' ').slice(-1)[0]}!</Text>
          <Text style={s.greetingSub}>{dayLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={s.themeBtn}>
            <Text style={{ color: '#fff', fontSize: 16 }}>☀️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function CheckinCard({
  now,
  today,
  todayShift,
}: {
  now: Date;
  today: typeof MOCK_TODAY;
  todayShift: typeof MOCK_TODAY_SHIFT | null;
}) {
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateLabel = `${DAYS_VI[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}`;
  const isIn = today.status === 'in';

  return (
    <View style={s.checkinCard}>
      {/* top row: clock + status */}
      <View style={s.checkinTop}>
        <View>
          <Text style={s.ciLabel}>Giờ hiện tại</Text>
          <Text style={s.ciClock}>{clock}</Text>
          <Text style={s.ciDate}>{dateLabel}</Text>
        </View>
        <View style={[s.statusChip, isIn ? s.statusIn : s.statusIdle]}>
          <View style={[s.statusDot, isIn ? s.statusDotIn : s.statusDotIdle]} />
          <Text style={[s.statusText, { color: isIn ? '#1a9e5a' : C.indigo }]}>
            {isIn ? 'Đang làm việc' : 'Chưa vào ca'}
          </Text>
        </View>
      </View>

      {/* time blocks */}
      <View style={s.timesRow}>
        <TimeBlock label="Vào ca" value={today.checkin} color={C.green} sub="Đúng giờ ✓" />
        <TimeBlock label="Ra ca" value={today.checkout} color={C.ink3} sub="Chưa kết thúc" />
        <TimeBlock label="Đã làm" value={today.worked} color={C.indigo} sub="Hôm nay" />
      </View>

      {/* action buttons */}
      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btnPrimary, { flex: 1 }]} activeOpacity={0.85}>
          <Text style={{ fontSize: 18, marginRight: 6 }}>{isIn ? '⏹' : '📷'}</Text>
          <Text style={s.btnPrimaryText}>{isIn ? 'Ra ca' : 'Vào ca'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} activeOpacity={0.85}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>📅</Text>
          <Text style={s.btnSecondaryText}>Lịch của tôi</Text>
        </TouchableOpacity>
      </View>

      {todayShift && (
        <Text style={s.shiftHint}>
          Hôm nay:{' '}
          <Text style={{ fontFamily: 'monospace', fontWeight: '900' }}>
            {todayShift.start}–{todayShift.end}
          </Text>{' '}
          • {todayShift.name}
        </Text>
      )}
    </View>
  );
}

function TimeBlock({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <View style={s.timeBlock}>
      <Text style={s.timeBlockLabel}>{label}</Text>
      <Text style={[s.timeBlockVal, { color }]}>{value}</Text>
      <Text style={s.timeBlockSub}>{sub}</Text>
    </View>
  );
}

function SectionHead({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {linkLabel && (
        <TouchableOpacity onPress={onLink}>
          <Text style={s.sectionLink}>{linkLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatsRow({ stats }: { stats: typeof MOCK_MONTH_STATS }) {
  return (
    <View style={s.statsRow}>
      <StatPill emoji="📅" value={String(stats.days)} label="Ngày công" color={C.indigo} />
      <StatPill emoji="⏰" value={String(stats.late)} label="Muộn" color={C.amber} />
      <StatPill emoji="🏖" value={String(stats.leaveRemaining)} label="Phép còn" color={C.green} />
    </View>
  );
}

function StatPill({
  emoji,
  value,
  label,
  color,
}: {
  emoji: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={s.statPill}>
      <Text style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</Text>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StreakCard({ streak }: { streak: typeof MOCK_STREAK }) {
  const dotStyle = (state: string) => {
    switch (state) {
      case 'done':
        return [s.streakDot, { backgroundColor: C.green }];
      case 'late':
        return [s.streakDot, { backgroundColor: C.amber }];
      case 'today':
        return [
          s.streakDot,
          { backgroundColor: C.indigo, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
        ];
      default:
        return [s.streakDot, { backgroundColor: 'rgba(255,255,255,0.1)' }];
    }
  };
  const dotChar = (state: string) => (state === 'done' ? '✓' : state === 'today' ? '•' : '–');

  return (
    <View style={s.streakCard}>
      {/* fire emoji watermark */}
      <Text style={s.streakFireBg}>🔥</Text>
      <View style={s.streakTop}>
        <View>
          <Text style={s.streakLabel}>{streak.title}</Text>
          <Text style={s.streakCount}>{streak.countLabel}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Tuần này</Text>
          <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', marginTop: 2 }}>
            {streak.weekSummary}
          </Text>
        </View>
      </View>

      <View style={s.streakDaysRow}>
        {streak.days.map((d, i) => (
          <View key={i} style={s.streakDayItem}>
            <Text style={s.streakDayLabel}>{d.label}</Text>
            <View style={dotStyle(d.state) as any}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {dotChar(d.state)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickActions() {
  const actions = [
    { emoji: '🏖', label: 'Xin nghỉ phép', bg: '#FDE8ED' },
    { emoji: '⏰', label: 'Đăng ký tăng ca', bg: C.amberLight },
    { emoji: '💵', label: 'Xem lương', bg: C.greenLight },
    { emoji: '📷', label: 'Chấm công nhanh', bg: C.indigoLight },
  ];
  return (
    <View style={s.actionsGrid}>
      {actions.map((a) => (
        <TouchableOpacity key={a.label} style={s.actionBtn} activeOpacity={0.8}>
          <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
            <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
          </View>
          <Text style={s.actionLabel}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function LeaveRow({ balance }: { balance: typeof MOCK_LEAVE_BALANCE }) {
  return (
    <View style={s.leaveRow}>
      <LeavePill
        emoji="📅"
        value={balance.annual.remaining}
        label="Phép năm còn lại"
        color={C.indigo}
        percent={balance.annual.percent}
      />
      <LeavePill
        emoji="💊"
        value={balance.sick.remaining}
        label="Phép ốm còn lại"
        color={C.rose}
        percent={balance.sick.percent}
      />
    </View>
  );
}

function LeavePill({
  emoji,
  value,
  label,
  color,
  percent,
}: {
  emoji: string;
  value: number;
  label: string;
  color: string;
  percent: number;
}) {
  return (
    <View style={s.leavePill}>
      <Text style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</Text>
      <Text style={[s.leaveVal, { color }]}>{value}</Text>
      <Text style={s.leaveLabel}>{label}</Text>
      <View style={s.leaveBarBg}>
        <View style={[s.leaveFill, { width: `${percent}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function RecentLogs({ logs }: { logs: typeof MOCK_RECENT_LOGS }) {
  return (
    <>
      {logs.map((l) => {
        const isLate = l.status === 'late';
        return (
          <View key={l.id} style={s.logItem}>
            <View style={[s.logDateBox, { backgroundColor: isLate ? C.amberLight : C.greenLight }]}>
              <Text style={[s.logDay, { color: isLate ? C.amber : C.green }]}>{l.day}</Text>
              <Text style={s.logDow}>{l.dow}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.logTitle}>
                {isLate ? 'Đi trễ' : 'Có mặt'} • {l.hours}h
              </Text>
              <Text style={s.logSub}>
                Vào {l.checkin} · Ra {l.checkout}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

// ─── No-company screen ────────────────────────────────────────────────────────
function NoCompanyScreen({ name, initials }: { name: string; initials: string }) {
  const [joinCode, setJoinCode] = useState('');
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar barStyle="light-content" />
      {/* header (no orbs for this screen) */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.greetingName}>Xin chào, {name.split(' ').slice(-1)[0]}!</Text>
            <Text style={s.greetingSub}>Bạn chưa tham gia công ty nào</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={s.themeBtn}>
              <Text style={{ color: '#fff', fontSize: 16 }}>☀️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, marginTop: -40 }}>
        {error && (
          <View style={[s.alertBox, { backgroundColor: C.roseLight, borderColor: C.rose }]}>
            <Text style={{ color: C.rose, fontSize: 13, fontWeight: '800' }}>{error}</Text>
          </View>
        )}

        {/* Invitation card (mock) */}
        {MOCK_INVITATIONS.length > 0 && (
          <View style={s.memberCard}>
            <View style={s.memberCardHead}>
              <Text style={{ fontSize: 20, color: C.indigo }}>👥</Text>
              <View>
                <Text style={s.memberTitle}>Lời mời tham gia</Text>
                <Text style={s.memberSub}>
                  Bạn có {MOCK_INVITATIONS.length} lời mời đang chờ phản hồi
                </Text>
              </View>
            </View>
            {MOCK_INVITATIONS.map((inv) => (
              <View key={inv.id} style={s.memberItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberCompany}>{inv.company?.name}</Text>
                  <Text style={s.memberCode}>{inv.company?.code}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.btnPrimary}>
                    <Text style={s.btnPrimaryText}>Chấp nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnGhost}>
                    <Text style={s.btnGhostText}>Từ chối</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Join by code card */}
        <View style={s.memberCard}>
          <View style={s.memberCardHead}>
            <Text style={{ fontSize: 20, color: C.indigo }}>👥</Text>
            <View>
              <Text style={s.memberTitle}>Tham gia công ty</Text>
              <Text style={s.memberSub}>Nhập mã công ty để gửi yêu cầu cho quản lý duyệt</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[s.joinInput, { flex: 1 }]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="Mã công ty"
              placeholderTextColor={C.ink4}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[s.btnPrimary, { opacity: loading || !joinCode.trim() ? 0.65 : 1 }]}
              disabled={loading || !joinCode.trim()}
            >
              <Text style={s.btnPrimaryText}>{loading ? 'Đang gửi...' : 'Tham gia'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.alertBox, { backgroundColor: C.indigoLight, borderColor: C.indigo }]}>
          <Text style={{ color: C.indigo, fontSize: 13, fontWeight: '800' }}>
            Cập nhật email trong hồ sơ để nhận lời mời từ quản lý.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmployeeHomePage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const me = MOCK_ME;
  const initials = getInitials(me.name);

  if (!MOCK_HAS_COMPANY) {
    return <NoCompanyScreen name={me.name} initials={initials} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.indigo} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Header name={me.name} initials={initials} now={now} />

        {/* ── Check-in card (overlaps header) ── */}
        <View style={{ marginHorizontal: 20, marginTop: -52, zIndex: 10 }}>
          <CheckinCard now={now} today={MOCK_TODAY} todayShift={MOCK_TODAY_SHIFT} />
        </View>

        {/* ── Scroll content ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/* Month stats */}
          <SectionHead title="Tháng này" linkLabel="Xem chi tiết" />
          <StatsRow stats={MOCK_MONTH_STATS} />

          {/* Streak card */}
          <StreakCard streak={MOCK_STREAK} />

          {/* Quick actions */}
          <SectionHead title="Thao tác nhanh" />
          <QuickActions />

          {/* Leave balance */}
          <SectionHead title="Ngày phép" linkLabel="Xin nghỉ" />
          <LeaveRow balance={MOCK_LEAVE_BALANCE} />

          {/* Recent logs */}
          <SectionHead title="Gần đây" linkLabel="Tất cả" />
          <RecentLogs logs={MOCK_RECENT_LOGS} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const s = StyleSheet.create({
  // Header
  header: {
    backgroundColor: C.indigo,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 80,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orb1: { width: 180, height: 180, top: -50, right: -30 },
  orb2: { width: 100, height: 100, bottom: 0, left: 20 },
  greetingName: {
    fontSize: Math.min(22, width * 0.052),
    fontWeight: '900',
    color: '#fff',
    lineHeight: 26,
  },
  greetingSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  themeBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },

  // Check-in card
  checkinCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.indigo,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  checkinTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ciLabel: { fontSize: 13, color: C.ink3, fontWeight: '600' },
  ciClock: { fontSize: 36, fontWeight: '900', color: C.ink, letterSpacing: -1 },
  ciDate: { fontSize: 13, color: C.ink3, marginTop: 2 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusIn: { backgroundColor: C.greenLight },
  statusIdle: { backgroundColor: C.indigoLight },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotIn: { backgroundColor: C.green },
  statusDotIdle: { backgroundColor: C.indigo },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Time blocks
  timesRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  timeBlock: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  timeBlockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBlockVal: { fontSize: 19, fontWeight: '800', marginTop: 4 },
  timeBlockSub: { fontSize: 10, color: C.ink4, marginTop: 2, textAlign: 'center' },

  // Action buttons in check-in card
  btnRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: C.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  btnSecondaryText: { color: C.ink, fontWeight: '800', fontSize: 15 },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 38,
  },
  btnGhostText: { color: C.ink, fontWeight: '900', fontSize: 13 },
  shiftHint: { marginTop: 10, fontSize: 12, fontWeight: '700', color: C.ink3 },

  // Section head
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  sectionLink: { fontSize: 13, color: C.indigo, fontWeight: '700' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statVal: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  statLabel: { fontSize: 11, color: C.ink3, marginTop: 4, fontWeight: '600', textAlign: 'center' },

  // Streak card
  streakCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  streakFireBg: {
    position: 'absolute',
    right: 20,
    top: '50%',
    fontSize: 56,
    opacity: 0.15,
  },
  streakTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  streakCount: { fontSize: 28, fontWeight: '900', color: '#fff' },
  streakDaysRow: { flexDirection: 'row', gap: 8 },
  streakDayItem: { flex: 1, alignItems: 'center', gap: 6 },
  streakDayLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  streakDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    width: (width - 60) / 4,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.ink2,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Leave row
  leaveRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  leavePill: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  leaveVal: { fontSize: 26, fontWeight: '900' },
  leaveLabel: { fontSize: 12, color: C.ink3, fontWeight: '600', marginTop: 2 },
  leaveBarBg: {
    height: 5,
    backgroundColor: C.surface2,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  leaveFill: { height: '100%', borderRadius: 10 },

  // Recent logs
  logItem: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logDateBox: {
    width: 44,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDay: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  logDow: { fontSize: 10, fontWeight: '700', color: C.ink3 },
  logTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  logSub: { fontSize: 12, color: C.ink3, marginTop: 3 },

  // No-company / membership screen
  memberCard: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  memberCardHead: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  memberTitle: { color: C.ink, fontSize: 16, fontWeight: '900' },
  memberSub: { color: C.ink3, fontSize: 12, fontWeight: '700', marginTop: 2 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.surface2,
  },
  memberCompany: { color: C.ink, fontSize: 14, fontWeight: '900' },
  memberCode: { color: C.ink3, fontSize: 12, fontWeight: '800', marginTop: 2 },
  joinInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface2,
    color: C.ink,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '900',
  },
  alertBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
});
