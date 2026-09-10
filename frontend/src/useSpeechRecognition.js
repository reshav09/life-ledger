import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api';

/**
 * Remove immediate consecutive duplicate words or n-gram phrases (e.g., "spent on spent on" -> "spent on")
 * to prevent repetitive audio / speech recognition loops on mobile browsers.
 */
function deduplicateConsecutivePhrases(str) {
  if (!str || typeof str !== 'string') return '';
  // 1. Collapse duplicate single words (case-insensitive)
  let clean = str.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
  // 2. Collapse duplicate 2-word phrases
  clean = clean.replace(/\b(\w+\s+\w+)(?:\s+\1\b)+/gi, '$1');
  // 3. Collapse duplicate 3-word phrases
  clean = clean.replace(/\b(\w+\s+\w+\s+\w+)(?:\s+\1\b)+/gi, '$1');
  return clean;
}

/**
 * Hybrid Voice-to-Text hook supporting:
 * 1. Web Speech API (Live streaming dictation with de-duplication)
 * 2. Direct Audio Recorder (MediaRecorder with iOS Safari, Android Chrome, and Brave support)
 * 3. Automatic fallback: If Google Speech throws 'not-allowed' or 'network' (common in Brave),
 *    it seamlessly switches to Direct Audio MediaRecorder.
 */
