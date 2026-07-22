import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, Lock, Check, Sparkles } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const apiKeys = useAppStore((state) => state.apiKeys);
  const setApiKeys = useAppStore((state) => state.setApiKeys);

  const [geminiKey, setGeminiKey] = useState(apiKeys.gemini || '');
  const [showGemini, setShowGemini] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Future expandable states
  const [openAiKey, setOpenAiKey] = useState('');
  const [stabilityKey, setStabilityKey] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeys({
      gemini: geminiKey,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-lg bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#141414]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                API Credentials Config
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              Custom keys are stored securely in your browser's <code className="text-indigo-300 bg-indigo-950/30 px-1 py-0.5 rounded">localStorage</code> and never shared. If left blank, the platform's default shared key will be used as a fallback.
            </p>

            <div className="space-y-4">
              {/* Gemini Key Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Gemini API Key (Google AI Studio)
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-slate-500" />
                  <input
                    type={showGemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Using default system fallback key..."
                    className="w-full pl-9 pr-10 py-2.5 bg-[#161616] border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGemini(!showGemini)}
                    className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* OpenAI Key Field (Expandable Placeholder) */}
              <div className="space-y-1.5 opacity-60">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  OpenAI API Key (Expandable Option)
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-slate-600" />
                  <input
                    type="password"
                    disabled
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    placeholder="Coming Soon — Multimodal GPT Support"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#141414] border border-white/5 rounded-xl text-xs font-mono text-slate-600 placeholder-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Stability Key Field (Expandable Placeholder) */}
              <div className="space-y-1.5 opacity-60">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  Stable Diffusion API Key (Expandable Option)
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-slate-600" />
                  <input
                    type="password"
                    disabled
                    value={stabilityKey}
                    onChange={(e) => setStabilityKey(e.target.value)}
                    placeholder="Coming Soon — Stability AI SD3 API"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#141414] border border-white/5 rounded-xl text-xs font-mono text-slate-600 placeholder-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={savedSuccess}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savedSuccess}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/40 transition-all cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Keys Saved</span>
                  </>
                ) : (
                  <span>Save Configuration</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
