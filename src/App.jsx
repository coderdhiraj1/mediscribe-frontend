import React, { useState, useEffect, useRef } from 'react';
import WaveformVisualizer from './components/WaveformVisualizer';
import HistorySidebar from './components/HistorySidebar';
import './App.css';



const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [backendAudioFile, setBackendAudioFile] = useState(null);

  // Form inputs
  const [patientName, setPatientName] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [language, setLanguage] = useState(''); // Default: empty Stage (Select Language)
  const [initialLanguage, setInitialLanguage] = useState('');
  const [shouldShakeLanguage, setShouldShakeLanguage] = useState(false);
  const [regenerationCount, setRegenerationCount] = useState(0);

  // Audio Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Output states
  const [transcript, setTranscript] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Notification state
  const [toastMessage, setToastMessage] = useState('');
  
  // Welcome & tutorial guide state
  const [isWelcomeState, setIsWelcomeState] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Theme states
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('mediscribe_theme');
    if (saved) return saved;
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return systemPrefersLight ? 'light' : 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemChange = (e) => {
      const saved = localStorage.getItem('mediscribe_theme');
      if (!saved) {
        setTheme(e.matches ? 'light' : 'dark');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('mediscribe_theme', nextTheme);
  };

  // Refs
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load history from backend or local storage on mount
  useEffect(() => {
    const fetchBackendSessions = async () => {
      setIsHistoryLoading(true);
      if (BACKEND_API_URL) {
        try {
          const res = await fetch(`${BACKEND_API_URL}/sessions`);
          if (res.ok) {
            const data = await res.json();
            const resolvedData = (data || []).map(session => {
              if (session.audioFile && !session.audioUrl) {
                return {
                  ...session,
                  audioUrl: `${BACKEND_API_URL.replace('/api', '')}/uploads/${session.audioFile}`
                };
              }
              return session;
            });
            setSessions(resolvedData);
            setIsHistoryLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Backend server is offline or unavailable. Using localStorage caching.');
        }
      }

      // Local storage fallback
      const saved = localStorage.getItem('mediscribe_simple_summaries');
      if (saved) {
        try {
          const parsed = JSON.parse(saved).filter(s => s.id !== 'demo-1');
          setSessions(parsed);
        } catch (e) {
          console.error('Failed to parse saved sessions', e);
        }
      } else {
        setSessions([]);
      }
      setIsHistoryLoading(false);
    };

    fetchBackendSessions();
  }, []);

  const saveSessionsToLocalStorage = (updated) => {
    setSessions(updated);
    localStorage.setItem('mediscribe_simple_summaries', JSON.stringify(updated));
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Recording controls
  const startRecording = async () => {
    try {
      setAudioUrl(null);
      setAudioBlob(null);
      setFileToUpload(null);
      audioChunksRef.current = [];

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      const recorder = new MediaRecorder(mediaStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        showToast('Audio recording completed');
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error', err);
      alert('Microphone access is unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Uploader triggers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        setFileToUpload(file);
        setAudioUrl(URL.createObjectURL(file));
        setAudioBlob(null);
        showToast(`Loaded: ${file.name}`);
      } else {
        alert('Please drop an audio file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileToUpload(file);
      setAudioUrl(URL.createObjectURL(file));
      setAudioBlob(null);
      showToast(`Loaded: ${file.name}`);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const clearAudio = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setFileToUpload(null);
    showToast('Audio cleared');
  };

  // Clinical Process pipeline
  const processConversation = async () => {
    if (!language) {
      setShouldShakeLanguage(true);
      showToast('Spoken language selection is required!');
      setTimeout(() => setShouldShakeLanguage(false), 500);
      return;
    }

    if (!audioBlob && !fileToUpload && !transcript) {
      alert('Please record speech, upload an audio recording, or type consultation notes.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Processing speech-to-text transcription via Groq Whisper v3...');

    if (BACKEND_API_URL) {
      try {
        const sourceFile = fileToUpload || audioBlob;
        let activeTranscript = transcript;
        let uploadedFilename = null;
        let sttData = null;

        if (sourceFile) {
          const formData = new FormData();
          formData.append('audio', sourceFile);
          formData.append('language', language);
          formData.append('patientName', patientName);
          
          const sttRes = await fetch(`${BACKEND_API_URL}/transcribe`, {
            method: 'POST',
            body: formData,
          });
          
          if (!sttRes.ok) {
            const errData = await sttRes.json().catch(() => ({}));
            const transcriptionError = new Error(errData.error || `Transcription failed with status ${sttRes.status}`);
            transcriptionError.isTranscriptionError = true;
            throw transcriptionError;
          }
          
          sttData = await sttRes.json();
          activeTranscript = sttData.transcript;
          setTranscript(sttData.transcript);
          if (sttData.filename) {
            uploadedFilename = sttData.filename;
            setBackendAudioFile(sttData.filename);
            if (sttData.audioUrl) {
              setAudioUrl(sttData.audioUrl);
            } else {
              setAudioUrl(`${BACKEND_API_URL.replace('/api', '')}/uploads/${sttData.filename}`);
            }
          }
        }

        setLoadingMessage('Generating clinical conversation summary via Gemini 1.5...');
        const summaryRes = await fetch(`${BACKEND_API_URL}/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: activeTranscript, patientName }),
        });
        
        if (!summaryRes.ok) {
          const errData = await summaryRes.json().catch(() => ({}));
          const summaryError = new Error(errData.error || `Clinical summary generation failed with status ${summaryRes.status}`);
          summaryError.isSummaryError = true;
          throw summaryError;
        }
        
        const summaryData = await summaryRes.json();
        
        setClinicalSummary(summaryData.summary);
        setIsLoading(false);
        setLoadingMessage('');
        const resolvedAudioUrl = sttData?.audioUrl || (sttData?.filename ? `${BACKEND_API_URL.replace('/api', '')}/uploads/${sttData.filename}` : null);
        saveSessionState(activeTranscript, summaryData.summary, uploadedFilename, resolvedAudioUrl);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        setLoadingMessage('');
        
        const errorMsg = err.message || '';
        if (err.isTranscriptionError) {
          alert(`⚠️ Transcription Error (Groq Whisper):\n\n${errorMsg}`);
        } else if (err.isSummaryError) {
          alert(`⚠️ Summary Generation Error:\n\n${errorMsg}`);
        } else if (errorMsg.includes('Rate Limit') || errorMsg.includes('Quota') || errorMsg.includes('429') || errorMsg.includes('limit')) {
          alert(`⚠️ API Rate Limit Reached (Free Tier Limit):\n\n${errorMsg}\n\nPlease wait a few moments and try again, or upgrade your API key plans to a paid subscription.`);
        } else {
          alert(`⚠️ Connection Error: Failed to communicate with the MediScribe backend. Please verify your backend server is running on http://localhost:5001.\n\nDetails: ${errorMsg}`);
        }
      }
    } else {
      alert('⚠️ Configuration Error: BACKEND_API_URL is not defined.');
    }
  };

  const saveSessionState = async (finalTranscript, finalSummary, customAudioFile = null, customAudioUrl = null) => {
    const sessionPatient = patientName || 'Unnamed Patient';
    const sessionTitleText = sessionTitle || 'Consultation - Review';

    let resolvedLang = 'English';
    if (language === 'hi') resolvedLang = 'Hinglish';
    else if (language === 'ta') resolvedLang = 'Tamil';
    else if (language === 'te') resolvedLang = 'Telugu';
    else if (language === 'bn') resolvedLang = 'Bengali';
    else if (language === 'kn') resolvedLang = 'Kannada';
    else if (language === 'mr') resolvedLang = 'Marathi';
    else if (language === 'ml') resolvedLang = 'Malayalam';
    else if (language === 'auto') {
      const nameLower = sessionPatient.toLowerCase();
      const titleLower = sessionTitleText.toLowerCase();
      if (nameLower.includes('priya') || titleLower.includes('tamil') || titleLower.includes('migraine')) {
        resolvedLang = 'Tamil';
      } else if (nameLower.includes('john') || nameLower.includes('davis') || titleLower.includes('hypertension')) {
        resolvedLang = 'English';
      } else {
        resolvedLang = 'Hinglish';
      }
    }

    const newSession = {
      id: activeSessionId || Date.now().toString(),
      patientName: sessionPatient,
      title: sessionTitleText,
      language: resolvedLang,
      selectedLanguage: language,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      transcript: finalTranscript,
      summary: finalSummary,
      audioUrl: customAudioUrl || audioUrl,
      audioFile: customAudioFile || backendAudioFile || (fileToUpload ? fileToUpload.name : (audioBlob ? 'recorded_mic_input.mp3' : null)),
      regenerationCount: regenerationCount
    };

    if (BACKEND_API_URL) {
      try {
        const response = await fetch(`${BACKEND_API_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newSession)
        });
        if (response.ok) {
          const savedSession = await response.json();
          if (savedSession.audioFile && !savedSession.audioUrl) {
            savedSession.audioUrl = `${BACKEND_API_URL.replace('/api', '')}/uploads/${savedSession.audioFile}`;
          }
          
          let updated;
          if (activeSessionId && sessions.some(s => s.id === activeSessionId)) {
            updated = sessions.map(s => s.id === activeSessionId ? savedSession : s);
          } else {
            updated = [savedSession, ...sessions];
            setActiveSessionId(savedSession.id);
          }
          saveSessionsToLocalStorage(updated);
          setInitialLanguage(savedSession.selectedLanguage || language);
          setRegenerationCount(savedSession.regenerationCount || 0);
          return;
        }
      } catch (e) {
        console.warn('Backend save failed. Saving locally to localStorage.', e);
      }
    }

    let updated;
    if (activeSessionId && sessions.some(s => s.id === activeSessionId)) {
      updated = sessions.map(s => s.id === activeSessionId ? newSession : s);
    } else {
      updated = [newSession, ...sessions];
      setActiveSessionId(newSession.id);
    }
    saveSessionsToLocalStorage(updated);
    setInitialLanguage(newSession.selectedLanguage || language);
    setRegenerationCount(newSession.regenerationCount || 0);
  };

  const loadSession = (session) => {
    setIsWelcomeState(false);
    setActiveSessionId(session.id);
    setPatientName(session.patientName || '');
    setSessionTitle(session.title || '');
    
    let langCode = 'en';
    if (session.selectedLanguage) {
      langCode = session.selectedLanguage;
    } else {
      if (session.language === 'Hinglish') langCode = 'hi';
      else if (session.language === 'Tamil') langCode = 'ta';
      else if (session.language === 'Telugu') langCode = 'te';
      else if (session.language === 'Bengali') langCode = 'bn';
      else if (session.language === 'Kannada') langCode = 'kn';
      else if (session.language === 'Marathi') langCode = 'mr';
      else if (session.language === 'Malayalam') langCode = 'ml';
      else if (session.language === 'English') langCode = 'en';
      else if (session.language === 'auto') langCode = 'auto';
    }
    setLanguage(langCode);
    setInitialLanguage(langCode);
    setRegenerationCount(session.regenerationCount || 0);

    setTranscript(session.transcript || '');
    setClinicalSummary(session.summary || '');
    setBackendAudioFile(session.audioFile || null);
    
    if (session.audioUrl) {
      setAudioUrl(session.audioUrl);
      setFileToUpload(session.audioFile ? { name: session.audioFile } : null);
    } else {
      // General dummy audio fallback for custom saved sessions that don't have active memory blob URLs anymore
      setAudioUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
      setFileToUpload({ name: 'dummy_consultation_recording.mp3' });
    }
    setAudioBlob(null);
  };

  const deleteSession = async (id) => {
    if (BACKEND_API_URL && !id.toString().startsWith('demo-')) {
      try {
        const response = await fetch(`${BACKEND_API_URL}/sessions/${id}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          console.warn('Backend delete failed');
        }
      } catch (e) {
        console.warn('Backend delete network error', e);
      }
    }

    const filtered = sessions.filter(s => s.id !== id);
    saveSessionsToLocalStorage(filtered);
    if (activeSessionId === id) {
      startNewSession();
    }
    showToast('Session deleted');
  };

  const startNewSession = () => {
    setIsWelcomeState(false);
    setActiveSessionId(null);
    setBackendAudioFile(null);
    setPatientName('');
    setSessionTitle('');
    setTranscript('');
    setClinicalSummary('');
    setAudioUrl(null);
    setAudioBlob(null);
    setFileToUpload(null);
    setRecordingTime(0);
    setLanguage('');
    setInitialLanguage('');
    setRegenerationCount(0);
  };

  const regenerateSession = async () => {
    if (!activeSessionId) return;

    if (regenerationCount >= 3) {
      showToast('⚠️ Maximum limit of 3 regenerations reached.');
      return;
    }

    if (!language) {
      setShouldShakeLanguage(true);
      showToast('Spoken language selection is required!');
      setTimeout(() => setShouldShakeLanguage(false), 500);
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Re-transcribing via Whisper & summarizing via Gemini...');

    if (BACKEND_API_URL) {
      try {
        const response = await fetch(`${BACKEND_API_URL}/sessions/${activeSessionId}/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Regeneration failed with status ${response.status}`);
        }

        const updatedSession = await response.json();
        
        // Update local state
        setTranscript(updatedSession.transcript);
        setClinicalSummary(updatedSession.summary);
        setInitialLanguage(language);
        setRegenerationCount(updatedSession.regenerationCount || 0);
        
        // Update sessions list
        const resolvedSession = {
          ...updatedSession,
          audioUrl: updatedSession.audioFile && !updatedSession.audioUrl
            ? `${BACKEND_API_URL.replace('/api', '')}/uploads/${updatedSession.audioFile}`
            : updatedSession.audioUrl
        };

        const updatedSessions = sessions.map(s => s.id === activeSessionId ? resolvedSession : s);
        saveSessionsToLocalStorage(updatedSessions);

        showToast('Transcription and summary regenerated successfully!');
      } catch (err) {
        console.error(err);
        alert(`⚠️ Regeneration Error:\n\n${err.message}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    } else {
      alert('⚠️ Configuration Error: BACKEND_API_URL is not defined.');
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Export options
  const cleanTextForExport = (text) => {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/gm, '');
  };

  const copyToClipboard = () => {
    if (!clinicalSummary) return;
    const textToCopy = `CLINICAL SUMMARY NOTE
Patient: ${patientName || 'Unnamed'}
Title: ${sessionTitle || 'General Consult'}

${cleanTextForExport(clinicalSummary)}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Copied summary to clipboard!');
    });
  };

  const downloadTextFile = () => {
    if (!clinicalSummary) return;
    const text = `CLINICAL SUMMARY NOTE\nPatient: ${patientName || 'Unnamed'}\nTitle: ${sessionTitle || 'General Consult'}\n\n${cleanTextForExport(clinicalSummary)}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clinical_Summary_${patientName.replace(/\s+/g, '_') || 'Patient'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded text file');
  };

  const renderSummaryText = (text) => {
    if (!text) return null;
    
    // Normalize newlines (replace \r\n with \n)
    const normalizedText = text.replace(/\r\n/g, '\n');
    const lines = normalizedText.split('\n');
    
    return lines.map((rawLine, index) => {
      const line = rawLine.trim();
      
      // If line is empty
      if (!line) {
        return <div key={index} style={{ height: '12px' }}></div>;
      }
      
      // 1. Detect Headers: e.g. **CHIEF COMPLAINTS & HISTORY:** or CHIEF COMPLAINTS & HISTORY: or ### Chief Complaints
      let isHeader = false;
      let headerText = line;
      
      // Strip starting ### or ####
      if (headerText.startsWith('###')) {
        isHeader = true;
        headerText = headerText.replace(/^#+\s*/, '');
      }
      
      // Strip surrounding **
      if (headerText.startsWith('**') && headerText.endsWith('**')) {
        isHeader = true;
        headerText = headerText.slice(2, -2);
      }
      
      // If the line is all uppercase and ends with a colon (e.g. "CHIEF COMPLAINTS:")
      const cleanHeaderContent = headerText.replace(/:$/, '').trim();
      if (cleanHeaderContent.toUpperCase() === cleanHeaderContent && cleanHeaderContent.length > 3) {
        isHeader = true;
        headerText = cleanHeaderContent;
      }
      
      // Remove trailing colon for headers to look clean
      headerText = headerText.replace(/:$/, '').trim();
      
      if (isHeader) {
        return (
          <h4 key={index} style={{ 
            fontSize: '15px', 
            fontWeight: '700', 
            color: 'var(--accent-secondary, #2dd4bf)', 
            marginTop: '20px', 
            marginBottom: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {headerText}
          </h4>
        );
      }
      
      // 2. Check if list item (starts with -, *, or bullet)
      const listMatch = rawLine.match(/^(\s*)[-*•]\s*(.*)$/);
      if (listMatch) {
        const indent = listMatch[1].length;
        const content = listMatch[2].trim();
        
        let keyPart = '';
        let valuePart = content;
        
        // Try to match a key-value pattern (either starting with **Key** or Key: at the beginning)
        const kvMatch = content.match(/^(\*\*(.*?)\*\*|([^:]+)):\s*(.*)$/);
        if (kvMatch) {
          const rawKey = kvMatch[2] || kvMatch[3];
          if (rawKey && rawKey.length < 45) {
            keyPart = rawKey.trim();
            valuePart = kvMatch[4].trim();
          }
        }
        
        const formatInlineText = (txt) => {
          if (!txt) return '';
          const boldRegex = /\*\*(.*?)\*\*/g;
          let parts = [];
          let lastIdx = 0;
          let m;
          
          while ((m = boldRegex.exec(txt)) !== null) {
            if (m.index > lastIdx) {
              parts.push(txt.substring(lastIdx, m.index));
            }
            parts.push(<strong key={m.index} style={{ color: 'var(--text-strong, #ffffff)', fontWeight: '600' }}>{m[1]}</strong>);
            lastIdx = boldRegex.lastIndex;
          }
          
          if (lastIdx < txt.length) {
            parts.push(txt.substring(lastIdx));
          }
          
          return parts.length > 0 ? parts : txt;
        };
        
        return (
          <div key={index} style={{ 
            display: 'flex', 
            gap: '8px', 
            paddingLeft: `${12 + indent * 8}px`, 
            marginBottom: '8px',
            lineHeight: '1.6',
            alignItems: 'flex-start'
          }}>
            <span style={{ color: 'var(--accent-primary, #8b5cf6)', fontSize: '12px', marginTop: '3px' }}>•</span>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {keyPart ? (
                <>
                  <strong style={{ color: 'var(--text-strong, #ffffff)', fontWeight: '600' }}>{keyPart}:</strong>{' '}
                  {formatInlineText(valuePart)}
                </>
              ) : (
                formatInlineText(content)
              )}
            </span>
          </div>
        );
      }
      
      // 3. Normal paragraph
      const formatInlineText = (txt) => {
        const boldRegex = /\*\*(.*?)\*\*/g;
        let parts = [];
        let lastIdx = 0;
        let m;
        
        while ((m = boldRegex.exec(txt)) !== null) {
          if (m.index > lastIdx) {
            parts.push(txt.substring(lastIdx, m.index));
          }
          parts.push(<strong key={m.index} style={{ color: 'var(--text-strong, #ffffff)', fontWeight: '600' }}>{m[1]}</strong>);
          lastIdx = boldRegex.lastIndex;
        }
        
        if (lastIdx < txt.length) {
          parts.push(txt.substring(lastIdx));
        }
        
        return parts.length > 0 ? parts : txt;
      };
      
      return (
        <p key={index} style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '6px 0', lineHeight: '1.6' }}>
          {formatInlineText(line)}
        </p>
      );
    });
  };

  return (
    <div className="dashboard-container">
      {/* Background glow animations */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      {/* Notifications */}
      {toastMessage && (
        <div className="toast-notif">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="mobile-header-bar">
        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="mobile-logo-title" onClick={() => {
          setIsWelcomeState(true);
          setActiveSessionId(null);
          setIsSidebarOpen(false);
        }} style={{ cursor: 'pointer' }}>
          <div className="logo-icon" style={{ width: '24px', height: '24px' }}></div>
          <h2 style={{ fontSize: '18px', background: 'linear-gradient(135deg, var(--text-strong) 30%, var(--accent-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '700' }}>MediScribe</h2>
        </div>
        <button 
          className="btn-theme-toggle-mobile" 
          onClick={toggleTheme} 
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '8px'
          }}
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar backdrop overlay */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* History panel */}
      <HistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(session) => {
          loadSession(session);
          setIsSidebarOpen(false);
        }}
        onDeleteSession={deleteSession}
        onNewSession={() => {
          startNewSession();
          setIsSidebarOpen(false);
        }}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogoClick={() => {
          setIsWelcomeState(true);
          setActiveSessionId(null);
          setIsSidebarOpen(false);
        }}
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        isHistoryLoading={isHistoryLoading}
      />

      {/* Primary Dashboard Panel */}
      <main className="main-panel">
        
        <div className="desktop-header-title" style={{ marginBottom: '8px' }}>
          <h1 style={{ fontSize: '26px', background: 'linear-gradient(135deg, var(--text-strong, #ffffff) 40%, var(--accent-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '700' }}>
            MediScribe
          </h1>
          {/* <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Capture patient-junior doctor conversations. Whisper transcribes the speech, and Gemini automatically translates and summarizes the complaints and symptoms in clinical terms.
          </p> */}
        </div>

        {isWelcomeState ? (
          <div className="welcome-screen-wrapper glass-panel animate-fade-in" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, minHeight: '400px', marginTop: '20px' }}>
            <div className="welcome-icon-glow" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '32px', marginBottom: '24px', boxShadow: '0 0 30px var(--accent-primary-glow)' }}>✦</div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '10px' }}>Welcome to MediScribe</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '500px', lineHeight: '1.6', marginBottom: '32px' }}>
              Capture patient-junior doctor conversations. Whisper transcribes the speech, and Gemini automatically translates and summarizes the complaints and symptoms in clinical terms.
            </p>
            <div className="welcome-actions-grid">
              <div 
                className="welcome-card-action glass-panel" 
                onClick={startNewSession}
                style={{ padding: '24px', cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ color: 'var(--accent-secondary)', fontSize: '20px', marginBottom: '8px' }}>🎙️</div>
                <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Start New Scribe</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.4' }}>Record a fresh doctor-patient interview or upload an audio recording.</p>
              </div>
              <div 
                className="welcome-card-action glass-panel"
                style={{ padding: '24px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', opacity: 0.8 }}
              >
                <div style={{ color: 'var(--accent-primary)', fontSize: '20px', marginBottom: '8px' }}>📂</div>
                <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Review History</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.4' }}>Select any existing patient record from the sidebar list on the left to view summaries.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Side-by-side workspace */
          <div className="workspace-grid">
            
            {/* LEFT SIDE: Dialogue Input Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Microphone recorder & file dropper OR Playback panel for existing */}
              <section className="glass-panel panel-body">
                <div className="panel-header">
                  <h3>{activeSessionId ? 'Consultation Recording Playback' : 'Voice Intake Capture'}</h3>
                </div>

                {activeSessionId ? (
                  <div className="existing-audio-block" style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}>
                      <div className="audio-visualizer-wave-icon" style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary-glow), var(--accent-secondary-glow))',
                        border: '1px solid var(--border-glass-active)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-secondary)',
                        fontSize: '24px',
                        boxShadow: '0 0 20px var(--accent-primary-glow)'
                      }}>
                        🎙️
                      </div>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>
                          Session Consultation Audio
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {fileToUpload?.name || `consultation_recording_${activeSessionId.substring(0, 6)}.mp3`}
                        </p>
                      </div>
                      
                      <div className="audio-player-wrapper" style={{ width: '100%', marginTop: '8px' }}>
                        <audio src={audioUrl} controls style={{ width: '100%' }} />
                      </div>
                    </div>
                    
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px dashed var(--border-subtle)',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: '1.5',
                      textAlign: 'center'
                    }}>
                      🔒 This consultation chart details are locked. If the incorrect language was selected, you can change it in the Session Metadata below and click Regenerate Note. For other modifications, please record a fresh session.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="recording-block" style={{ minHeight: '180px' }}>
                      <span className="section-title">Microphone Recording</span>
                      <div className="recording-controls" style={{ marginTop: '8px' }}>
                        {isRecording && <div className="timer-display" style={{ fontSize: '20px' }}>{formatTime(recordingTime)}</div>}
                        
                        <div className="record-btn-wrapper" style={{ width: '60px', height: '60px' }}>
                          {isRecording && <div className="btn-record-pulse" style={{ width: '48px', height: '48px' }}></div>}
                          <button
                            className={`btn-record ${isRecording ? 'recording' : ''}`}
                            onClick={isRecording ? stopRecording : startRecording}
                            style={{ width: '48px', height: '48px' }}
                            title={isRecording ? 'Stop' : 'Record'}
                          >
                            {isRecording ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"></circle></svg>
                            )}
                          </button>
                        </div>
                        
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {isRecording ? 'Recording interview...' : 'Tap Mic to record patient dialogue'}
                        </span>
                      </div>

                      <WaveformVisualizer stream={stream} isRecording={isRecording} />
                    </div>

                    {/* Upload field */}
                    <div
                      className={`file-upload-block ${dragActive ? 'drag-active' : ''}`}
                      style={{ padding: '16px 20px' }}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileInput}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden-file-input"
                        accept="audio/*"
                        onChange={handleFileChange}
                      />
                      <p style={{ fontSize: '13px', fontWeight: '500' }}>Or Drag & Drop / Click to Upload Audio File</p>
                      {fileToUpload && (
                        <div className="file-details" onClick={(e) => e.stopPropagation()} style={{ marginTop: '6px' }}>
                          <span>{fileToUpload.name}</span>
                          <button className="btn-remove-file" onClick={clearAudio}>✕</button>
                        </div>
                      )}
                    </div>

                    {audioUrl && (
                      <div className="audio-player-wrapper">
                        <audio src={audioUrl} controls />
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Meta details */}
              <section className="glass-panel panel-body">
                <div className="panel-header">
                  <h3>Session Metadata</h3>
                </div>

                <div className="setup-row">
                  <div className="input-group">
                    <label htmlFor="patient-name">Patient Name / ID</label>
                    <input
                      id="patient-name"
                      type="text"
                      placeholder="e.g. Sita Devi"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      disabled={activeSessionId !== null}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="select-language" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Primary Spoken Language
                      <span className="tooltip-container">
                        i
                        <span className="tooltip-text">
                          Select the language in which the patient is most comfortable with
                        </span>
                      </span>
                    </label>
                    <select
                      id="select-language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={isLoading}
                      className={shouldShakeLanguage ? 'shake-animation' : ''}
                    >
                      <option value="">Select Language</option>
                      <option value="auto">✨ Auto-Detect Spoken Language</option>
                      <option value="hi">Hinglish / Hindi (हिन्दी)</option>
                      <option value="en">English (US/UK)</option>
                      <option value="ta">Tamil / Singlish (தமிழ்)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                      <option value="bn">Bengali (বাংলা)</option>
                      <option value="kn">Kannada (ಕನ್ನಡ)</option>
                      <option value="mr">Marathi (मराठी)</option>
                      <option value="ml">Malayalam (മലയാളം)</option>
                    </select>
                    {shouldShakeLanguage && (
                      <span style={{ color: 'var(--accent-red, #ef4444)', fontSize: '11px', marginTop: '2px' }}>
                        ⚠️ Language selection is required.
                      </span>
                    )}
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="session-title">Consultation Title</label>
                  <input
                    id="session-title"
                    type="text"
                    placeholder="e.g. Fever & Cough Consultation"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    disabled={activeSessionId !== null}
                  />
                </div>

                {activeSessionId ? (
                  <>
                    {regenerationCount >= 3 ? (
                      <div style={{
                        fontSize: '12.5px',
                        color: 'var(--accent-red, #ef4444)',
                        background: 'rgba(239, 68, 68, 0.03)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        textAlign: 'center',
                        width: '100%',
                        lineHeight: '1.4',
                        marginTop: '16px'
                      }}>
                        ⚠️ Maximum limit of 3 regenerations reached for this session.
                      </div>
                    ) : language === initialLanguage ? (
                      <div style={{
                        fontSize: '12.5px',
                        color: 'var(--text-secondary)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        textAlign: 'center',
                        width: '100%',
                        lineHeight: '1.4',
                        marginTop: '16px'
                      }}>
                        💡 To regenerate this note, change the <strong>Primary Spoken Language</strong> in the dropdown above. <span style={{ opacity: 0.7 }}>({3 - regenerationCount} remaining)</span>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '12.5px',
                        color: 'var(--accent-secondary, #2dd4bf)',
                        background: 'rgba(45, 212, 191, 0.03)',
                        border: '1px solid rgba(45, 212, 191, 0.2)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        textAlign: 'center',
                        width: '100%',
                        lineHeight: '1.4',
                        marginTop: '16px'
                      }}>
                        ✨ Spoken language modified! Click <strong>Regenerate Note</strong> below to process. <span style={{ opacity: 0.8 }}>({3 - regenerationCount} remaining)</span>
                      </div>
                    )}

                    <button
                      className={`btn-primary-action ${isLoading ? 'loading' : ''}`}
                      onClick={regenerateSession}
                      disabled={isLoading || language === initialLanguage || regenerationCount >= 3}
                      style={{
                        background: (language === initialLanguage || regenerationCount >= 3)
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'linear-gradient(135deg, var(--accent-primary, #8b5cf6), var(--accent-secondary, #2dd4bf))',
                        boxShadow: (language === initialLanguage || regenerationCount >= 3) ? 'none' : '0 4px 15px var(--accent-primary-glow)',
                        marginTop: '12px'
                      }}
                    >
                      {isLoading && (
                        <span className="spinner-mini" style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid transparent',
                          borderTopColor: 'currentColor',
                          borderBottomColor: 'currentColor',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'rotate-spinner 1s linear infinite'
                        }}></span>
                      )}
                      {isLoading ? 'Regenerating...' : 'Regenerate Note'}
                    </button>
                  </>
                ) : (
                  <button
                    className={`btn-primary-action ${isLoading ? 'loading' : ''}`}
                    style={{ marginTop: '16px' }}
                    onClick={processConversation}
                    disabled={isLoading || (!audioBlob && !fileToUpload && !transcript)}
                  >
                    {isLoading && (
                      <span className="spinner-mini" style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTopColor: 'currentColor',
                        borderBottomColor: 'currentColor',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'rotate-spinner 1s linear infinite'
                      }}></span>
                    )}
                    {isLoading ? 'Transcribing & Summarizing...' : 'Transcribe & Generate Medical Note'}
                  </button>
                )}
              </section>
            </div>

            {/* RIGHT SIDE: Speech-to-Text & Clinical Summary Output */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Captured Transcription text panel */}
              <section className="glass-panel panel-body">
                <div className="panel-header">
                  <h3>Speech-to-Text Transcription</h3>
                </div>

                {isLoading && loadingMessage.includes('Whisper') ? (
                  <div className="loading-overlay">
                    <div className="ai-glow-spinner"></div>
                    <div className="loading-text">{loadingMessage}</div>
                  </div>
                ) : (
                  <textarea
                    className="transcript-textbox"
                    style={{ height: '180px' }}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    readOnly={activeSessionId !== null}
                    placeholder={activeSessionId ? "No transcript captured for this session." : "Dialogue script transcribes here. You can edit this directly to correct errors."}
                  />
                )}
              </section>

              {/* Summarized Clinical Note panel */}
              <section className="glass-panel panel-body">
                <div className="panel-header">
                  <h3>Clinical Summary Note</h3>
                </div>

                {isLoading && loadingMessage.includes('Gemini') ? (
                  <div className="loading-overlay" style={{ padding: '60px 24px' }}>
                    <div className="ai-glow-spinner"></div>
                    <div className="loading-text">{loadingMessage}</div>
                  </div>
                ) : clinicalSummary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Render Clinical Summary */}
                    <div className="soap-content-area" style={{ minHeight: '280px', maxHeight: '350px' }}>
                      <div className="soap-text" style={{ fontFamily: 'var(--font-sans)', fontSize: '14.5px', lineHeight: '1.6', color: 'var(--text-primary)', overflowY: 'auto', maxHeight: '100%' }}>
                        {renderSummaryText(clinicalSummary)}
                      </div>
                    </div>

                    <div className="actions-row">
                      <button className="btn-secondary-action" onClick={copyToClipboard}>Copy Summary</button>
                      <button className="btn-secondary-action" onClick={downloadTextFile}>Download</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '48px 24px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Speak, record, or upload audio, then click generate to instantly view the clinical summary here.
                  </div>
                )}
              </section>
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}
