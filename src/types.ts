export interface Class {
  id: string;
  name: string;
  teacher: string;
  createdAt: number;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  baseTuition: number; // Monthly tuition
  sessionsPerMonth: number;
  createdAt: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'none';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: AttendanceStatus;
  remark?: string;
}

export interface TestScore {
  id: string;
  studentId: string;
  classId: string;
  testName: string;
  score: number;
  date: string; // ISO date string
}

export interface TuitionPayment {
  id: string;
  studentId: string;
  month: string; // YYYY-MM
  amountPaid: number;
  absencesDeducted: number; // Number of absences from previous month
  status: 'paid' | 'unpaid';
}
