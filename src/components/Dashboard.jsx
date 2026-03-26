import React from 'react';
import { Activity, MapPin, TrendingUp, Sun, Zap, ShieldAlert, Eye, Cable } from 'lucide-react';

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

export default function Dashboard({ analysisResult: r, isAnalyzing, analysisError, nearestSubstationKm, isFetchingSubstation }) {
  return (
    <div className="w-full md:w-96 bg-slate-900/95 backdrop-blur-md text-white h-auto md:h-full max-h-[45vh] md:max-h-none flex flex-col border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-slate-700/60 flex-shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Analiz Sonuçları
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
<<<<<<< HEAD
          Gerçek SRTM verisi • Horn algoritması • OSM Overpass
=======
          NASA POWER SATELLITE • MAPBOX TERRAIN • OSM NETWORK
>>>>>>> c674b8d (Professional GIS Analysis Engine Integration)
        </p>
      </div>

      <div className="flex-1 p-4 space-y-3">

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
<<<<<<< HEAD
            <p className="text-slate-400 text-sm">Yükseklik verileri alınıyor…</p>
            <p className="text-slate-600 text-xs">Eğim ve bakı hesaplanıyor</p>
=======
            <p className="text-blue-400 text-sm font-bold animate-pulse">Analyzing Satellite Data...</p>
            <p className="text-slate-600 text-xs">NASA POWER & Mapbox Terrain-RGB</p>
>>>>>>> c674b8d (Professional GIS Analysis Engine Integration)
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
        {!isAnalyzing && r && (
          <>
            {/* Suitable area hero */}
            <div className={`p-4 rounded-2xl border-2 text-center ${
              r.suitableRatioPct > 50 ? 'bg-emerald-500/10 border-emerald-500/40'
              : r.suitableRatioPct > 20 ? 'bg-yellow-500/10 border-yellow-500/40'
              : 'bg-red-500/10 border-red-500/40'
            }`}>
              <div className="text-3xl font-black font-mono">{r.suitableRatioPct}%</div>
              <div className="text-sm font-semibold mt-0.5">Uygun Alan</div>
              <div className="text-xs text-slate-400 mt-1">
                {Number(r.suitableAreaM2).toLocaleString('tr-TR')} m²  ({r.suitableAreaHa} ha)
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
              <Card label="Düzeltilmiş Güneş Radyasyonu" value={`${r.avgSolarKWhM2} kWh/m²`} sub="Tilt & gölge düzeltmeli" icon={<Sun size={14}/>} accent="yellow" />
            )}
            <Card label="Tahmini Kapasite" value={`${r.capacityMW} MW`} sub="~1 MW/ha varsayımı" icon={<Zap size={14}/>} accent="purple" />

            {/* Nearest Substation */}
            {(isFetchingSubstation || nearestSubstationKm !== undefined) && (
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
                <div className="flex justify-between items-start mb-1">
                  <span className="text-slate-400 text-xs font-medium">En Yakın Trafo</span>
                  <Cable size={14} className={`${
                    isFetchingSubstation ? 'text-slate-500 animate-pulse'
                    : nearestSubstationKm === null ? 'text-slate-500'
                    : nearestSubstationKm <= 5 ? 'text-emerald-400'
                    : nearestSubstationKm <= 10 ? 'text-yellow-400'
                    : 'text-red-400'
                  }`} />
                </div>
                {isFetchingSubstation ? (
                  <div className="text-sm font-mono text-slate-500 animate-pulse">Sorgulanıyor…</div>
                ) : nearestSubstationKm === null ? (
                  <>
                    <div className="text-xl font-bold font-mono text-slate-400">—</div>
<<<<<<< HEAD
                    <div className="text-xs text-slate-500 mt-0.5">10 km içinde trafo bulunamadı</div>
=======
                    <div className="text-xs text-slate-500 mt-0.5">15 km dahilinde trafo bulunamadı</div>
>>>>>>> c674b8d (Professional GIS Analysis Engine Integration)
                  </>
                ) : (
                  <>
                    <div className={`text-xl font-bold font-mono ${
                      nearestSubstationKm <= 5 ? 'text-emerald-400'
                      : nearestSubstationKm <= 10 ? 'text-yellow-400'
                      : 'text-red-400'
                    }`}>{nearestSubstationKm} km</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {nearestSubstationKm <= 5
                        ? '✅ Çok yakın — bağlantı avantajlı'
                        : nearestSubstationKm <= 10
                          ? '⚠️ Orta mesafe'
                          : '❌ Uzak — yüksek bağlantı maliyeti'}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Verdict */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              r.suitableRatioPct > 40 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : r.suitableRatioPct > 15 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {r.suitableRatioPct > 40
                ? '✅ Bu alan GES kurulumu için yüksek potansiyel taşımaktadır. Uygun alanlar haritalandırıldı.'
                : r.suitableRatioPct > 15
                ? '⚠️ Alan kısmen uygun. Kuzey yamaçlar ve dik bölgeler filtrelendi.'
                : '❌ Alanın büyük bölümü kuzey bakı, dik eğim veya gölge nedeniyle uygun değil.'}
            </div>
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-800 flex-shrink-0 text-center">
        <p className="text-slate-700 text-[10px] uppercase font-bold tracking-widest">GES Analysis Engine v2.0</p>
      </div>
    </div>
  );
}
