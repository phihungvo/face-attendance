export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', {
    currency: 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value ?? 0);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return 'Chưa cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

export function formatTime(value?: string | null) {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
