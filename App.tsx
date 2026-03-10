
import React, { useState, useRef, useEffect } from 'react';
import { 
  Stethoscope, Activity, HeartPulse, Loader2, X, Apple, Volume2,
  FileText, Plus, SendHorizontal, Mic, MicOff, UserCircle2, Wind,
  Video, Music, History, Calendar, CheckCircle2, Settings, UserPlus,
  PhoneOff, Radio, Building2, Trash2, ChevronDown, Camera, FileUp, Sparkles, Eraser,
  MapPin, BrainCircuit, Save, AlertCircle, MessageCircleQuestion, CornerRightDown, Utensils,
  Download, Share2, PhoneCall, ClipboardPaste
} from 'lucide-react';
import mammoth from 'mammoth';
import { PATIENTS, SPECIALISTS, CUSTOM_DEPARTMENTS } from './constants';
import { Specialty, PatientProfile, MedicalHistoryItem, MedicalFile, ProcessingState, AudioResult, TabState, VoiceAccent } from './types';
import { analyzeMedicalInputs, generateDoctorSpeech, extractPatientProfile } from './services/geminiService';
import { encode, decode, decodeAudioData } from './utils/audioUtils';

const App: React.FC = () => {
  const [currentSpecialty, setCurrentSpecialty] = useState<Specialty>(Specialty.CARDIOVASCULAR);
  const [isRecording, setIsRecording] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [tabData, setTabData] = useState<Record<Specialty, TabState>>({
    [Specialty.CARDIOVASCULAR]: {
      inputText: '', followUpText: '', medicalFiles: [], result: null, history: [], 
      processing: { status: 'idle', message: '' },
      patientProfile: PATIENTS[Specialty.CARDIOVASCULAR]
    },
    [Specialty.RESPIRATORY]: {
      inputText: '', followUpText: '', medicalFiles: [], result: null, history: [], 
      processing: { status: 'idle', message: '' },
      patientProfile: PATIENTS[Specialty.RESPIRATORY]
    },
    [Specialty.CUSTOM]: {
      inputText: '', followUpText: '', medicalFiles: [], result: null, history: [], 
      processing: { status: 'idle', message: '' },
      patientProfile: PATIENTS[Specialty.CUSTOM]
    }
  });

  const activeTab = tabData[currentSpecialty];
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const updateActiveTabData = (updatesOrFn: Partial<TabState> | ((prev: TabState) => Partial<TabState>)) => {
    setTabData(prev => {
      const currentTab = prev[currentSpecialty];
      const updates = typeof updatesOrFn === 'function' ? updatesOrFn(currentTab) : updatesOrFn;
      return {
        ...prev,
        [currentSpecialty]: { ...currentTab, ...updates }
      };
    });
  };

  const updatePatientProfile = (updates: Partial<PatientProfile>) => {
    updateActiveTabData(prev => ({
      patientProfile: { ...prev.patientProfile, ...updates }
    }));
  };

  const handleExtractProfile = async (files: MedicalFile[]) => {
    if (files.length === 0) return;
    updateActiveTabData({ processing: { status: 'extracting_profile', message: 'Đang trích xuất thông tin bệnh án...' } });
    try {
      const profile = await extractPatientProfile(files);
      if (profile) {
        updatePatientProfile(profile);
      }
      updateActiveTabData({ processing: { status: 'idle', message: '' } });
    } catch (err) {
      console.error("Profile extraction failed", err);
      updateActiveTabData({ processing: { status: 'idle', message: '' } });
    }
  };

  const handleSend = async (isFollowUp: boolean = false, customText?: string) => {
    const currentTab = activeTabRef.current;
    const queryText = customText || (isFollowUp ? currentTab.followUpText : currentTab.inputText);
    if (!queryText && currentTab.medicalFiles.length === 0) return;
    
    updateActiveTabData({ processing: { status: 'analyzing', message: 'Hội đồng bác sỹ đang hội chẩn...' } });
    try {
      const advice = await analyzeMedicalInputs(
        queryText, 
        isFollowUp ? [] : currentTab.medicalFiles, 
        currentSpecialty, 
        currentTab.patientProfile, 
        currentTab.history
      );
      
      updateActiveTabData({ processing: { status: 'generating_voice', message: 'Bác sỹ đang chuẩn bị lời dặn...' } });
      const speech = await generateDoctorSpeech(advice);
      
      let inputType: MedicalHistoryItem['inputType'] = 'multimodal';
      if (isFollowUp) {
        inputType = 'text';
      } else if (currentTab.medicalFiles.length > 0 && !queryText) {
        const allAudio = currentTab.medicalFiles.every(f => f.mimeType.includes('audio'));
        if (allAudio) inputType = 'voice';
      } else if (currentTab.medicalFiles.length === 0 && queryText) {
        inputType = 'text';
      }

      const newItem: MedicalHistoryItem = { 
        id: Date.now().toString(), 
        date: new Date().toLocaleString('vi-VN'), 
        inputType, 
        summary: queryText.slice(0, 50) || "Gửi tệp tin y khoa", 
        doctorAdvice: advice,
        result: { url: speech.url, blob: speech.blob, text: advice }
      };
      
      updateActiveTabData(prev => ({ 
        result: newItem.result,
        history: [newItem, ...prev.history].slice(0, 20),
        followUpText: '', 
        inputText: '',
        processing: { status: 'idle', message: '' }
      }));
    } catch (err) {
      updateActiveTabData({ processing: { status: 'error', message: 'Lỗi kết nối bác sỹ.' } });
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          updateActiveTabData({ processing: { status: 'analyzing', message: 'Đang chuyển đổi giọng nói...' } });
          
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const audioFile: MedicalFile = {
              id: Date.now().toString(),
              data: base64Data,
              mimeType: 'audio/webm',
              name: `Ghi_am_${new Date().toLocaleTimeString()}.webm`,
              previewUrl: ''
            };
            updateActiveTabData(prev => ({ 
              medicalFiles: [...prev.medicalFiles, audioFile],
              processing: { status: 'idle', message: '' }
            }));
          };
          reader.readAsDataURL(audioBlob);
        };
        
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        alert("Không thể truy cập microphone.");
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const startVideoCall = async () => {
    setShowVideoCall(true);
    updateActiveTabData({ processing: { status: 'video_calling', message: 'Đang kết nối video call...' } });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Không thể truy cập camera/microphone.");
      setShowVideoCall(false);
    }
  };

  const stopVideoCall = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setShowVideoCall(false);
    updateActiveTabData({ processing: { status: 'idle', message: '' } });
  };

  const handleDownloadResult = () => {
    if (!activeTab.result) return;
    
    // Download Text
    const textBlob = new Blob([activeTab.result.text], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `Loi_dan_bac_sy_${Date.now()}.txt`;
    textLink.click();

    // Download Audio
    const audioLink = document.createElement('a');
    audioLink.href = activeTab.result.url;
    audioLink.download = `Loi_dan_bac_sy_${Date.now()}.wav`;
    audioLink.click();
  };

  const handleShare = async () => {
    if (!activeTab.result) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Lời dặn Bác sỹ AI',
          text: activeTab.result.text,
          url: window.location.href
        });
      } else {
        alert("Tính năng chia sẻ không khả dụng trên trình duyệt này.");
      }
    } catch (err) {
      console.log('Share cancelled');
    }
  };

  const handlePasteText = () => {
    if (!pastedText.trim()) return;
    
    const newFile: MedicalFile = {
      id: Math.random().toString(),
      data: btoa(unescape(encodeURIComponent(pastedText))),
      mimeType: 'text/plain',
      name: `Văn bản dán_${new Date().toLocaleTimeString()}.txt`,
      previewUrl: ''
    };
    
    updateActiveTabData({ medicalFiles: [...activeTab.medicalFiles, newFile] });
    setPastedText('');
    setShowPasteModal(false);
  };

  return (
    <div className="min-h-screen bg-[#f0f7ff] text-slate-900 p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-3xl shadow-2xl shadow-blue-200">
            <Stethoscope className="text-white w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Bác Sỹ & Dinh Dưỡng AI</h1>
            <p className="text-blue-600 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Hội đồng y khoa chuyên sâu
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3 bg-white/60 backdrop-blur-md p-2 rounded-3xl border border-white/50 shadow-xl">
          {(Object.values(Specialty) as Specialty[]).map(s => (
            <button
              key={s}
              onClick={() => setCurrentSpecialty(s)}
              className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                currentSpecialty === s 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                  : 'text-slate-500 hover:bg-white/80'
              }`}
            >
              {s === Specialty.CARDIOVASCULAR ? 'Tim Mạch' : s === Specialty.RESPIRATORY ? 'Hô Hấp' : 'Tùy Chỉnh'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        {/* Paste Text Modal */}
        {showPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <ClipboardPaste className="w-8 h-8 text-blue-600" />
                  Dán Văn Bản Y Khoa
                </h3>
                <button onClick={() => setShowPasteModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-500 font-medium mb-4">Cụ có thể dán kết quả xét nghiệm hoặc bệnh án dài vào đây để bác sỹ xem giúp.</p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Dán nội dung văn bản tại đây..."
                className="w-full h-64 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all font-medium text-slate-700 resize-none"
              />
              <div className="mt-8 flex gap-4">
                <button onClick={() => setShowPasteModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">
                  HỦY
                </button>
                <button 
                  onClick={handlePasteText}
                  disabled={!pastedText.trim()}
                  className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  XÁC NHẬN DÁN
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Video Call Modal Simulation */}
        {showVideoCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl relative aspect-video">
              <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
              <div className="absolute top-6 left-6 flex items-center gap-3 bg-black/40 p-3 rounded-2xl backdrop-blur-md">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white font-bold">LIVE: BS. NGUYỄN VĂN A</span>
              </div>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-6">
                <button onClick={stopVideoCall} className="bg-red-500 p-6 rounded-full text-white shadow-xl hover:bg-red-600 transition-all">
                  <PhoneOff className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 border border-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-800">
                <UserCircle2 className="w-6 h-6 text-blue-600" />
                Hồ Sơ Của Cụ
              </h2>
              <div className="flex gap-2">
                {activeTab.processing.status === 'extracting_profile' && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[10px] font-bold">Đang trích xuất...</span>
                  </div>
                )}
                <button 
                  onClick={() => updatePatientProfile(PATIENTS[currentSpecialty])}
                  className="bg-orange-50 text-orange-600 p-2.5 rounded-2xl hover:bg-orange-100 transition-all"
                  title="Làm mới hồ sơ"
                >
                  <History className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(activeTab.patientProfile, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Ho_so_benh_nhan_${activeTab.patientProfile.name}.json`;
                    link.click();
                  }}
                  className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl hover:bg-blue-100 transition-all"
                  title="Tải hồ sơ"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Năm sinh</label>
                  <input 
                    type="number" 
                    value={activeTab.patientProfile.birthYear} 
                    onChange={e => updatePatientProfile({ birthYear: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Giới tính</label>
                  <select 
                    value={activeTab.patientProfile.gender} 
                    onChange={e => updatePatientProfile({ gender: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 font-bold appearance-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Bệnh nền & Toa cũ</label>
                <textarea 
                  value={activeTab.patientProfile.history} 
                  onChange={e => updatePatientProfile({ history: e.target.value })}
                  className="w-full bg-slate-50 rounded-3xl p-4 text-sm font-medium text-slate-600 border border-slate-100 min-h-[150px] focus:ring-2 focus:ring-blue-500/20 resize-none"
                  placeholder="Nhập tiền sử bệnh lý..."
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={startVideoCall} className="flex-1 bg-green-500 text-white font-bold py-4 rounded-3xl shadow-lg shadow-green-100 flex items-center justify-center gap-2 hover:bg-green-600 transition-all">
                <PhoneCall className="w-5 h-5" />
                GỌI BÁC SỸ
              </button>
            </div>
          </section>

          <section className="bg-white rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 border border-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-800">
                <History className="w-6 h-6 text-blue-600" />
                Lịch Sử
              </h2>
              {activeTab.history.length > 0 && (
                <button 
                  onClick={() => updateActiveTabData({ history: [] })}
                  className="text-red-500 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"
                  title="Xóa lịch sử"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {activeTab.history.length === 0 ? (
                <div className="text-center py-10 opacity-30">Chưa có dữ liệu</div>
              ) : (
                activeTab.history.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => {
                      if (item.result) {
                        updateActiveTabData({ result: item.result });
                      }
                    }}
                    className="w-full text-left p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 hover:scale-[1.02] hover:shadow-md transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-white rounded-xl shadow-sm group-hover:bg-blue-100 transition-colors">
                        {item.inputType === 'text' && <MessageCircleQuestion className="w-4 h-4 text-blue-500" />}
                        {item.inputType === 'voice' && <Mic className="w-4 h-4 text-red-500" />}
                        {item.inputType === 'multimodal' && <Sparkles className="w-4 h-4 text-amber-500" />}
                        {item.inputType === 'hospital_visit' && <Building2 className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">{item.date}</span>
                          <CornerRightDown className="w-3 h-3 text-slate-300 group-hover:text-blue-400 transition-colors" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 line-clamp-1 group-hover:text-slate-900 transition-colors">
                          {item.summary || "Tư vấn phác đồ"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 flex flex-col h-[700px] lg:h-[850px] bg-white rounded-[50px] shadow-2xl shadow-blue-100 border border-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gradient-to-b from-blue-50/30 to-white">
            {activeTab.result ? (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="bg-white p-10 rounded-[45px] shadow-2xl shadow-slate-200 border border-slate-50 relative group">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 p-3 rounded-2xl">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">PHÁC ĐỒ TOÀN DIỆN</h3>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleDownloadResult} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all" title="Tải về">
                        <Download className="w-6 h-6" />
                      </button>
                      <button onClick={handleShare} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all" title="Chia sẻ">
                        <Share2 className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose prose-blue max-w-none text-slate-700 leading-relaxed text-lg font-medium whitespace-pre-wrap">
                    {activeTab.result.text}
                  </div>

                  <div className="mt-10 p-6 bg-blue-50/50 rounded-[35px] border border-blue-100/50 flex flex-col sm:flex-row items-center gap-6">
                    <div className="bg-blue-600 p-4 rounded-full shadow-lg shadow-blue-200">
                      <Volume2 className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 w-full">
                      <p className="text-sm font-bold text-blue-600 mb-2 px-1">Nghe hội đồng bác sỹ dặn dò:</p>
                      <audio controls src={activeTab.result.url} className="w-full h-12" autoPlay />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <div className="bg-blue-100 p-10 rounded-full mb-8">
                  <HeartPulse className="w-20 h-20 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Sẵn sàng chăm sóc cụ</h3>
                <p className="max-w-xs text-center font-medium">Cụ hãy gửi lời khai hoặc ảnh toa thuốc để bác sỹ hội chẩn nhé.</p>
              </div>
            )}
            
            {activeTab.processing.status !== 'idle' && (
              <div className="flex items-center justify-center p-6 bg-white/80 backdrop-blur-md rounded-3xl shadow-lg border border-white animate-pulse">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-3" />
                <span className="font-bold text-blue-600 uppercase tracking-widest text-sm">{activeTab.processing.message}</span>
              </div>
            )}
          </div>

          <div className="p-8 bg-white/80 backdrop-blur-xl border-t border-slate-100">
            {activeTab.medicalFiles.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3 px-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tệp đính kèm ({activeTab.medicalFiles.length})</span>
                    <span className="text-[10px] text-blue-400 font-medium">Cụ có thể tải lên nhiều toa thuốc để bác sỹ xem lịch sử nhé.</span>
                  </div>
                  <button 
                    onClick={() => updateActiveTabData({ medicalFiles: [] })}
                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    XÓA TẤT CẢ
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {activeTab.medicalFiles.map(file => (
                    <div key={file.id} className="relative group min-w-[100px] h-[100px] rounded-[28px] overflow-hidden border-2 border-slate-100 bg-white shadow-sm">
                      {file.previewUrl ? (
                        <img src={file.previewUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <FileText className={`w-8 h-8 ${file.mimeType.includes('audio') ? 'text-purple-400' : 'text-blue-400'}`} />
                          <span className="text-[8px] font-bold text-slate-400 mt-1 line-clamp-1 text-center">{file.name}</span>
                        </div>
                      )}
                      <button onClick={() => updateActiveTabData({ medicalFiles: activeTab.medicalFiles.filter(f => f.id !== file.id) })} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 scale-90 hover:scale-100 transition-all shadow-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 items-end">
              <div className="flex-1 bg-slate-50 rounded-[35px] p-5 shadow-inner focus-within:ring-4 focus-within:ring-blue-100 transition-all border border-slate-100">
                <textarea 
                  value={activeTab.result ? activeTab.followUpText : activeTab.inputText}
                  onChange={e => updateActiveTabData(activeTab.result ? { followUpText: e.target.value } : { inputText: e.target.value })}
                  placeholder={activeTab.result ? "Cụ muốn hỏi thêm gì về thuốc hay món ăn không?" : "Cụ hãy mô tả cảm giác trong người thế nào..."}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none text-slate-700 font-bold placeholder:text-slate-300 placeholder:font-bold"
                  rows={2}
                />
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-3">
                    <label className="p-3 bg-white text-slate-400 rounded-2xl hover:text-blue-600 hover:shadow-lg transition-all cursor-pointer group relative" title="Tải toa thuốc/Hồ sơ y khoa (.jpg, .png, .pdf, .docx, .txt, .rtf)">
                      <div className="flex flex-col items-center">
                        <FileUp className="w-6 h-6" />
                        <span className="text-[8px] font-bold mt-0.5 group-hover:text-blue-600">TOA THUỐC</span>
                      </div>
                      <input type="file" multiple className="hidden" accept=".jpg,.jpeg,.png,.pdf,.docx,.txt,.rtf" onChange={async (e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        const processed = await Promise.all(files.map(async (f: File) => {
                          const isDocx = f.name.endsWith('.docx');
                          const isText = f.name.endsWith('.txt') || f.name.endsWith('.rtf');
                          
                          if (isDocx) {
                            try {
                              const arrayBuffer = await f.arrayBuffer();
                              const result = await mammoth.extractRawText({ arrayBuffer });
                              return {
                                id: Math.random().toString(),
                                data: btoa(unescape(encodeURIComponent(result.value))),
                                mimeType: 'text/plain',
                                name: f.name,
                                previewUrl: ''
                              };
                            } catch (err) {
                              console.error("Error parsing docx:", err);
                            }
                          } else if (isText) {
                            return new Promise<MedicalFile>((res) => {
                              const reader = new FileReader();
                              reader.onload = () => {
                                res({
                                  id: Math.random().toString(),
                                  data: btoa(unescape(encodeURIComponent(reader.result as string))),
                                  mimeType: 'text/plain',
                                  name: f.name,
                                  previewUrl: ''
                                });
                              };
                              reader.readAsText(f);
                            });
                          }

                          // Default for images/pdfs
                          return new Promise<MedicalFile>((res) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                              res({
                                id: Math.random().toString(),
                                data: (reader.result as string).split(',')[1],
                                mimeType: f.type,
                                name: f.name,
                                previewUrl: f.type.startsWith('image/') ? reader.result as string : ''
                              });
                            };
                            reader.readAsDataURL(f);
                          });
                        }));
                        
                        const validFiles = processed.filter(Boolean) as MedicalFile[];
                        updateActiveTabData(prev => ({ medicalFiles: [...prev.medicalFiles, ...validFiles] }));
                        
                        // Auto extract profile if new medical files are added (not audio)
                        const medicalFiles = validFiles.filter(f => !f.mimeType.includes('audio'));
                        if (medicalFiles.length > 0) {
                          handleExtractProfile(medicalFiles);
                        }
                      }} />
                    </label>
                    <button onClick={() => setShowPasteModal(true)} className="p-3 bg-white text-slate-400 rounded-2xl hover:text-blue-600 hover:shadow-lg transition-all" title="Dán văn bản">
                      <div className="flex flex-col items-center">
                        <ClipboardPaste className="w-6 h-6" />
                        <span className="text-[8px] font-bold mt-0.5">DÁN VB</span>
                      </div>
                    </button>
                    <button onClick={toggleRecording} className={`p-3 rounded-2xl transition-all shadow-lg ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 hover:text-red-500'}`}>
                      <div className="flex flex-col items-center">
                        {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        <span className={`text-[8px] font-bold mt-0.5 ${isRecording ? 'text-white' : ''}`}>GHI ÂM</span>
                      </div>
                    </button>
                    <button onClick={() => updateActiveTabData({ medicalFiles: [], inputText: '', followUpText: '', result: null })} className="p-3 bg-white text-slate-400 rounded-2xl hover:text-orange-500 transition-all">
                      <Eraser className="w-6 h-6" />
                    </button>
                  </div>
                  <button 
                    onClick={() => handleSend(!!activeTab.result)}
                    disabled={activeTab.processing.status !== 'idle'}
                    className="bg-blue-600 text-white px-8 py-4 rounded-[28px] font-black flex items-center gap-3 hover:bg-blue-700 active:scale-95 transition-all shadow-2xl shadow-blue-200 disabled:opacity-50 tracking-wider"
                  >
                    GỬI BÁC SỸ
                    <SendHorizontal className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
