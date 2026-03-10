
import { Specialty, PatientProfile } from './types';

export const PATIENTS: Record<Specialty, PatientProfile> = {
  [Specialty.CARDIOVASCULAR]: {
    id: 'dang_phan',
    name: 'Phan Thị Hòa Đẳng',
    birthYear: 1948,
    gender: 'Nữ',
    history: `
- Bệnh nền: Nhịp chậm xoang (Sinus Bradycardia), Tăng huyết áp, Suy thận mạn giai đoạn 3B (eGFR ~35-40), Nghi bệnh mạch vành, Rối loạn lipid máu, Trào ngược dạ dày (GERD).
- Tiền sử: Từng bị tăng Kali máu.
- Toa thuốc hiện tại (Đơn BV Gia Định):
  1. Pantoprazole 40mg (Sáng trước ăn)
  2. Furosemide 40mg (Sáng 1/2 viên sau ăn)
  3. Losartan 50mg (Sáng 1, Chiều 1)
  4. Nifedipine LA 30mg (Sáng 1, Chiều 2)
  5. Forxiga 10mg (Chiều 1)
  6. Atorvastatin 40mg (Tối 1)
  7. Clopidogrel 75mg (Tối 1)
    `.trim(),
    specialty: Specialty.CARDIOVASCULAR
  },
  [Specialty.RESPIRATORY]: {
    id: 'son_ngo',
    name: 'Ngô Nguyên Sơn',
    birthYear: 1941,
    gender: 'Nam',
    history: 'Hen suyễn, Viêm phế quản tắc nghẽn mãn tính (COPD). Thường xuyên khó thở khi thay đổi thời tiết.',
    specialty: Specialty.RESPIRATORY
  },
  [Specialty.CUSTOM]: {
    id: 'custom_user',
    name: 'Người dùng mới',
    birthYear: 1980,
    gender: 'Nam',
    history: '',
    specialty: Specialty.CUSTOM,
    customSpecialtyName: 'Ngoại Thần Kinh'
  }
};

export const CUSTOM_DEPARTMENTS = [
  'Nội Hô Hấp',
  'Sơ Sinh',
  'Ngoại Thần Kinh',
  'Khoa Nhi',
  'Nội Tiết Thận',
  'Nội Thần Kinh',
  'Nội Tim Mạch',
  'Nội Tiêu Hóa',
  'Ngoại CTCH (Chấn thương chỉnh hình)',
  'Ngoại Gan - Mật - Tụy',
  'Lọc Máu',
  'Sản Thường',
  'Hồi Sức Tim Mạch',
  'Ngoại Tiêu Hóa',
  'Sản Phụ Khoa',
  'Lão Học',
  'Dược',
  'KSNK (Kiểm soát nhiễm khuẩn)',
  'HSTCCĐ (Hồi sức tích cực chống độc)',
  'Sản Bệnh',
  'Dinh Dưỡng'
];

export const SPECIALISTS = {
  [Specialty.CARDIOVASCULAR]: {
    name: 'Bác Sỹ Đầu Ngành Tim Mạch - Huyết Áp',
    hospital: 'Bệnh viện Nhân Dân Gia Định',
  },
  [Specialty.RESPIRATORY]: {
    name: 'Bác Sỹ Cao Cấp Nội Hô Hấp',
    hospital: 'Chuyên khoa Phổi',
  },
  [Specialty.CUSTOM]: {
    name: 'Bác Sỹ Chuyên Khoa Riêng',
    hospital: 'Khu Chữ H - Đa Khoa',
  }
};
