
export enum VoiceAccent {
  DOCTOR_NORTH = 'DOCTOR_NORTH',
  DOCTOR_SOUTH = 'DOCTOR_SOUTH',
  DOCTOR_CALM = 'DOCTOR_CALM',
  DOCTOR_CARING = 'DOCTOR_CARING',
  CUSTOM = 'CUSTOM'
}

export enum Specialty {
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  RESPIRATORY = 'RESPIRATORY',
  CUSTOM = 'CUSTOM'
}

export interface MedicalHistoryItem {
  id: string;
  date: string;
  inputType: 'text' | 'voice' | 'multimodal' | 'hospital_visit';
  summary: string;
  doctorAdvice: string;
  result?: AudioResult;
}

export interface PatientProfile {
  id: string;
  name: string;
  birthYear: number;
  gender: string;
  history: string;
  specialty: Specialty;
  customSpecialtyName?: string;
}

export interface MedicalFile {
  id: string;
  data: string;
  mimeType: string;
  previewUrl: string;
  name: string;
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'extracting_profile' | 'generating_voice' | 'listening' | 'recording_hospital' | 'video_calling' | 'success' | 'error';
  message: string;
}

export interface AudioResult {
  url: string;
  blob: Blob;
  text: string;
}

export interface TabState {
  inputText: string;
  followUpText: string;
  medicalFiles: MedicalFile[];
  processing: ProcessingState;
  result: AudioResult | null;
  history: MedicalHistoryItem[];
  patientProfile: PatientProfile;
}