export function useSpeechRecognition({ defaultLang = 'en-IN' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [isNetworkBlocked, setIsNetworkBlocked] = useState(false);
  const [lang, setLang] = useState(defaultLang);
  const [engineMode, setEngineMode] = useState('live'); // 'live' | 'audio_recorder'

  const isClient = typeof window !== 'undefined';
  const isSecureContext = isClient ? Boolean(window.isSecureContext) : true;
  const isLocalHost = isClient ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : true;
  const isInsecureRemote = !isSecureContext && !isLocalHost;

  const SpeechRecognition = isClient
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const isWebSpeechSupported = Boolean(SpeechRecognition);

  // References for Web Speech API
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const baseTextRef = useRef('');
  const sessionFinalTextRef = useRef('');
  const onTranscriptUpdateRef = useRef(null);
  const restartTimerRef = useRef(null);
  const langRef = useRef(lang);

  // References for Direct Audio MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaStreamRef = useRef(null);

  langRef.current = lang;

  // Cleanup Web Speech API
  const cleanupWebSpeech = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.abort();
      } catch (err) {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  // Cleanup Direct Audio MediaRecorder
  const cleanupMediaRecorder = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (err) {
        // ignore
      }
      mediaStreamRef.current = null;
    }
  }, []);

  // ---------- Direct Audio Recorder (MediaRecorder + AI) ----------
  const startAudioRecording = useCallback(async ({ initialText = '', onUpdate } = {}) => {
    setError(null);
    setPermissionBlocked(false);
    baseTextRef.current = initialText;
    onTranscriptUpdateRef.current = onUpdate || null;
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    if (isInsecureRemote) {
      setError('Mobile browsers require HTTPS or localhost for microphone access over Wi-Fi. Access via localhost / USB debugging or type your log below.');
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      mediaStreamRef.current = stream;

      // Mobile compatible MIME type detection
      let mimeType = '';
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];

      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      const activeMimeType = recorder.mimeType || mimeType || 'audio/webm';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsRecordingAudio(true);
        setError(null);
        setPermissionBlocked(false);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((sec) => sec + 1);
        }, 1000);
      };

      recorder.onstop = async () => {
        setIsRecordingAudio(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: activeMimeType });
        if (audioBlob.size < 400) {
          return;
        }

        // Convert blob to base64 and send for AI transcription
        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            try {
              const res = await api.post('/ai/transcribe-audio', {
                audioBase64: base64Data,
                mimeType: activeMimeType,
                lang: langRef.current
              });

              if (res.ok && res.transcript) {
                const cleanedTranscript = deduplicateConsecutivePhrases(res.transcript.trim());
                const combined = [baseTextRef.current.trim(), cleanedTranscript]
                  .filter(Boolean)
                  .join(' ');
                if (onTranscriptUpdateRef.current) {
                  onTranscriptUpdateRef.current(deduplicateConsecutivePhrases(combined));
                }
              } else {
                setError(res.error || 'Speech could not be recognized. Please speak clearly or configure an AI key.');
              }
            } catch (err) {
              setError(`Audio transcription failed: ${err.message}`);
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (err) {
          setError(`Audio processing failed: ${err.message}`);
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
    } catch (err) {
      console.warn('getUserMedia error:', err);
      setIsRecordingAudio(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionBlocked(true);
        setError('🎙️ Microphone is turned off or access is blocked in browser permissions. Please turn on your microphone or click the 🔒 icon in your URL bar to allow microphone access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('🎙️ No microphone device was found on your system. Please connect or turn on a microphone.');
      } else {
        setError(`🎙️ Microphone unavailable: ${err.message}`);
      }
    }
  }, [isInsecureRemote]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
  }, []);

  // ---------- Web Speech API Implementation ----------
  const createAndStartWebSpeech = useCallback(() => {
    if (!SpeechRecognition || !shouldListenRef.current) return;

    cleanupWebSpeech();

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = langRef.current || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setPermissionBlocked(false);
      };

      recognition.onresult = (event) => {
        let sessionFinal = '';
        let interim = '';

        // Read all items in event.results from 0 to results.length cleanly
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            sessionFinal += item[0].transcript + ' ';
          } else {
            interim += item[0].transcript;
          }
        }

        sessionFinalTextRef.current = sessionFinal.trim();
        setInterimTranscript(interim.trim());

        if (onTranscriptUpdateRef.current) {
          const combined = [
            baseTextRef.current.trim(),
            sessionFinalTextRef.current,
            interim.trim()
          ].filter(Boolean).join(' ');

          onTranscriptUpdateRef.current(deduplicateConsecutivePhrases(combined));
        }
      };

      recognition.onerror = (event) => {
        const errType = event.error;
        console.warn('Speech recognition notice:', errType);

        if (errType === 'no-speech') {
          return;
        }

        // In Brave or when Google Speech is blocked, Web Speech returns 'not-allowed' or 'network'.
        if (errType === 'not-allowed' || errType === 'service-not-allowed' || errType === 'network') {
          shouldListenRef.current = false;
          setIsListening(false);
          setIsNetworkBlocked(true);
          setEngineMode('audio_recorder');
          startAudioRecording({
            initialText: baseTextRef.current,
            onUpdate: onTranscriptUpdateRef.current
          });
          return;
        }

        if (errType === 'audio-capture') {
          shouldListenRef.current = false;
          setIsListening(false);
          setError('No microphone detected. Please plug in or enable a microphone.');
          return;
        }

        if (errType === 'language-not-supported') {
          recognition.lang = navigator.language || 'en-US';
          return;
        }

        if (errType !== 'aborted') {
          setError(`Speech notice: ${errType}`);
        }
      };

      recognition.onend = () => {
        // Save accumulated final text into baseTextRef so restart starts fresh
        if (sessionFinalTextRef.current) {
          const updatedBase = [baseTextRef.current.trim(), sessionFinalTextRef.current]
            .filter(Boolean)
            .join(' ');
          baseTextRef.current = deduplicateConsecutivePhrases(updatedBase);
          sessionFinalTextRef.current = '';
        }

        if (shouldListenRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current) {
              createAndStartWebSpeech();
            }
          }, 150);
        } else {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('SpeechRecognition start error:', err);
      shouldListenRef.current = false;
      setIsListening(false);
      setEngineMode('audio_recorder');
      startAudioRecording({
        initialText: baseTextRef.current,
        onUpdate: onTranscriptUpdateRef.current
      });
    }
  }, [SpeechRecognition, cleanupWebSpeech, startAudioRecording]);

  // ---------- Unified Start / Stop Controller ----------
  const startListening = useCallback(({ initialText = '', onUpdate } = {}) => {
    setError(null);
    setPermissionBlocked(false);

    if (engineMode === 'audio_recorder' || isNetworkBlocked || !isWebSpeechSupported) {
      startAudioRecording({ initialText, onUpdate });
      return;
    }

    baseTextRef.current = initialText;
    sessionFinalTextRef.current = '';
    onTranscriptUpdateRef.current = onUpdate || null;
    shouldListenRef.current = true;
    setIsListening(true);
    setInterimTranscript('');

    createAndStartWebSpeech();
  }, [engineMode, isNetworkBlocked, isWebSpeechSupported, startAudioRecording, createAndStartWebSpeech]);

  const stopListening = useCallback(() => {
    if (isRecordingAudio) {
      stopAudioRecording();
    }
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimTranscript('');
    cleanupWebSpeech();
  }, [isRecordingAudio, stopAudioRecording, cleanupWebSpeech]);

  const toggleListening = useCallback(({ initialText = '', onUpdate } = {}) => {
    if (isListening || isRecordingAudio) {
      stopListening();
    } else {
      startListening({ initialText, onUpdate });
    }
  }, [isListening, isRecordingAudio, startListening, stopListening]);

  const requestPermission = useCallback(() => {
    startAudioRecording({
      initialText: baseTextRef.current,
      onUpdate: onTranscriptUpdateRef.current
    });
  }, [startAudioRecording]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      cleanupWebSpeech();
      cleanupMediaRecorder();
    };
  }, [cleanupWebSpeech, cleanupMediaRecorder]);

  return {
    isSupported: true,
    isWebSpeechSupported,
    isListening: isListening || isRecordingAudio,
    isLiveListening: isListening,
    isRecordingAudio,
    isTranscribing,
    recordingSeconds,
    interimTranscript,
    error,
    setError,
    permissionBlocked,
    requestPermission,
    isInsecureRemote,
    isNetworkBlocked,
    engineMode,
    setEngineMode,
    lang,
    setLang,
    startListening,
    stopListening,
    toggleListening
  };
}
