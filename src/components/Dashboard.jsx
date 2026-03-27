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

const PRO_TEST_MODE = true; // TEST MODE: Set to true to bypass blur/locks for testing detailed reports

const ProLockOverlay = ({ children, onUnlock }) => {
  if (PRO_TEST_MODE) return <>{children}</>;
  return (
    <div className="relative group overflow-hidden rounded-xl">
      <div className="blur-sm opacity-50 pointer-events-none select-none transition-all">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 opacity-90 transition-colors">
         <button onClick={onUnlock} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-lg shadow-xl shadow-amber-900/50 hover:scale-105 transition-transform text-xs">
            <Lock size={14} /> Profesyonel Raporla Kilidi Aç
         </button>
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
              <ProLockOverlay onUnlock={() => setShowPayment(true)}>
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-300 text-sm font-semibold flex items-center gap-2"><Activity size={14} className="text-amber-400"/> 12 Aylık Üretim Potansiyeli</span>
                    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">kWh/m²</span>
                  </div>
                  <div id="aura-barchart-container" className="h-44 w-full" style={{ backgroundColor: '#0f172a' }}>
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
                </div>
              </ProLockOverlay>
            )}

            <ProLockOverlay onUnlock={() => setShowPayment(true)}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Card label="Tahmini Kapasite" value={`${r.capacityMW} MW`} sub="~1 MW/ha" icon={<Zap size={14}/>} accent="purple" />
                <Card label="Tahmini Yatırım" value={`$${(finalCost/1000000).toFixed(1)}M`} sub={`${costPenaltyPct > 0 ? '+%10 İzin Payı' : 'Genel Ortalama'}`} icon={<DollarSign size={14}/>} accent={costPenaltyPct > 0 ? "yellow" : "green"} />
              </div>
            </ProLockOverlay>
            
            <ProLockOverlay onUnlock={() => setShowPayment(true)}>
              <Card
                label="Arazi & Zemin Türü"
                value={r.landCover?.label || 'Bilinmiyor'}
                sub={r.soilConsistency || 'Veri Yok'}
                icon={<MapPin size={14}/>}
                accent={isProtectedArea ? 'red' : (r.landCover?.level === 'warning' ? 'yellow' : r.landCover?.level === 'ideal' ? 'green' : 'slate')}
              />
            </ProLockOverlay>
            <ProLockOverlay onUnlock={() => setShowPayment(true)}>
              {r.mevzuatNotu && (
                <div className={`border rounded-xl p-3 text-xs leading-relaxed ${r.mevzuatNotu.banner}`}>
                  <div className="font-black mb-1">{r.mevzuatNotu.icon} MEVZUAT NOTU: {r.mevzuatNotu.prefix}</div>
                  <div>{r.mevzuatNotu.text}</div>
                  {r.landCover?.costImpactPct > 0 && (
                    <div className="mt-1.5 font-semibold border-t border-current/20 pt-1.5">
                      💰 Maliyet Etkisi: Tahmini yatırım maliyetine +%{r.landCover.costImpactPct} İzin & Bürokrasi Payı eklenmesi önerilir.
                    </div>
                  )}
                </div>
              )}
            </ProLockOverlay>

            {/* Nearest Substation */}
            {(isFetchingSubstation || nearestSubstationKm !== undefined) && (
              <ProLockOverlay onUnlock={() => setShowPayment(true)}>
                <div className={`border rounded-xl p-3 bg-slate-800/40 ${
                  isFetchingSubstation
                    ? 'border-slate-600/40'
                    : nearestSubstationKm === null
                      ? 'border-slate-600/40'
                      : nearestSubstationKm <= 5
                        ? 'border-emerald-500/30'
                        : nearestSubstationKm <= 10
                          ? 'border-yellow-500/30'
                          : 'border-red-500/30'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 font-bold text-sm text-slate-300">
                      <Cable size={14} className={
                        isFetchingSubstation ? "text-slate-400" :
                        nearestSubstationKm === null ? "text-slate-400" : 
                        nearestSubstationKm > 10 ? "text-red-400" : "text-blue-400"
                      } />
                      Şebeke ve Trafo Mesafesi
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    {isFetchingSubstation ? (
                      <span className="text-xl font-bold font-mono animate-pulse">Aranıyor...</span>
                    ) : nearestSubstationKm === null ? (
                      <span className="text-sm font-bold text-slate-400">15km dahilinde trafo bulunamadı.</span>
                    ) : (
                      <>
                        <span className={`text-xl font-black font-mono ${nearestSubstationKm > 10 ? 'text-red-400' : 'text-blue-400'}`}>
                          {nearestSubstationKm} <span className="text-sm">km</span>
                        </span>
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mesafe</span>
                      </>
                    )}
                  </div>
                </div>
              </ProLockOverlay>
            )}

            {/* Verdict */}
            <ProLockOverlay onUnlock={() => setShowPayment(true)}>
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isProtectedArea ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : hasSubstationWarning ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : finalScore > 40 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : finalScore > 15 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {isProtectedArea
                  ? `Kritik Uyarı: ${r.landCover?.type || 'Korunacak Alan'} tespit edildi. (${r.landCover?.warning}) GES kurulumu mevzuat gereği yapılamaz.`
                  : hasSubstationWarning
                  ? 'Dikkat: Yakınlarda trafo merkezi bulunamadı veya mesafe >10km. Şebeke bağlantı maliyeti yatırımın fizibilitesini imkansız kılabilir.'
                  : finalScore > 40
                  ? '✅ Bu alan GES kurulumu için yüksek potansiyel taşımaktadır. Topoğrafya ve şebeke durumu uygun.'
                  : finalScore > 15
                  ? '⚠️ Alan kısmen uygun. Kuzey yamaçlar, dik bölgeler veya şebeke uzaklığı fizibiliteyi zorluyor.'
                  : '❌ Alanın büyük bölümü topoğrafik engeller veya şebeke bağlantı yetersizliği nedeniyle uygun değil.'}
                {r.landCover?.warning && !isProtectedArea && (
                  <div className="mt-2 text-yellow-400 font-semibold border-t border-yellow-500/20 pt-2">
                    ⚠️ Ek Not: {r.landCover.warning}
                  </div>
                )}
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
                  onClick={async () => {
                    setIsExportingPro(true);
                    try {
                      const baseC = Math.round(r.suitableAreaHa * 600000);
                      const cPenalty = (!isFetchingSubstation && nearestSubstationKm !== undefined && (nearestSubstationKm === null || nearestSubstationKm > 10) || r.landCover?.rawVal === 11 || r.landCover?.rawVal === 14 || r.landCover?.rawVal === 20) ? 10 : 0;
                      const subPen = nearestSubstationKm === null ? 0.4 : (nearestSubstationKm > 10 ? 0.6 : (nearestSubstationKm > 5 ? 0.9 : 1));
                      const fnScore = Math.round(r.suitableRatioPct * (subPen * (r.landCover?.penalty ?? 1)));
                      
                      const payload = {
                        score: fnScore,
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
                        finalCost: Math.round(baseC * (1 + cPenalty / 100)),
                        penaltyPct: cPenalty,
                        monthlySolar: r.monthlySolar
                      };
                      
                      const success = await exportToPDF(payload, 'aura-map-container', 'aura-barchart-container', true);
                      if (!success) alert("PDF oluşturulurken bir hata oluştu veya harita verileri yüklenemedi.");
                      else setShowPayment(false);
                    } catch (err) {
                      console.error(err);
                      alert("PDF işlemi başarısız: " + err.message);
                    } finally {
                      setIsExportingPro(false);
                    }
                  }}
                  disabled={isExportingPro}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  {isExportingPro ? <span className="animate-pulse">Rapor İşleniyor...</span> : <>Ödemeye Geç <span className="text-[10px] font-semibold opacity-75">(Demo: PDF Üret)</span></>}
                </button>
                <button 
                  onClick={() => window.open('https://wa.me/905055621024')}
                  className="w-full py-3 px-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/50 text-[#25D366] font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  WhatsApp ile İletişime Geç
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
