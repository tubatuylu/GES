import { Activity, MapPin, TrendingUp, Sun, Zap, ShieldAlert, Eye, Cable, DollarSign, Download, Lock, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import React, { useState } from 'react';
import { exportToPDF } from '../utils/pdfExport';

const ASPECT_LABELS = [
  [0,   45,  '↑ Kuzey — Uygun Değil 🔴'],
  [45,  90,  '↗ Kuzeydoğu — Zayıf'],
  [90,  135, '→ Doğu — Orta'],
  [135, 225, '↓ Güney — En İyi ✅'],
  [225, 270, '← Batı — Orta'],
  [270, 315, '↖ Kuzeybatı — Zayıf'],
  [315, 360, '↑ Kuzey — Uygun Değil 🔴'],
];

const aspectLabel = (deg) => {
  if (deg == null) return '—';
  const match = ASPECT_LABELS.find(([a, b]) => deg >= a && deg < b);
  return match ? `${Math.round(deg)}°  ${match[2]}` : `${Math.round(deg)}°`;
};

const Card = ({ label, value, sub, icon, accent = 'blue' }) => {
  const cls = {
    blue:   'border-blue-500/30 text-blue-400',
    green:  'border-emerald-500/30 text-emerald-400',
    red:    'border-red-500/30 text-red-400',
    orange: 'border-orange-500/30 text-orange-400',
    yellow: 'border-yellow-500/30 text-yellow-400',
    purple: 'border-purple-500/30 text-purple-400',
    slate:  'border-slate-600/40 text-slate-400',
  }[accent];

  return (
    <div className={`border rounded-xl p-3 bg-slate-800/40 ${cls}`}>
      <div className="flex justify-between items-start mb-1">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <span className={cls.split(' ')[1]}>{icon}</span>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
};

const MaskBar = ({ label, pct, color }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-300">{pct}%</span>
    </div>
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  </div>
);

const PRO_TEST_MODE = false; // TEST MODE: Set to true to bypass blur/locks for testing detailed reports

const ProLockOverlay = ({ children, title, icon: Icon, onUnlock }) => {
  if (PRO_TEST_MODE) return <>{children}</>;
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 relative group overflow-hidden">
      {title && (
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-300 text-sm font-semibold flex items-center gap-2">
            {Icon && <Icon size={14} className="text-amber-400"/>} {title}
          </span>
          <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase italic">PREMIUM</span>
        </div>
      )}
      <div className="relative">
        <div className="blur-md opacity-20 pointer-events-none select-none transition-all">
          {children}
        </div>
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
           <button 
             onClick={onUnlock} 
             className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-xl shadow-amber-900/50 hover:scale-105 transition-transform text-[10px] uppercase"
           >
              <Lock size={12} /> Detayları Gör
           </button>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard({ analysisResult: r, isAnalyzing, analysisError, nearestSubstationKm, isFetchingSubstation }) {
  const [isExportingFree, setIsExportingFree] = useState(false);
  const [isExportingPro, setIsExportingPro] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  return (
    <div className="w-full md:w-96 bg-slate-900/95 backdrop-blur-md text-white h-auto md:h-full max-h-[45vh] md:max-h-none flex flex-col border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-slate-700/60 flex-shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Analiz Sonuçları
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          NASA POWER SATELLITE • MAPBOX TERRAIN • OSM NETWORK
        </p>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 text-sm font-bold animate-pulse">Analyzing Satellite Data...</p>
            <p className="text-slate-600 text-xs">NASA POWER & Mapbox Terrain-RGB</p>
          </div>
        )}

        {/* Error */}
        {!isAnalyzing && analysisError && (
          <div className="p-4 bg-red-900/30 border border-red-500/40 rounded-xl text-red-300 text-sm">
            <ShieldAlert size={16} className="inline mr-2" />{analysisError}
          </div>
        )}

        {/* Empty */}
        {!isAnalyzing && !analysisError && !r && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <MapPin className="text-slate-600" size={20} />
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Sol üstteki <span className="text-blue-400">⬠</span> araçla harita üzerinde bir alan çizin.
            </p>
            <p className="text-slate-600 text-xs mt-2">
              İstediğiniz kadar nokta ekleyip ilk noktaya tıklayarak kapatın.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 w-full text-xs">
              {[['🟢','Uygun Alan'],['🔴','Kuzey Bakı'],['🟠','Çok Dik (>15°)'],['⚫','Gölgeli']].map(([e,l])=>(
                <div key={l} className="flex items-center gap-2 text-slate-500 bg-slate-800/40 rounded-lg p-2">
                  <span>{e}</span><span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!isAnalyzing && r && (() => {
          const getSubstationPenalty = () => {
            if (isFetchingSubstation || nearestSubstationKm === undefined) return 1;
            if (nearestSubstationKm === null) return 0.4;
            if (nearestSubstationKm <= 5) return 1;
            if (nearestSubstationKm <= 10) return 0.8;
            return 0.5;
          };

          const substationPenalty = getSubstationPenalty();
          const penaltyMultiplier = substationPenalty * (r.landCover?.penalty ?? 1);
          const finalScore = Math.round(r.suitableRatioPct * penaltyMultiplier);
          const hasSubstationWarning = !isFetchingSubstation && nearestSubstationKm !== undefined && (nearestSubstationKm === null || nearestSubstationKm > 10);
          const isProtectedArea = r.landCover?.penalty === 0;

          const baseCost = Math.round(r.suitableAreaHa * 600000);
          const costPenaltyPct = (hasSubstationWarning || r.landCover?.rawVal === 11 || r.landCover?.rawVal === 14 || r.landCover?.rawVal === 20) ? 10 : 0;
          const finalCost = Math.round(baseCost * (1 + costPenaltyPct / 100));

          const payloadData = {
            score: finalScore,
            areaM2: Number(r.totalAreaM2),
            areaHa: r.totalAreaHa,
            elevation: r.avgElevationM,
            slope: r.avgSlopeDeg,
            radiation: r.avgSolarKWhM2 > 0 ? r.avgSolarKWhM2.toLocaleString('tr-TR') : 'Yetersiz',
            capacity: r.capacityMW,
            substation: nearestSubstationKm,
            landType: r.landCover?.label || 'Bilinmiyor',
            soil: r.soilConsistency || 'Bilinmiyor',
            mevzuat: r.mevzuatNotu?.text || null,
            finalCost: finalCost,
            penaltyPct: costPenaltyPct,
            monthlySolar: r.monthlySolar
          };

          return (
          <div id="dashboard-content" className="space-y-3 pb-4">
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  setIsExportingFree(true);
                  try {
                    const success = await exportToPDF(payloadData, 'aura-map-container', 'aura-barchart-container', false);
                    if (!success) alert("PDF oluşturulurken bir hata oluştu veya harita verileri yüklenemedi.");
                  } catch (err) {
                    console.error(err);
                    alert("PDF işlemi başarısız: " + err.message);
                  } finally {
                    setIsExportingFree(false);
                  }
                }}
                disabled={isExportingFree}
                className={`flex-1 bg-slate-800 hover:bg-slate-700 text-[11px] py-2.5 px-2 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-1 ${isExportingFree ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isExportingFree ? 'Hazırlanıyor...' : 'Ücretsiz Özet İndir'}
              </button>
              
                <button
                  onClick={async () => {
                    if (PRO_TEST_MODE) {
                      setIsExportingPro(true);
                      try {
                        await exportToPDF(payloadData, 'aura-map-container', 'aura-barchart-container', true);
                      } finally {
                        setIsExportingPro(false);
                      }
                    } else {
                      setShowPayment(true);
                    }
                  }}
                  disabled={isExportingPro}
                  className="flex-[1.5] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-[12px] py-2.5 px-2 rounded-xl font-bold shadow-lg shadow-amber-900/40 transition-all flex items-center justify-center gap-1 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-wait"
                >
                  <Download size={14}/> {isExportingPro ? 'Rapor İşleniyor...' : 'Detaylı Fizibilite Al'}
                </button>
            </div>

            {/* Suitable area hero */}
            <div className={`p-4 rounded-2xl border-2 text-center ${
              finalScore > 50 ? 'bg-emerald-500/10 border-emerald-500/40'
              : finalScore > 20 ? 'bg-yellow-500/10 border-yellow-500/40'
              : 'bg-red-500/10 border-red-500/40'
            }`}>
              <div className="flex justify-center items-center gap-2">
                <div className="text-3xl font-black font-mono">{finalScore}%</div>
                {substationPenalty < 1 && !isProtectedArea && (
                  <div className="flex items-center gap-1 text-xs text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <span className="font-bold">-{Math.round((1 - substationPenalty) * 100)}%</span>
                    <span>Şebeke Uzaklığı</span>
                  </div>
                )}
                {isProtectedArea && (
                  <div className="flex items-center gap-1 text-xs text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <span className="font-bold">İPTAL</span>
                    <span>Koruma Alanı</span>
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold mt-0.5">Yatırım Uygunluk Skoru</div>
              <div className="text-xs text-slate-400 mt-1">
                Fiziksel Alan: {Number(r.suitableAreaM2).toLocaleString('tr-TR')} m²  ({r.suitableAreaHa} ha)
              </div>
            </div>

            {/* Mask breakdown */}
            <div className="bg-slate-800/40 rounded-xl p-3 space-y-2.5">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert size={12} /> Maskeleme Analizi
              </p>
              <MaskBar label="🔴 Kuzey Bakı (0-45° & 315-360°)" pct={r.northPct}  color="bg-red-500" />
              <MaskBar label="🟠 Çok Dik Eğim (> 15°)"           pct={r.steepPct} color="bg-orange-500" />
              <MaskBar label="⚫ Topografik Gölge (Kış)"         pct={r.shadowPct} color="bg-slate-500" />
            </div>

            {/* Polygon info */}
            <Card label="Toplam Alan"       value={`${Number(r.totalAreaM2).toLocaleString('tr-TR')} m²`} sub={`${r.totalAreaHa} hektar · ${r.pointCount} köşe`} icon={<MapPin size={14}/>} accent="slate" />
            <Card label="Ortalama Yükseklik" value={`${r.avgElevationM} m`} sub="Kotu (SRTM)" icon={<Eye size={14}/>} accent="slate" />
            <Card label="Ortalama Eğim"     value={`${r.avgSlopeDeg}°`}
              sub={r.avgSlopeDeg < 5 ? 'Düz — ideal' : r.avgSlopeDeg < 10 ? 'Hafif eğimli' : r.avgSlopeDeg < 15 ? 'Eğimli' : 'Çok dik'}
              icon={<TrendingUp size={14}/>}
              accent={r.avgSlopeDeg < 10 ? 'green' : r.avgSlopeDeg < 15 ? 'yellow' : 'red'} />
            <Card label="Uygun Alanların Bakısı" value={aspectLabel(r.avgAspectDeg)} icon={<Sun size={14}/>} accent={r.avgAspectDeg>=135 && r.avgAspectDeg<=225 ? 'green' : 'orange'} />
            
            {r.avgSolarKWhM2 > 0 && (
              <Card label="1 Yıllık Toplam Radyasyon Özeti" value={`${r.avgSolarKWhM2.toLocaleString('tr-TR')} kWh/m²`} sub="Tilt & gölge düzeltmeli yıllık toplam" icon={<Sun size={14}/>} accent="yellow" />
            )}
            
            {/* Recharts BarChart (Locked in UI but exported in Pro PDF) */}
            {r.monthlySolar && r.monthlySolar.length > 0 && (
              <ProLockOverlay title="12 Aylık Üretim Potansiyeli" icon={Activity} onUnlock={() => setShowPayment(true)}>
                <div id="aura-barchart-container" className="h-40 w-full" style={{ backgroundColor: '#0f172a' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.monthlySolar} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fbbf24' }} formatter={(val) => [`${val} kWh/m²`, 'Üretim']} labelStyle={{ color: '#cbd5e1', marginBottom: '4px', fontWeight: 'bold' }}/>
                      <Bar dataKey="kWhM2Month" radius={[4, 4, 0, 0]}>
                        {r.monthlySolar.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.kWhM2Month > 140 ? '#f59e0b' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ProLockOverlay>
            )}

            <ProLockOverlay title="Tahmini Kapasite & Yatırım" icon={Zap} onUnlock={() => setShowPayment(true)}>
              <div className="grid grid-cols-2 gap-3">
                <Card label="Kapasite (Tahmini)" value={`${r.capacityMW} MW`} sub="~1 MW / Ha" icon={<Zap size={12}/>} accent="purple" />
                <Card label="Tahmini Yatırım" value={`$${(finalCost/1000000).toFixed(1)}M`} sub={`${costPenaltyPct > 0 ? '+%10 İzin Payı' : 'Genel Ortalama'}`} icon={<DollarSign size={12}/>} accent={costPenaltyPct > 0 ? "yellow" : "green"} />
              </div>
            </ProLockOverlay>
            
            <ProLockOverlay title="Arazi & Zemin Türü" icon={MapPin} onUnlock={() => setShowPayment(true)}>
              <Card
                label="Mevcut Kullanım"
                value={r.landCover?.label || 'Bilinmiyor'}
                sub={r.soilConsistency || 'Veri Yok'}
                icon={<MapPin size={12}/>}
                accent={isProtectedArea ? 'red' : (r.landCover?.level === 'warning' ? 'yellow' : r.landCover?.level === 'ideal' ? 'green' : 'slate')}
              />
            </ProLockOverlay>

            <ProLockOverlay title="Mevzuat & İzin Analizi" icon={ShieldAlert} onUnlock={() => setShowPayment(true)}>
              {r.mevzuatNotu && (
                <div className={`border rounded-xl p-3 text-xs leading-relaxed ${r.mevzuatNotu.banner}`}>
                  <div className="font-black mb-1">{r.mevzuatNotu.icon} SONUÇ: {r.mevzuatNotu.prefix}</div>
                  <div>{r.mevzuatNotu.text}</div>
                </div>
              )}
            </ProLockOverlay>

            {/* Nearest Substation */}
            {(isFetchingSubstation || nearestSubstationKm !== undefined) && (
              <ProLockOverlay title="Şebeke ve Trafo Mesafesi" icon={Cable} onUnlock={() => setShowPayment(true)}>
                <div className={`border rounded-xl p-3 ${
                  isFetchingSubstation ? 'border-slate-600/40' : nearestSubstationKm === null ? 'border-slate-600/40' : nearestSubstationKm <= 5 ? 'border-emerald-500/30' : nearestSubstationKm <= 10 ? 'border-yellow-500/30' : 'border-red-500/30'
                }`}>
                  <div className="flex items-baseline gap-2">
                    {isFetchingSubstation ? (
                      <span className="text-xl font-bold font-mono animate-pulse">Aranıyor...</span>
                    ) : (
                      <>
                        <span className={`text-xl font-black font-mono ${nearestSubstationKm > 10 || nearestSubstationKm === null ? 'text-red-400' : 'text-blue-400'}`}>
                          {nearestSubstationKm || '15+'} <span className="text-sm">km</span>
                        </span>
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Kuş Uçuşu</span>
                      </>
                    )}
                  </div>
                </div>
              </ProLockOverlay>
            )}

            {/* Verdict */}
            <ProLockOverlay title="Yatırım Karar Özeti (Verdict)" icon={Activity} onUnlock={() => setShowPayment(true)}>
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isProtectedArea ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : finalScore > 40 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
              }`}>
                {isProtectedArea
                  ? `Kritik Uyarı: GES kurulumu mevzuat gereği bu alanda yapılamaz.`
                  : finalScore > 40
                  ? '✅ Bu alan GES kurulumu için yüksek potansiyel taşımaktadır.'
                  : '⚠️ Saha verileri yatırım için kısıtlı uygunluk göstermektedir.'}
              </div>
            </ProLockOverlay>

          </div>
          );
        })()}

        {/* PAYMENT OVERLAY MODAL */}
        {showPayment && r && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button onClick={() => setShowPayment(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4 mx-auto border border-amber-500/30">
                <Lock size={26} />
              </div>
              <h3 className="text-xl font-bold text-center text-white mb-2">Profesyonel Rapor</h3>
              <p className="text-sm text-slate-300 text-center mb-6 leading-relaxed">
                Bu detaylı analiz raporu <strong className="text-amber-400">750 TL + KDV</strong> karşılığında profesyonel ekibimiz tarafından doğrulanarak, imzalı PDF formatında tarafınıza anında iletilir.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => window.open('https://wa.me/905055621024')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 transform active:scale-95 text-sm"
                >
                  <Zap className="fill-current" size={16} /> Ödemeye Geç (WhatsApp)
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="p-3 border-t border-slate-800 flex-shrink-0 text-center">
        <p className="text-slate-700 text-[10px] uppercase font-bold tracking-widest">GES Analysis Engine v2.0</p>
      </div>
    </div>
  );
}
