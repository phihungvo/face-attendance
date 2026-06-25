export type AttendanceType = 'checkin' | 'checkout';

export type UploadStatus = 'success' | 'fail' | 'pending' | 'uploaded' | 'failed' | 'queued';

export type HistoryAttendanceRecord = {
  id: number;
  employee_id: number;
  employee_name: string | null;
  employee_code: string | null;
  type: AttendanceType;
  check_time: string; // ISO datetime
  confidence_score: number;
  image_url: string | null;
  image_size_kb: number | null;
  image_format: string | null;
  upload_status: UploadStatus;
  created_at: string; // ISO datetime
};
