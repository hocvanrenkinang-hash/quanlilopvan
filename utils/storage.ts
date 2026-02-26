import { Class, Student, AttendanceRecord, TestScore, TuitionPayment } from '../types';

const STORAGE_KEYS = {
  CLASSES: 'vanlang_classes',
  STUDENTS: 'vanlang_students',
  ATTENDANCE: 'vanlang_attendance',
  SCORES: 'vanlang_scores',
  TUITION: 'vanlang_tuition',
};

export const storage = {
  getClasses: (): Class[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]'),
  setClasses: (classes: Class[]) => localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes)),

  getStudents: (): Student[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]'),
  setStudents: (students: Student[]) => localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students)),

  getAttendance: (): AttendanceRecord[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]'),
  setAttendance: (records: AttendanceRecord[]) => localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records)),

  getScores: (): TestScore[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.SCORES) || '[]'),
  setScores: (scores: TestScore[]) => localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(scores)),

  getTuition: (): TuitionPayment[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.TUITION) || '[]'),
  setTuition: (payments: TuitionPayment[]) => localStorage.setItem(STORAGE_KEYS.TUITION, JSON.stringify(payments)),
};
