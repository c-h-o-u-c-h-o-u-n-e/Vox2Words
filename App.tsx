import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ProcessingStatus } from './types';
import { transcribeLyrics } from './services/geminiService';

// Helper function to simulate delays for better UX
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to read a file and convert it to a base64 string
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.split(';')[0].split(':')[1];
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = error => reject(error);
  });
};

// --- Sub-components ---

const Logo = () => (
    <h1 className="text-4xl sm:text-5xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-amber-500 font-title">
        V<span style={{ fontVariant: 'small-caps' }}>ox</span>2W<span style={{ fontVariant: 'small-caps' }}>ords</span>
    </h1>
);

interface FileUploadButtonProps {
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  disabled: boolean;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({ onFileChange, file, disabled }) => (
  <div className="w-full flex flex-col items-center">
    <label
      htmlFor="audio-upload"
      className={`w-full max-w-sm py-3 px-4 bg-neutral-800 text-neutral-200 rounded-md hover:bg-neutral-700 focus:outline-none focus:ring-4 focus:ring-amber-500/30 transition-all duration-300 cursor-pointer flex items-center justify-center font-title uppercase tracking-wider transform hover:scale-105 disabled:scale-100 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <i className="fa-solid fa-arrow-up-from-bracket mr-3"></i>
      <span>{file ? 'CHANGE FILE' : 'BROWSE FILE'}</span>
    </label>
    <input
      id="audio-upload"
      type="file"
      className="hidden"
      accept="audio/*"
      onChange={onFileChange}
      disabled={disabled}
    />
    {file && (
      <div className="mt-4 flex items-center justify-center text-neutral-400 w-full max-w-sm px-2">
        <i className="fa-solid fa-music mr-3 text-amber-400 flex-shrink-0"></i>
        <span className="text-sm truncate">{file.name}</span>
      </div>
    )}
  </div>
);

interface ResultsScreenProps {
  lyrics: string;
  error: string | null;
  audioSrc: string | null;
  onReset: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ 
  lyrics, error, audioSrc, onReset
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (lyrics) {
      navigator.clipboard.writeText(lyrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <div className="w-full max-w-2xl mt-8 p-6 bg-amber-900/20 border border-amber-500/30 rounded-lg text-center">
        <h3 className="text-xl text-amber-400 mb-2 font-title uppercase tracking-wider">An Error Occurred</h3>
        <p className="text-amber-200">{error}</p>
        <button
          onClick={onReset}
          className="mt-6 flex items-center mx-auto px-4 py-2 text-sm border border-amber-400 hover:bg-amber-400/10 text-amber-300 hover:text-amber-200 rounded-md transition-all duration-200 font-title uppercase tracking-wider"
        >
          <i className="fa-solid fa-rotate-left mr-2"></i>
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mt-8 flex flex-col gap-8 animate-fade-in">
        {/* Audio Player and Controls */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl shadow-2xl p-6">
          <h3 className="text-sm text-neutral-400 mb-3 tracking-wider font-title uppercase">ORIGINAL SONG</h3>
          {audioSrc && <audio controls src={audioSrc} className="w-full h-12"></audio>}
           <button
            onClick={onReset}
            className="mt-6 flex items-center px-4 py-2 text-sm border border-neutral-600 hover:bg-neutral-700/50 text-neutral-300 hover:text-white rounded-md transition-all duration-200 font-title uppercase tracking-wider"
            >
            <i className="fa-solid fa-rotate-left mr-2"></i>
            START OVER
          </button>
        </div>
      
      {/* Lyrics */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl shadow-2xl p-6 md:p-8">
         <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl text-amber-400 font-title uppercase tracking-wider">Lyrics</h3>
          <button
            onClick={handleCopy}
            className="flex items-center px-3 py-2 text-sm bg-neutral-800 hover:bg-amber-400/10 text-neutral-300 hover:text-amber-300 rounded-md transition-all duration-200 font-title uppercase tracking-wider"
            title="Copy lyrics"
            aria-label="Copy lyrics to clipboard"
          >
            <i className="fa-solid fa-copy mr-2"></i>
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-neutral-200 text-lg leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          {lyrics}
        </pre>
      </div>
    </div>
  );
};


// --- Main App Component ---

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('Select an audio file to begin.');
  const [lyrics, setLyrics] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  
  const isProcessing = useMemo(() => status === ProcessingStatus.PROCESSING, [status]);
  const showResults = useMemo(() => status === ProcessingStatus.SUCCESS || status === ProcessingStatus.ERROR, [status]);

  // Clean up the object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const handleReset = () => {
    setFile(null);
    setAudioSrc(null);
    setLyrics('');
    setError(null);
    setStatus(ProcessingStatus.IDLE);
    setStatusMessage('Select an audio file to begin.');
    setProgress(0);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      if (files[0].size > 50 * 1024 * 1024) { // 50MB
        setError("File is too large. Please select a file smaller than 50MB.");
        setStatus(ProcessingStatus.ERROR);
        setFile(null);
        return;
      }
      
      const newFile = files[0];
      handleReset(); // Reset everything before setting the new file
      setFile(newFile); 
      if (audioSrc) URL.revokeObjectURL(audioSrc);
      setAudioSrc(URL.createObjectURL(newFile));
      setStatus(ProcessingStatus.IDLE);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    setStatus(ProcessingStatus.PROCESSING);
    setError(null);
    setLyrics('');
    setProgress(0);

    try {
      setStatusMessage("Reading audio file...");
      const { base64, mimeType } = await fileToBase64(file);
      setProgress(25);
      await wait(500);

      setStatusMessage("Analyzing vocals...");
      setProgress(50);
      await wait(1500); 
      
      setStatusMessage("Writing lyrics...");
      setProgress(75);
      const transcribedText = await transcribeLyrics(base64, mimeType);
      
      setProgress(100);
      await wait(500);

      if (!transcribedText) {
        setLyrics("The AI could not find any lyrics in this audio file.");
      } else {
        setLyrics(transcribedText);
      }

      setStatus(ProcessingStatus.SUCCESS);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(errorMessage);
      setStatus(ProcessingStatus.ERROR);
      setProgress(0);
    }
  }, [file]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-neutral-200 flex flex-col items-center p-4 sm:p-6">
      <header className="py-10 text-center">
        <Logo />
      </header>

      <main className="flex flex-col items-center w-full flex-grow">
        
        {showResults ? (
          <ResultsScreen 
            lyrics={lyrics} 
            error={error} 
            audioSrc={audioSrc} 
            onReset={handleReset} 
          />
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mt-4 text-lg text-neutral-400">
                <div className="inline-grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                    <p className="text-left font-title uppercase tracking-wider text-amber-500/80">STEP 1</p>
                    <p className="text-left text-neutral-300">Upload a song</p>

                    <p className="text-left font-title uppercase tracking-wider text-amber-500/80">STEP 2</p>
                    <p className="text-left text-neutral-300">Click the Transcribe button</p>

                    <p className="text-left font-title uppercase tracking-wider text-amber-500/80">STEP 3</p>
                    <p className="text-left text-neutral-300">Get the lyrics</p>
                </div>
            </div>
            <div className="w-full max-w-lg bg-neutral-900/50 p-6 sm:p-8 rounded-xl shadow-2xl border border-neutral-800/80 mt-8">
                <div className="flex flex-col items-center space-y-6">
                    <FileUploadButton onFileChange={handleFileChange} file={file} disabled={isProcessing} />
                    <div className="w-full max-w-sm">
                        <button
                            onClick={handleSubmit}
                            disabled={!file || isProcessing}
                            className="w-full py-3 px-4 bg-amber-400 text-stone-900 rounded-md hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-400/40 transition-all duration-300 disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100 font-title uppercase tracking-wider"
                        >
                            {isProcessing ? 'TRANSCRIBING...' : 'TRANSCRIBE'}
                        </button>
                        {isProcessing && (
                            <div className="mt-4 text-center">
                                <p className="text-sm text-neutral-400 mb-2">{statusMessage} ({progress}%)</p>
                                <div className="w-full bg-neutral-700 rounded-full h-2.5">
                                    <div 
                                        className="bg-amber-400 h-2.5 rounded-full transition-all duration-500 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}

      </main>
      <footer className="text-center text-neutral-700 w-full mt-auto pt-10 pb-4 text-xs font-title uppercase tracking-widest">
        <p>BUILT BY <span className="text-amber-500/50">CHARLOTTE CHAPDELAINE</span></p>
      </footer>
    </div>
  );
}

export default App;