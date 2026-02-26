import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  BarChart3, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Download, 
  Search,
  UserPlus,
  CheckCircle2,
  XCircle,
  FileText,
  LayoutDashboard
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, subMonths } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Sparkles, Loader2 } from 'lucide-react';

import { Class, Student, AttendanceRecord, TestScore, TuitionPayment, AttendanceStatus } from './types';
import { storage } from './utils/storage';
import { generateAIRemark } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'dashboard' | 'classes' | 'students' | 'attendance' | 'tuition' | 'analytics';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [scores, setScores] = useState<TestScore[]>([]);
  const [tuition, setTuition] = useState<TuitionPayment[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAddScoreModalOpen, setIsAddScoreModalOpen] = useState(false);
  const [reportData, setReportData] = useState<{ type: 'receipt' | 'report', student: Student, month: string } | null>(null);
  
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newStudentNames, setNewStudentNames] = useState('');
  const [newStudentTuition, setNewStudentTuition] = useState('1000000');
  const [newStudentSessions, setNewStudentSessions] = useState('8');
  
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  const [scoreTestName, setScoreTestName] = useState('Bài tập về nhà');
  const [scoreDate, setScoreDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSkills, setAiSkills] = useState({ reading: '', paragraph: '', essay: '' });
  const [scoreRemark, setScoreRemark] = useState('');

  // Load data
  useEffect(() => {
    setClasses(storage.getClasses());
    setStudents(storage.getStudents());
    setAttendance(storage.getAttendance());
    setScores(storage.getScores());
    setTuition(storage.getTuition());
  }, []);

  // Save data
  useEffect(() => { storage.setClasses(classes); }, [classes]);
  useEffect(() => { storage.setStudents(students); }, [students]);
  useEffect(() => { storage.setAttendance(attendance); }, [attendance]);
  useEffect(() => { storage.setScores(scores); }, [scores]);
  useEffect(() => { storage.setTuition(tuition); }, [tuition]);

  const activeClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  // --- Handlers ---
  const addClass = (name: string, teacher: string) => {
    const newClass: Class = {
      id: crypto.randomUUID(),
      name,
      teacher,
      createdAt: Date.now(),
    };
    setClasses([...classes, newClass]);
  };

  const deleteClass = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa lớp này? Tất cả dữ liệu học sinh liên quan sẽ bị ảnh hưởng.')) {
      setClasses(classes.filter(c => c.id !== id));
      setStudents(students.filter(s => s.classId !== id));
      if (selectedClassId === id) setSelectedClassId(null);
    }
  };

  const addStudents = (classId: string, namesStr: string, baseTuition: number, sessions: number) => {
    const names = namesStr.split('\n').map(n => n.trim()).filter(n => n !== '');
    const newStudents: Student[] = names.map(name => ({
      id: crypto.randomUUID(),
      classId,
      name,
      baseTuition,
      sessionsPerMonth: sessions,
      createdAt: Date.now(),
    }));
    setStudents([...students, ...newStudents]);
  };

  const deleteStudent = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa học sinh này? Tất cả dữ liệu điểm danh và điểm số liên quan sẽ bị xóa vĩnh viễn.')) {
      setStudents(students.filter(s => s.id !== id));
      setAttendance(attendance.filter(a => a.studentId !== id));
      setScores(scores.filter(s => s.studentId !== id));
    }
  };

  const markAttendance = (studentId: string, date: string, status: AttendanceStatus, remark?: string) => {
    const existing = attendance.find(a => a.studentId === studentId && a.date === date);
    if (existing) {
      setAttendance(attendance.map(a => a.id === existing.id ? { ...a, status, remark } : a));
    } else {
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        studentId,
        classId: students.find(s => s.id === studentId)?.classId || '',
        date,
        status,
        remark,
      };
      setAttendance([...attendance, newRecord]);
    }
  };

  const addScore = (studentId: string, testName: string, score: number, date: string) => {
    const newScore: TestScore = {
      id: crypto.randomUUID(),
      studentId,
      classId: students.find(s => s.id === studentId)?.classId || '',
      testName,
      score,
      date,
    };
    setScores([...scores, newScore]);
  };

  // --- Calculations ---
  const calculateTuitionForMonth = (student: Student, monthStr: string) => {
    const currentMonth = parseISO(monthStr + '-01');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthStr = format(prevMonth, 'yyyy-MM');

    // Count absences in previous month
    const prevMonthAbsences = attendance.filter(a => 
      a.studentId === student.id && 
      a.date.startsWith(prevMonthStr) && 
      a.status === 'absent'
    ).length;

    const pricePerSession = student.baseTuition / student.sessionsPerMonth;
    const deduction = prevMonthAbsences * pricePerSession;
    const finalTuition = Math.max(0, student.baseTuition - deduction);

    return {
      base: student.baseTuition,
      absences: prevMonthAbsences,
      deduction,
      final: finalTuition
    };
  };

  // --- PDF Export ---
  const exportReceipt = async (student: Student, month: string) => {
    setReportData({ type: 'receipt', student, month });
    // Wait for render
    setTimeout(async () => {
      await exportToPDF('hidden-report-content', `PhieuThu_${student.name}_${month}.pdf`);
      setReportData(null);
    }, 500);
  };

  const exportStudentReport = async (student: Student, month: string) => {
    setReportData({ type: 'report', student, month });
    // Wait for render
    setTimeout(async () => {
      await exportToPDF('hidden-report-content', `NhanXet_${student.name}_${month}.pdf`);
      setReportData(null);
    }, 500);
  };

  const exportTestReport = async (classId: string, testName: string) => {
    // We'll use a similar approach for test reports if needed, but for now let's just use the table capture
    const elementId = `test-report-${testName.replace(/\s+/g, '-')}`;
    const element = document.getElementById(elementId);
    if (element) {
      await exportToPDF(elementId, `BaoCao_${testName}.pdf`);
    } else {
      // Fallback to general analytics view capture
      await exportToPDF('analytics-view-content', `BaoCao_${testName}.pdf`);
    }
  };

  const exportToPDF = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error("Không tìm thấy phần tử:", elementId);
      return;
    }
    
    try {
      // Đảm bảo phần tử có kích thước và hiển thị
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794, // Độ rộng chuẩn 210mm tại 96dpi
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            clonedElement.style.display = 'block';
            clonedElement.style.visibility = 'visible';
            clonedElement.style.opacity = '1';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
    } catch (error) {
      console.error("Lỗi xuất PDF:", error);
      alert("Có lỗi xảy ra khi tạo file. Vui lòng thử lại sau vài giây.");
    }
  };

  const addSampleData = () => {
    const classId = crypto.randomUUID();
    const newClass: Class = { id: classId, name: 'Lớp 12 Văn A1', teacher: 'Cô Nguyễn Thị Lan', createdAt: Date.now() };
    const newStudents: Student[] = [
      { id: crypto.randomUUID(), classId, name: 'Nguyễn Văn An', baseTuition: 1200000, sessionsPerMonth: 8, createdAt: Date.now() },
      { id: crypto.randomUUID(), classId, name: 'Trần Thị Bình', baseTuition: 1200000, sessionsPerMonth: 8, createdAt: Date.now() },
      { id: crypto.randomUUID(), classId, name: 'Lê Hoàng Cường', baseTuition: 1500000, sessionsPerMonth: 12, createdAt: Date.now() },
    ];
    
    setClasses([...classes, newClass]);
    setStudents([...students, ...newStudents]);
    
    // Add some attendance for previous month
    const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
    const newAttendance: AttendanceRecord[] = newStudents.map(s => ({
      id: crypto.randomUUID(),
      studentId: s.id,
      classId,
      date: `${prevMonth}-05`,
      status: Math.random() > 0.7 ? 'absent' : 'present',
      remark: 'Học tập tốt, hăng hái phát biểu'
    }));
    setAttendance([...attendance, ...newAttendance]);

    // Add some scores
    const newScores: TestScore[] = newStudents.flatMap(s => [
      { id: crypto.randomUUID(), studentId: s.id, classId, testName: 'Kiểm tra 15p', score: Math.floor(Math.random() * 3) + 7, date: `${prevMonth}-10` },
      { id: crypto.randomUUID(), studentId: s.id, classId, testName: 'Kiểm tra 1 tiết', score: Math.floor(Math.random() * 4) + 6, date: `${prevMonth}-25` }
    ]);
    setScores([...scores, ...newScores]);
    
    alert('Đã thêm dữ liệu mẫu thành công!');
  };

  // --- Views ---
  const SidebarItem = ({ id, icon: Icon, label }: { id: View, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(id)}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
        currentView === id 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{title}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Modals */}
      <Modal 
        isOpen={isAddClassModalOpen} 
        onClose={() => setIsAddClassModalOpen(false)} 
        title="Thêm lớp học mới"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tên lớp</label>
            <input 
              type="text" 
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="VD: Lớp 12 Văn A1"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tên giáo viên</label>
            <input 
              type="text" 
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              placeholder="VD: Cô Nguyễn Thị Lan"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => {
              if (newClassName && newTeacherName) {
                addClass(newClassName, newTeacherName);
                setNewClassName('');
                setNewTeacherName('');
                setIsAddClassModalOpen(false);
              }
            }}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2"
          >
            Tạo lớp học
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isAddStudentModalOpen} 
        onClose={() => setIsAddStudentModalOpen(false)} 
        title="Thêm học sinh mới"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Lớp học</label>
            <select 
              value={selectedClassId || ''} 
              onChange={(e) => setSelectedClassId(e.target.value || null)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            >
              <option value="">Chọn lớp học</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Danh sách tên (mỗi tên một dòng)</label>
            <textarea 
              value={newStudentNames}
              onChange={(e) => setNewStudentNames(e.target.value)}
              placeholder="Nguyễn Văn An&#10;Trần Thị Bình"
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Học phí (VNĐ)</label>
              <input 
                type="number" 
                value={newStudentTuition}
                onChange={(e) => setNewStudentTuition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Số buổi/tháng</label>
              <input 
                type="number" 
                value={newStudentSessions}
                onChange={(e) => setNewStudentSessions(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
          <button 
            onClick={() => {
              if (selectedClassId && newStudentNames) {
                addStudents(selectedClassId, newStudentNames, Number(newStudentTuition), Number(newStudentSessions));
                setNewStudentNames('');
                setIsAddStudentModalOpen(false);
              } else if (!selectedClassId) {
                alert('Vui lòng chọn lớp học');
              }
            }}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2"
          >
            Thêm học sinh
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isAddScoreModalOpen} 
        onClose={() => {
          setIsAddScoreModalOpen(false);
          setAiSkills({ reading: '', paragraph: '', essay: '' });
          setScoreRemark('');
        }} 
        title="Nhập điểm & Nhận xét"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Học sinh</label>
            <p className="font-bold text-emerald-600">{students.find(s => s.id === scoreStudentId)?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tên bài kiểm tra / Nội dung</label>
            <input 
              type="text" 
              value={scoreTestName}
              onChange={(e) => setScoreTestName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Điểm số</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="10"
                value={scoreValue}
                onChange={(e) => setScoreValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Ngày</label>
              <input 
                type="date" 
                value={scoreDate}
                onChange={(e) => setScoreDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                Hỗ trợ nhận xét AI (Ngữ văn)
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <input 
                type="text" 
                placeholder="Kỹ năng Đọc hiểu (ví dụ: Tốt, cần chú ý chi tiết...)"
                value={aiSkills.reading}
                onChange={(e) => setAiSkills({...aiSkills, reading: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input 
                type="text" 
                placeholder="Kỹ năng Viết đoạn (ví dụ: Diễn đạt trôi chảy...)"
                value={aiSkills.paragraph}
                onChange={(e) => setAiSkills({...aiSkills, paragraph: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input 
                type="text" 
                placeholder="Kỹ năng Viết bài (ví dụ: Bố cục rõ ràng...)"
                value={aiSkills.essay}
                onChange={(e) => setAiSkills({...aiSkills, essay: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button 
              onClick={async () => {
                const student = students.find(s => s.id === scoreStudentId);
                if (!student || !scoreValue) {
                  alert("Vui lòng nhập điểm trước khi tạo nhận xét AI.");
                  return;
                }
                setIsGeneratingAI(true);
                const remark = await generateAIRemark(student.name, Number(scoreValue), scoreTestName, aiSkills);
                setScoreRemark(remark);
                setIsGeneratingAI(false);
              }}
              disabled={isGeneratingAI}
              className="w-full bg-amber-50 text-amber-700 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-amber-100 transition-all disabled:opacity-50"
            >
              {isGeneratingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Tạo nhận xét AI
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Nhận xét chi tiết</label>
            <textarea 
              value={scoreRemark}
              onChange={(e) => setScoreRemark(e.target.value)}
              placeholder="Nhận xét về bài làm của học sinh..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-24 resize-none"
            />
          </div>

          <button 
            onClick={() => {
              if (scoreStudentId && scoreValue) {
                addScore(scoreStudentId, scoreTestName, Number(scoreValue), scoreDate);
                // Also update attendance remark if it's for today
                const today = format(new Date(), 'yyyy-MM-dd');
                if (scoreDate === today && scoreRemark) {
                  const currentRecord = attendance.find(a => a.studentId === scoreStudentId && a.date === today);
                  markAttendance(scoreStudentId, today, currentRecord?.status || 'present', scoreRemark);
                }
                setIsAddScoreModalOpen(false);
                setScoreValue('');
                setScoreRemark('');
                setAiSkills({ reading: '', paragraph: '', essay: '' });
              }
            }}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2"
          >
            Lưu kết quả
          </button>
        </div>
      </Modal>

      {/* Hidden Report Content for PDF Generation */}
      <div 
        className="fixed top-0 left-0 pointer-events-none" 
        style={{ zIndex: -100, width: '210mm', background: 'white' }}
      >
        <div id="hidden-report-content" className="report-container">
          {reportData?.type === 'receipt' && (
            <div className="flex flex-col h-full">
              <div className="report-title">Phiếu Thu Học Phí</div>
              <div className="flex justify-between mb-8">
                <div>
                  <p><strong>Học sinh:</strong> {reportData.student.name}</p>
                  <p><strong>Lớp:</strong> {classes.find(c => c.id === reportData.student.classId)?.name}</p>
                </div>
                <div className="text-right">
                  <p><strong>Ngày xuất:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
                  <p><strong>Tháng thu:</strong> {reportData.month}</p>
                </div>
              </div>
              
              <div className="border-t border-b border-black py-6 my-6">
                <h4 className="font-bold mb-4">Chi tiết học phí:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Học phí định mức:</span>
                    <span>{reportData.student.baseTuition.toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số buổi vắng tháng trước:</span>
                    <span>{calculateTuitionForMonth(reportData.student, reportData.month).absences} buổi</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Số tiền giảm trừ:</span>
                    <span>-{calculateTuitionForMonth(reportData.student, reportData.month).deduction.toLocaleString()}đ</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <span className="text-2xl font-bold uppercase">Tổng cộng:</span>
                <span className="text-2xl font-bold text-emerald-700">
                  {calculateTuitionForMonth(reportData.student, reportData.month).final.toLocaleString()}đ
                </span>
              </div>
              
              <div className="mt-20 flex justify-between px-10">
                <div className="text-center">
                  <p className="font-bold">Người nộp tiền</p>
                  <p className="text-sm italic">(Ký và ghi rõ họ tên)</p>
                </div>
                <div className="text-center">
                  <p className="font-bold">Người thu tiền</p>
                  <p className="text-sm italic">(Ký và ghi rõ họ tên)</p>
                </div>
              </div>
            </div>
          )}
          
          {reportData?.type === 'report' && (
            <div className="flex flex-col h-full">
              <div className="report-title">Phiếu Nhận Xét Học Tập</div>
              <div className="flex justify-between mb-8">
                <div>
                  <p><strong>Học sinh:</strong> {reportData.student.name}</p>
                  <p><strong>Lớp:</strong> {classes.find(c => c.id === reportData.student.classId)?.name}</p>
                </div>
                <div className="text-right">
                  <p><strong>Tháng:</strong> {reportData.month}</p>
                  <p><strong>Ngày xuất:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-bold border-b border-black pb-2 mb-4">1. Chuyên cần</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm">Tổng số buổi</p>
                    <p className="text-xl font-bold">{attendance.filter(a => a.studentId === reportData.student.id && a.date.startsWith(reportData.month)).length}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl">
                    <p className="text-sm">Có mặt</p>
                    <p className="text-xl font-bold text-emerald-600">{attendance.filter(a => a.studentId === reportData.student.id && a.date.startsWith(reportData.month) && a.status === 'present').length}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl">
                    <p className="text-sm">Vắng mặt</p>
                    <p className="text-xl font-bold text-red-600">{attendance.filter(a => a.studentId === reportData.student.id && a.date.startsWith(reportData.month) && a.status === 'absent').length}</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-bold border-b border-black pb-2 mb-4">2. Kết quả kiểm tra</h4>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-2 text-left">Ngày</th>
                      <th className="border border-black p-2 text-left">Nội dung</th>
                      <th className="border border-black p-2 text-center">Điểm số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.filter(s => s.studentId === reportData.student.id && s.date.startsWith(reportData.month)).map(s => (
                      <tr key={s.id}>
                        <td className="border border-black p-2">{format(parseISO(s.date), 'dd/MM/yyyy')}</td>
                        <td className="border border-black p-2">{s.testName}</td>
                        <td className="border border-black p-2 text-center font-bold">{s.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="font-bold border-b border-black pb-2 mb-4">3. Nhận xét chi tiết từng buổi</h4>
                <div className="space-y-4">
                  {attendance.filter(a => a.studentId === reportData.student.id && a.date.startsWith(reportData.month) && a.remark).map(a => (
                    <div key={a.id} className="flex gap-4">
                      <span className="font-bold whitespace-nowrap">{format(parseISO(a.date), 'dd/MM')}:</span>
                      <p>{a.remark}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-auto pt-20 text-right">
                <p className="font-bold">Giáo viên phụ trách</p>
                <p className="text-sm italic">(Ký và ghi rõ họ tên)</p>
                <div className="h-24"></div>
                <p className="font-bold">{classes.find(c => c.id === reportData.student.classId)?.teacher}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <BookOpen size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-emerald-900">Văn Lang</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Tổng quan" />
          <SidebarItem id="classes" icon={BookOpen} label="Lớp học" />
          <SidebarItem id="students" icon={Users} label="Học sinh" />
          <SidebarItem id="attendance" icon={Calendar} label="Điểm danh" />
          <SidebarItem id="tuition" icon={CreditCard} label="Học phí" />
          <SidebarItem id="analytics" icon={BarChart3} label="Phân tích" />
        </nav>

        <div className="p-4 bg-slate-50 rounded-2xl">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Người dùng</p>
          <p className="text-sm font-semibold text-slate-700">Giáo viên Ngữ văn</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && (
              <div className="space-y-8">
                <header className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Chào mừng trở lại!</h2>
                    <p className="text-slate-500">Hôm nay là {format(new Date(), 'eeee, dd/MM/yyyy')}</p>
                  </div>
                  <button 
                    onClick={addSampleData}
                    className="text-sm font-bold text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
                  >
                    Thêm dữ liệu mẫu
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-2">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <BookOpen size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Tổng số lớp</p>
                    <p className="text-3xl font-bold">{classes.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Users size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Tổng số học sinh</p>
                    <p className="text-3xl font-bold">{students.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-2">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                      <CreditCard size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Học phí tháng này</p>
                    <p className="text-3xl font-bold">
                      {students.reduce((acc, s) => acc + calculateTuitionForMonth(s, selectedMonth).final, 0).toLocaleString()}đ
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button 
                    onClick={() => setIsAddClassModalOpen(true)}
                    className="p-6 bg-emerald-600 text-white rounded-3xl shadow-lg shadow-emerald-100 flex items-center gap-4 hover:bg-emerald-700 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Plus size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Thêm lớp học</p>
                      <p className="text-emerald-100 text-sm">Tạo lớp mới và bắt đầu quản lý</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setIsAddStudentModalOpen(true)}
                    className="p-6 bg-slate-800 text-white rounded-3xl shadow-lg shadow-slate-100 flex items-center gap-4 hover:bg-slate-900 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <UserPlus size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Thêm học sinh</p>
                      <p className="text-slate-300 text-sm">Thêm học sinh vào lớp hiện có</p>
                    </div>
                  </button>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold mb-6">Lớp học gần đây</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.slice(0, 6).map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedClassId(c.id); setCurrentView('classes'); }}
                        className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg group-hover:text-emerald-600 transition-colors">{c.name}</h4>
                          <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500" />
                        </div>
                        <p className="text-sm text-slate-500">GV: {c.teacher}</p>
                        <p className="text-xs text-slate-400 mt-2">{students.filter(s => s.classId === c.id).length} học sinh</p>
                      </div>
                    ))}
                    {classes.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400">
                        Chưa có lớp học nào. Hãy thêm lớp mới!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'classes' && (
              <div className="space-y-8">
                <header className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Quản lý lớp học</h2>
                    <p className="text-slate-500">Thêm, sửa hoặc xóa các lớp học của bạn</p>
                  </div>
                  <button 
                    onClick={() => setIsAddClassModalOpen(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Plus size={20} />
                    Thêm lớp mới
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classes.map(c => (
                    <div key={c.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                          <BookOpen size={24} />
                        </div>
                        <button onClick={() => deleteClass(c.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{c.name}</h3>
                        <p className="text-slate-500">Giáo viên: {c.teacher}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-400">{students.filter(s => s.classId === c.id).length} học sinh</span>
                        <button 
                          onClick={() => { setSelectedClassId(c.id); setCurrentView('students'); }}
                          className="text-emerald-600 font-bold text-sm hover:underline"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentView === 'students' && (
              <div className="space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Danh sách học sinh</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <select 
                        value={selectedClassId || ''} 
                        onChange={(e) => setSelectedClassId(e.target.value || null)}
                        className="bg-transparent border-none font-medium text-emerald-600 focus:ring-0 p-0 cursor-pointer"
                      >
                        <option value="">Tất cả các lớp</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsAddStudentModalOpen(true)}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                    >
                      <UserPlus size={20} />
                      Thêm học sinh
                    </button>
                  </div>
                </header>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                        <th className="px-8 py-4 font-semibold">Tên học sinh</th>
                        <th className="px-8 py-4 font-semibold">Lớp</th>
                        <th className="px-8 py-4 font-semibold">Học phí cơ bản</th>
                        <th className="px-8 py-4 font-semibold">Số buổi/tháng</th>
                        <th className="px-8 py-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students
                        .filter(s => !selectedClassId || s.classId === selectedClassId)
                        .map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-4 font-bold text-slate-700">{s.name}</td>
                          <td className="px-8 py-4 text-slate-500">{classes.find(c => c.id === s.classId)?.name}</td>
                          <td className="px-8 py-4 text-slate-500">{s.baseTuition.toLocaleString()}đ</td>
                          <td className="px-8 py-4 text-slate-500">{s.sessionsPerMonth} buổi</td>
                          <td className="px-8 py-4 text-right">
                            <button onClick={() => deleteStudent(s.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-slate-400">Chưa có học sinh nào.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentView === 'attendance' && (
              <div className="space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Điểm danh & Nhận xét</h2>
                    <p className="text-slate-500">Theo dõi chuyên cần và đánh giá học tập</p>
                  </div>
                  <div className="flex gap-4">
                    <input 
                      type="date" 
                      value={format(new Date(), 'yyyy-MM-dd')}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                      onChange={(e) => {/* Handle date change for view if needed */}}
                    />
                    <select 
                      value={selectedClassId || ''} 
                      onChange={(e) => setSelectedClassId(e.target.value || null)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Chọn lớp học</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </header>

                {!selectedClassId ? (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400">
                    Vui lòng chọn một lớp học để bắt đầu điểm danh.
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                          <th className="px-8 py-4 font-semibold">Học sinh</th>
                          <th className="px-8 py-4 font-semibold">Trạng thái</th>
                          <th className="px-8 py-4 font-semibold">Nhận xét buổi học</th>
                          <th className="px-8 py-4 font-semibold text-right">Điểm bài tập</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.filter(s => s.classId === selectedClassId).map(s => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          const record = attendance.find(a => a.studentId === s.id && a.date === today);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-4 font-bold text-slate-700">{s.name}</td>
                              <td className="px-8 py-4">
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => markAttendance(s.id, today, 'present')}
                                    className={cn(
                                      "p-2 rounded-lg transition-all",
                                      record?.status === 'present' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                    )}
                                    title="Có mặt"
                                  >
                                    <CheckCircle2 size={20} />
                                  </button>
                                  <button 
                                    onClick={() => markAttendance(s.id, today, 'absent')}
                                    className={cn(
                                      "p-2 rounded-lg transition-all",
                                      record?.status === 'absent' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                    )}
                                    title="Vắng mặt"
                                  >
                                    <XCircle size={20} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <input 
                                  type="text" 
                                  placeholder="Nhập nhận xét..."
                                  value={record?.remark || ''}
                                  onChange={(e) => markAttendance(s.id, today, record?.status || 'none', e.target.value)}
                                  className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                              </td>
                              <td className="px-8 py-4 text-right">
                                <button 
                                  onClick={() => {
                                    setScoreStudentId(s.id);
                                    setScoreDate(today);
                                    setIsAddScoreModalOpen(true);
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-lg transition-colors"
                                >
                                  Nhập điểm/NX
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {currentView === 'tuition' && (
              <div className="space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Quản lý học phí</h2>
                    <p className="text-slate-500">Tính toán tự động dựa trên chuyên cần tháng trước</p>
                  </div>
                  <div className="flex gap-4">
                    <input 
                      type="month" 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <select 
                      value={selectedClassId || ''} 
                      onChange={(e) => setSelectedClassId(e.target.value || null)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Tất cả các lớp</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </header>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden" id="tuition-report">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                        <th className="px-8 py-4 font-semibold">Học sinh</th>
                        <th className="px-8 py-4 font-semibold">Học phí gốc</th>
                        <th className="px-8 py-4 font-semibold">Vắng (tháng trước)</th>
                        <th className="px-8 py-4 font-semibold">Giảm trừ</th>
                        <th className="px-8 py-4 font-semibold">Thực thu</th>
                        <th className="px-8 py-4 font-semibold text-right">Phiếu thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students
                        .filter(s => !selectedClassId || s.classId === selectedClassId)
                        .map(s => {
                          const calc = calculateTuitionForMonth(s, selectedMonth);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-4 font-bold text-slate-700">{s.name}</td>
                              <td className="px-8 py-4 text-slate-500">{calc.base.toLocaleString()}đ</td>
                              <td className="px-8 py-4">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-bold",
                                  calc.absences > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                                )}>
                                  {calc.absences} buổi
                                </span>
                              </td>
                              <td className="px-8 py-4 text-red-500">-{calc.deduction.toLocaleString()}đ</td>
                              <td className="px-8 py-4 font-bold text-emerald-600">{calc.final.toLocaleString()}đ</td>
                              <td className="px-8 py-4 text-right flex justify-end gap-2">
                                <button 
                                  onClick={() => exportReceipt(s, selectedMonth)}
                                  className="text-slate-400 hover:text-emerald-600 transition-colors"
                                  title="Xuất phiếu thu"
                                >
                                  <Download size={18} />
                                </button>
                                <button 
                                  onClick={() => exportStudentReport(s, selectedMonth)}
                                  className="text-slate-400 hover:text-blue-600 transition-colors"
                                  title="Xuất phiếu nhận xét"
                                >
                                  <FileText size={18} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => exportToPDF('tuition-report', `HocPhi_${selectedMonth}.pdf`)}
                    className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg"
                  >
                    <FileText size={20} />
                    Xuất báo cáo PDF
                  </button>
                </div>
              </div>
            )}

            {currentView === 'analytics' && (
              <div className="space-y-8" id="analytics-view-content">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">Phân tích điểm số</h2>
                    <p className="text-slate-500">Biểu đồ tiến độ học tập của học sinh</p>
                  </div>
                  <select 
                    value={selectedClassId || ''} 
                    onChange={(e) => setSelectedClassId(e.target.value || null)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Chọn lớp học</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </header>

                {!selectedClassId ? (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400">
                    Chọn lớp học để xem biểu đồ phân tích.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="text-xl font-bold mb-6">Tiến độ điểm số trung bình lớp</h3>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={
                              // Group scores by test name or date
                              Array.from(new Set(scores.filter(sc => sc.classId === selectedClassId).map(sc => sc.testName)))
                                .map(test => ({
                                  name: test,
                                  avg: scores
                                    .filter(sc => sc.classId === selectedClassId && sc.testName === test)
                                    .reduce((acc, curr, _, arr) => acc + curr.score / arr.length, 0)
                                }))
                            }
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} domain={[0, 10]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="avg" 
                              name="Điểm trung bình" 
                              stroke="#10b981" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 8 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {(Array.from(new Set(scores.filter(sc => sc.classId === selectedClassId).map(sc => sc.testName))) as string[]).map(test => (
                        <div key={test} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100" id={`test-report-${test.replace(/\s+/g, '-')}`}>
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Chi tiết điểm: {test}</h3>
                            <button 
                              onClick={() => exportTestReport(selectedClassId!, test)}
                              className="flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl font-bold transition-all"
                            >
                              <Download size={18} />
                              Xuất báo cáo
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                                  <th className="px-8 py-4 font-semibold">Học sinh</th>
                                  <th className="px-8 py-4 font-semibold">Điểm số</th>
                                  <th className="px-8 py-4 font-semibold">Ngày</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {students.filter(s => s.classId === selectedClassId).map(s => {
                                  const score = scores.find(sc => sc.studentId === s.id && sc.testName === test);
                                  return (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-8 py-4 font-bold text-slate-700">{s.name}</td>
                                      <td className="px-8 py-4">
                                        <span className={cn(
                                          "font-bold text-lg",
                                          score ? (score.score >= 8 ? "text-emerald-600" : score.score >= 5 ? "text-blue-600" : "text-red-600") : "text-slate-300"
                                        )}>
                                          {score ? score.score : '-'}
                                        </span>
                                      </td>
                                      <td className="px-8 py-4 text-slate-500">
                                        {score ? format(parseISO(score.date), 'dd/MM/yyyy') : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
