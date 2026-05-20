import { useState, useEffect, useRef } from 'react';
import { translate, fetchHistory, toggleFavourite } from './utils/api';
import './App.css';

// ---------------------------------------------------------
// Supported Languages List (including English)
// ---------------------------------------------------------
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
];

// Source languages list includes the special "Auto Detect" option
const SOURCE_LANGUAGES = [
  { code: 'auto', name: 'Auto Detect', flag: '🌐' },
  ...LANGUAGES
];

function App() {
  // ---------------------------------------------------------
  // 1) useState hooks tracking app state
  // ---------------------------------------------------------

  // Tracks the input source text entered by the user in the textarea
  const [text, setText] = useState('');

  // Tracks the selected source language code (e.g., 'auto', 'en', 'es') from the dropdown
  const [sourceLanguage, setSourceLanguage] = useState('auto');

  // Tracks the selected target language code (e.g., 'es', 'fr') from the dropdown
  const [targetLanguage, setTargetLanguage] = useState('es');

  // Tracks the translated result text returned from the backend translator service
  const [translatedText, setTranslatedText] = useState('');

  // Tracks the loading state (boolean) to display spinner and disable inputs during request
  const [isLoading, setIsLoading] = useState(false);

  // Tracks any error message string if the backend translation request fails or browser is unsupported
  const [error, setError] = useState(null);

  // Tracks the list of translations fetched from the SQLite backend database history
  const [history, setHistory] = useState([]);

  // Tracks whether the Web Speech API Speech Recognition service is actively listening
  const [isListening, setIsListening] = useState(false);

  // Tracks whether the Web Speech API Speech Synthesis service is actively reading text aloud
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Tracks the active filter tab for the history section ('all' vs 'favourites')
  const [filterTab, setFilterTab] = useState('all');

  // Tracks if the translation text has just been copied to the clipboard (displays checkmark for 2s)
  const [copied, setCopied] = useState(false);

  // Holds reference to the active SpeechRecognition instance to allow stopping session cleanly
  const recognitionRef = useRef(null);

  // Fetch translation history log from database
  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // ---------------------------------------------------------
  // 2) useEffect hook to load translation history on mount
  // ---------------------------------------------------------
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, []);

  // ---------------------------------------------------------
  // Swap Languages Handler
  // Swaps the source text and translated text, as well as their languages.
  // ---------------------------------------------------------
  const handleSwap = () => {
    // Swap text values
    const tempText = text;
    setText(translatedText);
    setTranslatedText(tempText);

    // Swap language values
    const tempSource = sourceLanguage;
    const tempTarget = targetLanguage;

    if (tempSource === 'auto') {
      // If the source language was Auto Detect, target language cannot become Auto Detect.
      // We set the new source language to the previous target language, and target language to English as a sensible default.
      setSourceLanguage(tempTarget);
      setTargetLanguage('en');
    } else {
      // Otherwise, swap them directly
      setSourceLanguage(tempTarget);
      setTargetLanguage(tempSource);
    }
  };

  // ---------------------------------------------------------
  // Voice Input Speech Recognition Handler
  // ---------------------------------------------------------
  const handleMicClick = () => {
    // If already listening, stop recording immediately
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // Check for Web Speech API SpeechRecognition support (standard & WebKit classes)
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Web Speech API (Speech Recognition) is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false; // Stop listening after speech ends
    recognition.interimResults = false; // Only final transcript is returned

    // -----------------------------------------------------
    // Web Speech API Event Handlers (Recognition)
    // -----------------------------------------------------

    // Event: onstart
    // Fired when the speech recognition service starts listening for audio input.
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    // Event: onresult
    // Fired when the speech recognition service returns a result (decoded voice transcript).
    recognition.onresult = (event) => {
      const transcriptResult = event.results[0][0].transcript;
      setText(transcriptResult);
    };

    // Event: onerror
    // Fired when a speech recognition error occurs (e.g. mic permission blocked, no speech detected, network error).
    recognition.onerror = (event) => {
      console.error('[Speech Recognition Error]:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access was denied. Please enable microphone permissions in your browser settings.');
      } else if (event.error === 'no-speech') {
        setError('No speech was detected. Please try again.');
      } else {
        setError(`Speech recognition failed: ${event.error}`);
      }
      setIsListening(false);
    };

    // Event: onend
    // Fired when the speech recognition service disconnected and stops capturing audio.
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    // Begin recording speech
    recognition.start();
  };

  // ---------------------------------------------------------
  // Text-To-Speech (TTS) Speech Synthesis Handlers
  // ---------------------------------------------------------
  const handleSpeak = () => {
    if (!translatedText) return;

    // Check if the browser supports SpeechSynthesis API
    if (!window.speechSynthesis) {
      setError('Text-to-speech (Speech Synthesis) is not supported in this browser.');
      return;
    }

    // Cancel any current speaking operations to prevent stacking utterances
    window.speechSynthesis.cancel();

    // Map language codes to regional TTS locale codes supported by browser synthesis engines
    const langLocaleMap = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      ja: 'ja-JP',
      ar: 'ar-SA',
    };

    const targetLocale = langLocaleMap[targetLanguage] || 'en-US';
    
    // Create an instance of SpeechSynthesisUtterance with the translated text
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = targetLocale;

    // -----------------------------------------------------
    // Web Speech API Event Handlers (Synthesis)
    // -----------------------------------------------------

    // Event: onstart
    // Fired when the SpeechSynthesis engine starts reading the utterance text aloud.
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    // Event: onend
    // Fired when the SpeechSynthesis engine successfully completes reading the entire text.
    utterance.onend = () => {
      setIsSpeaking(false);
    };

    // Event: onerror
    // Fired when an error occurs during vocalization (e.g. invalid text, system interrupt).
    utterance.onerror = (e) => {
      console.error('[Speech Synthesis Error]:', e);
      setIsSpeaking(false);
    };

    // Retrieve browser voice profiles and match the target language locale
    const availableVoices = window.speechSynthesis.getVoices();
    const matchedVoice = availableVoices.find(
      (voice) => voice.lang.startsWith(targetLocale) || voice.lang.startsWith(targetLanguage)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Command SpeechSynthesis engine to execute vocalization
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking and cancel ongoing SpeechSynthesis execution
  const handleStopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // ---------------------------------------------------------
  // Copy to Clipboard Handler
  // ---------------------------------------------------------
  const handleCopy = async () => {
    if (!translatedText) return;
    try {
      // Use navigator clipboard API to write translated output
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      // Reset copied state after 2 seconds to restore standard label icon
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy text to clipboard.');
    }
  };

  // ---------------------------------------------------------
  // Toggle Favorite Handler
  // Triggers backend PUT update, toggling status in the DB
  // ---------------------------------------------------------
  const handleToggleFavourite = async (id, e) => {
    e.stopPropagation(); // Avoid triggering restoring state when clicking star button
    try {
      const updatedItem = await toggleFavourite(id);
      // Map the local state array with the updated favorite boolean
      setHistory((prevHistory) =>
        prevHistory.map((item) => (item.id === id ? updatedItem : item))
      );
    } catch (err) {
      console.error('Failed to toggle favourite:', err);
      setError('Failed to update favorite status. Please try again.');
    }
  };

  // Helper mapper to find flag and full name of languages based on code
  const getLanguageDetails = (code) => {
    const matched = SOURCE_LANGUAGES.find((lang) => lang.code === code) || LANGUAGES.find((lang) => lang.code === code);
    return matched ? { name: matched.name, flag: matched.flag } : { name: code, flag: '🌐' };
  };

  // Format database timestamp string into local HH:MM structure
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const utcString = isoString.endsWith('Z') ? isoString : isoString + 'Z';
      const date = new Date(utcString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ---------------------------------------------------------
  // API Call & Submit Handling
  // ---------------------------------------------------------
  const handleTranslate = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) {
      setError('Please enter some text to translate.');
      return;
    }
    if (text.length > 500) {
      setError('Character limit exceeded. Source text must be 500 characters or fewer.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    handleStopSpeaking(); // Stop any reading speaking instances

    try {
      // Async/await API call using the axios api client utility, passing sourceLanguage
      const data = await translate(text, targetLanguage, sourceLanguage);
      const translatedResult = data.translated_text;
      
      setTranslatedText(translatedResult);

      // Refresh recent database logs immediately to sync history container
      await loadHistory();
    } catch (err) {
      const serverError = err.response?.data?.detail || err.message || 'Failed to translate. Please try again.';
      setError(serverError);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------
  const handleHistoryItemClick = (item) => {
    setText(item.original_text);
    setSourceLanguage(item.source_language || 'auto');
    setTargetLanguage(item.target_language);
    setTranslatedText(item.translated_text);
    setError(null);
    handleStopSpeaking(); // Stop speaking when loading a history item
  };

  // Filter history entries based on chosen tab: All vs Favorites
  const filteredHistory = history.filter((item) => {
    if (filterTab === 'favourites') {
      return item.is_favourite;
    }
    return true;
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-container">
          <span className="app-title-logo">✨</span>
          <h1 className="app-title">Polyglot</h1>
        </div>
        <p className="app-subtitle">Translate text seamlessly across languages using AI.</p>
      </header>

      {/* Error Alert Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Translation Form */}
      <form onSubmit={handleTranslate}>
        
        {/* Language Selection Toolbar with Swap Button */}
        <div className="language-bar">
          <div className="language-select-wrapper">
            <span className="select-label">From:</span>
            <select
              className="language-select"
              value={sourceLanguage}
              onChange={(e) => {
                setSourceLanguage(e.target.value);
                handleStopSpeaking();
              }}
            >
              {SOURCE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="swap-btn"
            onClick={() => {
              handleSwap();
              handleStopSpeaking();
            }}
            title="Swap languages and texts"
            aria-label="Swap languages"
          >
            ⇄
          </button>

          <div className="language-select-wrapper">
            <span className="select-label">To:</span>
            <select
              className="language-select"
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(e.target.value);
                handleStopSpeaking();
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="translator-layout">
          {/* Source Input Card */}
          <div className="card">
            <div className="card-header">
              <span>Source Text</span>
            </div>
            <textarea
              className="textarea-input"
              placeholder="Type or paste your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {/* Card Footer containing voice input activation and char counter */}
            <div className="card-footer">
              <button
                type="button"
                className={`mic-btn ${isListening ? 'listening' : ''}`}
                onClick={handleMicClick}
                disabled={isLoading}
                title={isListening ? 'Listening... Speak into microphone' : 'Start voice input (en-US)'}
              >
                {isListening ? (
                  <>
                    <span className="pulsing-dot" />
                    <span>Listening...</span>
                  </>
                ) : (
                  <>
                    <span>🎤</span>
                    <span>Voice Input</span>
                  </>
                )}
              </button>
              
              {/* Character counter turns red when length > 400 */}
              <div className={`char-counter ${text.length > 400 ? 'over-limit' : ''}`}>
                {text.length}/500
              </div>
            </div>
          </div>

          {/* Translated Output Card */}
          <div className="card">
            <div className="card-header">
              <span>Translation</span>
            </div>
            <div className="result-display">
              {isLoading ? (
                <span className="placeholder-text">Translating...</span>
              ) : translatedText ? (
                translatedText
              ) : (
                <span className="placeholder-text">Translation will appear here...</span>
              )}
            </div>
            {/* Card Footer containing TTS controls, Copy controls, and audio waves animations */}
            <div className="card-footer">
              <div className="tts-controls">
                {translatedText && !isLoading && (
                  <>
                    {!isSpeaking ? (
                      <button
                        type="button"
                        className="tts-btn speak"
                        onClick={handleSpeak}
                        title="Listen to translation"
                        aria-label="Read translation aloud"
                      >
                        <span>🔊</span>
                        <span>Speak</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tts-btn stop"
                        onClick={handleStopSpeaking}
                        title="Stop speaking"
                        aria-label="Stop reading aloud"
                      >
                        <span>⏹️</span>
                        <span>Stop</span>
                      </button>
                    )}

                    {/* Clipboard Copy Button (shows checkmark for 2s on success) */}
                    <button
                      type="button"
                      className="tts-btn copy"
                      onClick={handleCopy}
                      title="Copy translation to clipboard"
                      aria-label="Copy translation text"
                    >
                      {copied ? (
                        <>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                          <span style={{ color: '#10b981' }}>Copied</span>
                        </>
                      ) : (
                        <>
                          <span>📋</span>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
              
              {/* Speaking audio waves animation */}
              {isSpeaking && (
                <div className="audio-waves" title="Reading aloud...">
                  <span className="stroke" />
                  <span className="stroke" />
                  <span className="stroke" />
                  <span className="stroke" />
                  <span className="stroke" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Translation Submit Button. Disabled if empty, loading, or text exceeds 500 characters */}
        <div className="control-panel">
          <button 
            type="submit" 
            className="translate-btn" 
            disabled={isLoading || !text.trim() || text.length > 500}
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                Translating...
              </>
            ) : (
              'Translate'
            )}
          </button>
        </div>
      </form>

      {/* History of translations synced with database */}
      <section className="history-section">
        <div className="history-header">
          <h2 className="history-title">
            <span>⏳</span> Recent Translations
          </h2>
          <div className="history-tabs">
            <button
              type="button"
              className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All ({history.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${filterTab === 'favourites' ? 'active' : ''}`}
              onClick={() => setFilterTab('favourites')}
            >
              ⭐ Favorites ({history.filter((item) => item.is_favourite).length})
            </button>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="empty-history">
            {filterTab === 'favourites' 
              ? 'No starred translations yet. Click the star icon on any card to save it here.' 
              : 'Your translation history is empty. Try translating something above!'}
          </div>
        ) : (
          <div className="history-list">
            {filteredHistory.map((item) => {
              const sourceLang = getLanguageDetails(item.source_language);
              const targetLang = getLanguageDetails(item.target_language);
              return (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => handleHistoryItemClick(item)}
                  title="Click to restore this translation"
                >
                  <div className="history-meta">
                    <div className="history-badges">
                      <span className="history-badge">
                        {sourceLang.flag} {sourceLang.name}
                      </span>
                      <span className="history-arrow">➔</span>
                      <span className="history-badge">
                        {targetLang.flag} {targetLang.name}
                      </span>
                    </div>
                    <div className="history-meta-right">
                      <span className="history-time">{formatTime(item.created_at)}</span>
                      <button
                        type="button"
                        className={`star-btn ${item.is_favourite ? 'active' : ''}`}
                        onClick={(e) => handleToggleFavourite(item.id, e)}
                        title={item.is_favourite ? 'Remove from favorites' : 'Add to favorites'}
                        aria-label="Toggle favorite status"
                      >
                        ⭐
                      </button>
                    </div>
                  </div>
                  <div className="history-texts">
                    <div className="history-orig" title={item.original_text}>
                      {item.original_text}
                    </div>
                    <div className="history-trans" title={item.translated_text}>
                      {item.translated_text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
