import React from 'react';
import { X, ExternalLink, Mail, Users } from 'lucide-react';

export default function CollaborateModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-5 mx-auto border border-blue-500/30">
          <Users size={26} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-center text-white mb-2">
          İş Birliği & İletişim
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-300 text-center mb-6 leading-relaxed">
          Teknik iş birlikleri, akademik çalışmalar veya kurumsal çözümler için
          benimle iletişime geçebilirsiniz.{' '}
          <span className="text-blue-400 font-semibold">
            AuraSol'u beraber daha ileriye taşıyalım.
          </span>
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => window.open('https://www.linkedin.com/in/tugbakeskik', '_blank')}
            className="w-full py-3 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 transform active:scale-95 text-sm"
          >
            <ExternalLink size={18} /> LinkedIn'de Bağlan
          </button>

          <a
            href="mailto:tugbakeskik@gmail.com"
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
          >
            <Mail size={18} /> E-posta Gönder
          </a>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-600 text-center mt-5 uppercase tracking-wider">
          AuraSol — Güneş Enerjisi Analiz Platformu
        </p>
      </div>
    </div>
  );
}
