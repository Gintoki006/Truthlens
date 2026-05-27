'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

/**
 * Analysis input form with URL / Text / Image toggle.
 * Styled to match the editorial newspaper aesthetic.
 * Submits to the Next.js API proxy → FastAPI backend.
 */
export default function AnalyzeForm() {
  const [mode, setMode] = useState('url'); // 'url' | 'text' | 'image'
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { user } = useAuth();

  // Drag & Drop Handlers
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    setError(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }
    setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Enforce login to analyze
    if (!user) {
      router.push('/login?redirect=/');
      return;
    }

    if (mode === 'image' && !imageFile) {
      setError('Please select or drop an image to analyze.');
      return;
    }

    if (mode !== 'image' && !input.trim()) {
      setError('Please enter a URL or article text to analyze.');
      return;
    }

    if (mode === 'text' && input.trim().length < 20) {
      setError('Text must be at least 20 characters for meaningful analysis.');
      return;
    }

    if (mode === 'url') {
      try {
        new URL(input.trim());
      } catch {
        setError(
          'Please enter a valid URL (e.g., https://example.com/article).'
        );
        return;
      }
    }

    setLoading(true);

    try {
      let body;
      let headers = {};

      if (mode === 'image') {
        body = new FormData();
        body.append('image', imageFile);
        if (user?.id) body.append('user_id', user.id);
        // Do NOT set Content-Type for FormData, fetch does it automatically with boundary
      } else {
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
          ...(mode === 'url' ? { url: input.trim() } : { text: input.trim() }),
          user_id: user?.id || undefined,
        });
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed. Please try again.');
      }

      const data = await res.json();
      if (data.id) {
        router.push(`/results/${data.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      {/* Mode toggle — editorial pill style */}
      <div className="flex items-center justify-center gap-0 mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('url');
            setInput('');
            setError(null);
          }}
          className={`
            px-4 sm:px-5 py-2 text-[9px] sm:text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] transition-all duration-300 border border-slate-900 dark:border-stone-500
            ${
              mode === 'url'
                ? 'bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900'
                : 'bg-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">link</span>
            <span className="hidden sm:inline">Paste URL</span>
            <span className="sm:hidden">URL</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('text');
            setInput('');
            setError(null);
          }}
          className={`
            px-4 sm:px-5 py-2 text-[9px] sm:text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] transition-all duration-300 border border-l-0 border-slate-900 dark:border-stone-500
            ${
              mode === 'text'
                ? 'bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900'
                : 'bg-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">
              article
            </span>
            <span className="hidden sm:inline">Paste Text</span>
            <span className="sm:hidden">Text</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('image');
            setImageFile(null);
            setError(null);
          }}
          className={`
            px-4 sm:px-5 py-2 text-[9px] sm:text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] transition-all duration-300 border border-l-0 border-slate-900 dark:border-stone-500
            ${
              mode === 'image'
                ? 'bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900'
                : 'bg-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">
              image
            </span>
            <span className="hidden sm:inline">Screenshot</span>
            <span className="sm:hidden">Image</span>
          </span>
        </button>
      </div>

      {/* Input field — editorial style */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {mode === 'url' && (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block font-label-caps text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
                Article URL
              </label>
              <div className="flex flex-col md:flex-row gap-0">
                <input
                  type="url"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://news-source.com/article-to-verify"
                  className="w-full bg-transparent border-2 border-primary dark:border-stone-500 dark:text-stone-100 p-4 font-body-md focus:outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-stone-600 transition-colors"
                  disabled={loading}
                />
                <motion.button
                  type="submit"
                  disabled={loading || !input.trim()}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 px-10 py-4 w-full md:w-auto font-['Work_Sans'] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">autorenew</span>
                      Analyzing...
                    </>
                  ) : (
                    'Analyze'
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {mode === 'text' && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block font-label-caps text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
                Article Text or Claim
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the full article text or type a claim to verify (minimum 20 characters)..."
                rows={5}
                className="w-full bg-transparent border-2 border-primary dark:border-stone-500 dark:text-stone-100 p-4 font-body-md focus:outline-none focus:ring-0 resize-none placeholder:text-slate-400 dark:placeholder:text-stone-600 transition-colors"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="mt-0 bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 w-full py-4 font-['Work_Sans'] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">autorenew</span>
                    Analyzing...
                  </>
                ) : (
                  'Analyze Text'
                )}
              </motion.button>
            </motion.div>
          )}

          {mode === 'image' && (
            <motion.div
              key="image"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block font-label-caps text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
                Screenshot / Image Upload
              </label>
              
              <div
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed transition-all duration-300 cursor-pointer 
                  ${
                    dragActive
                      ? 'border-primary bg-primary/5 dark:bg-stone-100/10'
                      : 'border-slate-400 dark:border-stone-600 hover:border-slate-500 dark:hover:border-stone-400'
                  }
                  ${imageFile ? 'bg-slate-50 dark:bg-stone-800' : ''}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('imageUpload').click()}
              >
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                  onChange={handleChange}
                  disabled={loading}
                />
                
                {imageFile ? (
                  <div className="flex flex-col items-center text-center">
                    <span className="material-symbols-outlined text-4xl text-primary dark:text-stone-300 mb-2">
                      check_circle
                    </span>
                    <p className="font-body-md font-bold text-slate-800 dark:text-stone-200">
                      {imageFile.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                      {(imageFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                      }}
                      className="mt-6 px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-bold border border-slate-300 hover:border-secondary hover:text-secondary dark:border-stone-600 dark:hover:border-red-400 dark:hover:text-red-400 transition-colors"
                      disabled={loading}
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center text-slate-500 dark:text-stone-400 py-4">
                    <span className="material-symbols-outlined text-[40px] mb-3 opacity-80 text-slate-800 dark:text-stone-300">
                      upload_file
                    </span>
                    <p className="font-body-md font-bold text-slate-800 dark:text-stone-300">
                      Drag & Drop a screenshot here
                    </p>
                    <p className="text-[11px] mt-2 font-bold uppercase tracking-widest opacity-70">
                      or click to browse (JPEG, PNG, WEBP)
                    </p>
                  </div>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={loading || !imageFile}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="mt-4 bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 w-full py-4 font-['Work_Sans'] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">autorenew</span>
                    Analyzing Image...
                  </>
                ) : (
                  'Analyze Screenshot'
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm text-secondary dark:text-red-400 flex items-center gap-2 font-['Work_Sans']">
              <span className="material-symbols-outlined text-[16px]">
                warning
              </span>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <p className="mt-4 text-center text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-stone-500">
        Analysis typically completes in 3–8 seconds
      </p>
    </form>
  );
}
