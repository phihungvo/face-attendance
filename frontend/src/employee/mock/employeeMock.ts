export const employeeMock = {
  me: { name: "Nguyễn Văn An", code: "NV001", dept: "Kỹ thuật" },
  today: { checkin: "08:04", checkout: "--:--", status: "Đang làm việc", worked: "7h 32p" },
  month: { days: "22", late: "2", leaveRemaining: "12" },
  streak: {
    title: "Chuỗi đi đúng giờ",
    countLabel: "🔥 8 ngày",
    weekSummary: "5 / 5 ✓",
    days: [
      { label: "T2", state: "done" },
      { label: "T3", state: "done" },
      { label: "T4", state: "done" },
      { label: "T5", state: "done" },
      { label: "T6", state: "today" },
      { label: "T7", state: "miss" },
      { label: "CN", state: "miss" }
    ] as const
  },
  leaveBalance: {
    annual: { remaining: 12, percent: 60 },
    sick: { remaining: 8, percent: 80 },
    faceLastUpdated: "01/04/2025"
  },
  history: {
    months: [
      {
        key: "Tháng 5",
        rows: [
          { day: "02/05", dow: "T6", checkin: "08:02", checkout: "17:35", hours: "9h 33p", ot: "0h", status: "on-time" },
          { day: "01/05", dow: "T5", checkin: "07:58", checkout: "18:10", hours: "10h 12p", ot: "0h 40p", status: "on-time" }
        ]
      },
      {
        key: "Tháng 4",
        rows: [
          { day: "30/04", dow: "T4", checkin: "08:22", checkout: "17:30", hours: "9h 08p", ot: "0h", status: "late" },
          { day: "29/04", dow: "T3", checkin: "08:00", checkout: "17:32", hours: "9h 32p", ot: "0h", status: "on-time" },
          { day: "28/04", dow: "T2", checkin: "--", checkout: "--", hours: "--", ot: "--", status: "absent" }
        ]
      }
    ]
  },
  quick: [
    { icon: "📝", title: "Xin nghỉ", sub: "Tạo đơn nhanh" },
    { icon: "🕒", title: "Giờ công", sub: "Xem tháng này" },
    { icon: "🔔", title: "Thông báo", sub: "3 tin mới" }
  ],
  recentLogs: [
    { id: "l1", day: "03", dow: "CN", status: "in", checkin: "08:02", checkout: "17:12", hours: "8.8", ot: "0h" },
    { id: "l2", day: "02", dow: "T7", status: "in", checkin: "08:01", checkout: "17:10", hours: "8.9", ot: "0h" },
    { id: "l3", day: "01", dow: "T6", status: "late", checkin: "08:18", checkout: "17:05", hours: "8.3", ot: "0h" }
  ]
};
