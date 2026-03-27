import React, { useState } from 'react';
import Analyzer from './components/Analyzer';
import AuraLogo from './components/AuraLogo';
import { Sparkles, Map, Sun, FileSpreadsheet, ArrowRight, Mail, MapPin } from 'lucide-react';

export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (isAnalyzing) {
    return <Analyzer onBack={() => setIsAnalyzing(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <AuraLogo />
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Yetenekler</a>
          <a href="#" className="hover:text-white transition-colors">Nasıl Çalışır</a>
          <a href="#" className="hover:text-white transition-colors">Hakkımızda</a>
        </nav>
        <button 
          onClick={() => setIsAnalyzing(true)}
          className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-slate-800 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 text-xs md:text-sm font-semibold transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]"
        >
          Panele Git
        </button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-amber-500 text-sm font-medium backdrop-blur-sm">
            <Sparkles size={16} />
            <span>Yeni Nesil GES Fizibilite Motoru Yayında</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Aura<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Sol</span>: Güneşin Gücünü <br className="hidden xl:block"/> Veriye Dönüştürün.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Yapay zeka ve CBS (Coğrafi Bilgi Sistemleri) teknolojisiyle, arazinizin güneş potansiyelini anında, doğru ve tarafsız analiz edin. 
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setIsAnalyzing(true)}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-lg hover:to-orange-500 transition-all shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10">Hemen Analize Başla</span>
              <ArrowRight className="relative z-10 group-hover:translate-x-1 transition-transform" size={20} />
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Map size={24} className="text-blue-400" />}
            title="Doğru DEM Analizi"
            desc="Gerçek SRTM uydu verileri ile arazi eğimi ve bakı yönlerini (Kuzey yamaçlar, >15° dik eğimler) mikroskobik düzeyde maskeler."
            glowColor="blue"
          />
          <FeatureCard 
            icon={<Sun size={24} className="text-amber-400" />}
            title="Yıllık Işınım Hesabı"
            desc="Topografik gölgelenmeyi (Hillshade) dikkate alarak yıl boyu arazinize düşecek düzeltilmiş net radyasyonu hesaplar."
            glowColor="amber"
          />
          <FeatureCard 
            icon={<FileSpreadsheet size={24} className="text-emerald-400" />}
            title="Kapsamlı Fizibilite Raporu"
            desc="Sadece uygun alanları ayırmakla kalmaz, tahmini MW kapasite ve kullanılabilir alan büyüklüğünü anlık olarak raporlar."
            glowColor="emerald"
          />
        </div>

        {/* Contact Section */}
        <div className="mt-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-blue-500/5 rounded-3xl" />
          <div className="relative border border-slate-800 rounded-3xl p-10 md:p-16 text-center space-y-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
              <Mail size={14} /> Bize Ulaşın
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Projenizi Birlikte Değerlendirelim
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
              GES yatırım süreçlerinizde profesyonel CBS ve fizibilite desteği için iletişime geçin.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a
                href="mailto:tugbakeskik@gmail.com"
                className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/40 hover:bg-slate-700 transition-all text-sm font-medium group"
              >
                <Mail size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span>tugbakeskik@gmail.com</span>
              </a>
              <a
                href="https://linkedin.com/in/tugbakeskik"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500/40 hover:bg-slate-700 transition-all text-sm font-medium group"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-blue-400 group-hover:scale-110 transition-transform shrink-0"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                <span>linkedin.com/in/tugbakeskik</span>
              </a>
              <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-slate-400">
                <MapPin size={16} className="text-emerald-400" />
                <span>İstanbul, Türkiye</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc, glowColor }) {
  const glowClasses = {
    blue: "hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-blue-500/30",
    amber: "hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] hover:border-amber-500/30",
    emerald: "hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:border-emerald-500/30",
  };

  const bgGlowClasses = {
    blue: "bg-blue-500/10",
    amber: "bg-amber-500/10",
    emerald: "bg-emerald-500/10",
  };

  return (
    <div className={`relative p-8 rounded-2xl bg-slate-900 border border-slate-800 transition-all duration-300 ${glowClasses[glowColor]} group`}>
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors ${bgGlowClasses[glowColor]}`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-slate-100 transition-colors">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">
        {desc}
      </p>
    </div>
  );
}
