import React from 'react';
import {
  Layers, Thermometer, Sun, Search, Navigation, Map as MapIcon,
  CheckCircle, AlertCircle, Loader2, RotateCcw, ChevronRight,
  SquareStack, MapPin, Ruler, FileText,
} from 'lucide-react';
import { tkgmService } from '../services/tkgmService';

// ─── Main Sidebar ──────────────────────────────────────────────────────────────
const Sidebar = ({ layers, toggleLayer, onParcelSelected }) => {
  const [activeTab, setActiveTab] = React.useState('layers');

  // ── Parcel search state ──
  const [cities, setCities] = React.useState([]);
  const [districts, setDistricts] = React.useState([]);
  const [neighborhoods, setNeighborhoods] = React.useState([]);

  const [selectedCity, setSelectedCity] = React.useState('');
  const [selectedDistrict, setSelectedDistrict] = React.useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = React.useState('');
  const [ada, setAda] = React.useState('');
  const [parsel, setParsel] = React.useState('');

  const [loadingStep, setLoadingStep] = React.useState(null); // 'cities' | 'districts' | 'neighborhoods' | 'parcel'
  const [error, setError] = React.useState(null);
  const [parcelResult, setParcelResult] = React.useState(null); // raw Feature from TKGM

  // ── Load cities on first open ──
  React.useEffect(() => {
    if (activeTab === 'search' && cities.length === 0) loadCities();
  }, [activeTab]);

  const loadCities = async () => {
    setLoadingStep('cities');
    setError(null);
    try {
      const list = await tkgmService.getCities();
      if (!list.length) throw new Error('İl listesi boş döndü.');
      setCities(list.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')));
    } catch (err) {
      setError('İl listesi alınamadı: ' + err.message);
    } finally {
      setLoadingStep(null);
    }
  };

  const handleCityChange = async (val) => {
    setSelectedCity(val);
    setSelectedDistrict('');
    setSelectedNeighborhood('');
    setDistricts([]);
    setNeighborhoods([]);
    setParcelResult(null);
    setError(null);
    if (!val) return;
    setLoadingStep('districts');
    try {
      const list = await tkgmService.getDistricts(val);
      setDistricts(list.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')));
    } catch (err) {
      setError('İlçe listesi alınamadı: ' + err.message);
    } finally {
      setLoadingStep(null);
    }
  };

  const handleDistrictChange = async (val) => {
    setSelectedDistrict(val);
    setSelectedNeighborhood('');
    setNeighborhoods([]);
    setParcelResult(null);
    setError(null);
    if (!val) return;
    setLoadingStep('neighborhoods');
    try {
      const list = await tkgmService.getNeighborhoods(val);
      setNeighborhoods(list.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')));
    } catch (err) {
      setError('Mahalle listesi alınamadı: ' + err.message);
    } finally {
      setLoadingStep(null);
    }
  };

  const handleSearch = async () => {
    if (!selectedNeighborhood || !ada.trim() || !parsel.trim()) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    setError(null);
    setParcelResult(null);
    setLoadingStep('parcel');
    try {
      const feature = await tkgmService.getParcelGeometry(
        selectedNeighborhood, ada.trim(), parsel.trim()
      );
      setParcelResult(feature);
      if (onParcelSelected) onParcelSelected(feature);
    } catch (err) {
      setError(err.message || 'Parsel bulunamadı.');
    } finally {
      setLoadingStep(null);
    }
  };

  const handleReset = () => {
    setParcelResult(null);
    setAda('');
    setParsel('');
    setError(null);
  };

  const isSearching = loadingStep === 'parcel';
  const isLoadingDropdown = loadingStep && loadingStep !== 'parcel';
  const canSearch = selectedNeighborhood && ada.trim() && parsel.trim() && !isSearching;

  return (
    <div className="w-full md:w-80 bg-slate-900 text-white h-auto md:h-full max-h-[30vh] md:max-h-none flex flex-col border-b md:border-b-0 md:border-r border-slate-700 shadow-xl overflow-y-auto shrink-0">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-700 shrink-0">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          GES Analiz
        </h1>
        <p className="text-slate-400 text-sm mt-1">Güneş Enerjisi Santrali Potansiyel Analizi</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 shrink-0">
        <TabButton active={activeTab === 'layers'} onClick={() => setActiveTab('layers')}>
          Katmanlar
        </TabButton>
        <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
          Parsel Sorgu
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'layers' ? (
          <LayersTab layers={layers} toggleLayer={toggleLayer} />
        ) : (
          <ParselTab
            cities={cities}
            districts={districts}
            neighborhoods={neighborhoods}
            selectedCity={selectedCity}
            selectedDistrict={selectedDistrict}
            selectedNeighborhood={selectedNeighborhood}
            ada={ada}
            parsel={parsel}
            loadingStep={loadingStep}
            isLoadingDropdown={isLoadingDropdown}
            isSearching={isSearching}
            canSearch={canSearch}
            error={error}
            parcelResult={parcelResult}
            onCityChange={handleCityChange}
            onDistrictChange={handleDistrictChange}
            onNeighborhoodChange={setSelectedNeighborhood}
            onAdaChange={setAda}
            onParselChange={setParsel}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Status Footer */}
      <div className="p-4 bg-slate-950 border-t border-slate-700 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Sistem Aktif
          {isLoadingDropdown && (
            <span className="ml-auto text-amber-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> TKGM bağlanılıyor...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tab Button ────────────────────────────────────────────────────────────────
const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
      active
        ? 'border-amber-500 text-amber-500'
        : 'border-transparent text-slate-500 hover:text-slate-300'
    }`}
  >
    {children}
  </button>
);

// ─── Layers Tab ────────────────────────────────────────────────────────────────
const LayersTab = ({ layers, toggleLayer }) => (
  <>
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
        Analiz Katmanları
      </h2>
      <div className="space-y-2">
        <LayerToggle id="dem" label="DEM (Yükseklik)" icon={<Layers size={18} />} active={layers.dem} onToggle={() => toggleLayer('dem')} />
        <LayerToggle id="slope" label="Slope (Eğim)" icon={<Thermometer size={18} />} active={layers.slope} onToggle={() => toggleLayer('slope')} />
        <LayerToggle id="aspect" label="Aspect (Bakı)" icon={<Sun size={18} />} active={layers.aspect} onToggle={() => toggleLayer('aspect')} />
      </div>
    </div>
    <div className="pt-2 border-t border-slate-700">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
        Proje Bilgileri
      </h2>
      <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
        <p>
          Harita üzerinden{' '}
          <span className="text-amber-500 font-bold">manuel çizim</span> yapabilir veya{' '}
          <span className="text-blue-400 font-bold">Parsel Sorgu</span> sekmesini kullanarak
          resmi TKGM verilerini çekebilirsiniz.
        </p>
      </div>
    </div>
  </>
);

// ─── Parsel Tab ────────────────────────────────────────────────────────────────
const ParselTab = ({
  cities, districts, neighborhoods,
  selectedCity, selectedDistrict, selectedNeighborhood,
  ada, parsel,
  loadingStep, isLoadingDropdown, isSearching, canSearch,
  error, parcelResult,
  onCityChange, onDistrictChange, onNeighborhoodChange,
  onAdaChange, onParselChange, onSearch, onReset,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <MapIcon size={13} /> TKGM Parsel Sorgulama
      </h2>
      {parcelResult && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
        >
          <RotateCcw size={10} /> Sıfırla
        </button>
      )}
    </div>

    {/* ── Cascading Dropdowns ── */}
    <div className="space-y-3">
      <SelectField
        label="İl"
        value={selectedCity}
        onChange={onCityChange}
        options={cities}
        placeholder={loadingStep === 'cities' ? 'Yükleniyor...' : 'İl Seçiniz'}
        disabled={loadingStep === 'cities'}
      />
      <SelectField
        label="İlçe"
        value={selectedDistrict}
        onChange={onDistrictChange}
        options={districts}
        placeholder={loadingStep === 'districts' ? 'Yükleniyor...' : 'İlçe Seçiniz'}
        disabled={!selectedCity || loadingStep === 'districts'}
      />
      <SelectField
        label="Mahalle / Köy"
        value={selectedNeighborhood}
        onChange={onNeighborhoodChange}
        options={neighborhoods}
        placeholder={loadingStep === 'neighborhoods' ? 'Yükleniyor...' : 'Mahalle Seçiniz'}
        disabled={!selectedDistrict || loadingStep === 'neighborhoods'}
      />

      {/* Ada / Parsel */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Ada No</label>
          <input
            type="text"
            inputMode="numeric"
            value={ada}
            onChange={(e) => onAdaChange(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && canSearch && onSearch()}
            placeholder="örn. 123"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Parsel No</label>
          <input
            type="text"
            inputMode="numeric"
            value={parsel}
            onChange={(e) => onParselChange(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && canSearch && onSearch()}
            placeholder="örn. 45"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-xs leading-relaxed">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Button */}
      <button
        onClick={onSearch}
        disabled={!canSearch}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 font-bold rounded-xl shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 mt-2"
      >
        {isSearching ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Parsel Aranıyor...
          </>
        ) : (
          <>
            <Navigation size={16} />
            Haritada Bul ve Analiz Et
          </>
        )}
      </button>
    </div>

    {/* ── Parcel Result Card ── */}
    {parcelResult && (
      <ParcelResultCard feature={parcelResult} />
    )}

    {/* Info Note */}
    {!parcelResult && (
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
        <p className="text-[11px] text-slate-400 leading-relaxed italic">
          * Bu özellik TKGM MEGSİS üzerinden canlı kadastro verisi çeker. Ada/parsel numarasını
          bilmiyorsanız haritadan manuel çizim yapabilirsiniz.
        </p>
      </div>
    )}
  </div>
);

// ─── Parcel Result Card ────────────────────────────────────────────────────────
const ParcelResultCard = ({ feature }) => {
  const p = feature?.properties ?? {};

  // Normalize the various field names Megsis v3 may return
  const adaNo    = p.ada     || p.adaNo     || p.ADA_NO    || '—';
  const parselNo = p.parsel  || p.parselNo  || p.PARSEL_NO || '—';
  const alan     = p.alan    || p.ALAN      || p.yuzolcumu || null;
  const nitelik  = p.nitelik || p.NITELIK   || p.landType  || null;
  const mevkii   = p.mevkii  || p.MEVKII    || p.il_ilce   || null;
  const tasinmaz = p.tasinmazNo || p.TASINMAZ_NO || null;

  const alanStr = alan
    ? `${Number(alan).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²`
    : null;

  return (
    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-emerald-400 shrink-0" />
        <span className="text-emerald-400 text-sm font-bold">Parsel Bulundu</span>
        <span className="ml-auto text-[10px] text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
          MEGSİS v3
        </span>
      </div>

      {/* Properties grid */}
      <div className="grid grid-cols-2 gap-2">
        <InfoChip icon={<SquareStack size={12} />} label="Ada No" value={adaNo} />
        <InfoChip icon={<SquareStack size={12} />} label="Parsel No" value={parselNo} />
        {alanStr && <InfoChip icon={<Ruler size={12} />} label="Alan" value={alanStr} wide />}
        {nitelik && <InfoChip icon={<FileText size={12} />} label="Nitelik" value={nitelik} wide />}
        {mevkii && <InfoChip icon={<MapPin size={12} />} label="Mevkii" value={mevkii} wide />}
        {tasinmaz && <InfoChip icon={<FileText size={12} />} label="Taşınmaz No" value={tasinmaz} wide />}
      </div>

      {/* Hint */}
      <p className="text-[11px] text-emerald-700/80 border-t border-emerald-500/20 pt-2 mt-1">
        ✅ Parsel sınırı haritada gösterildi ve analiz başlatıldı.
      </p>
    </div>
  );
};

const InfoChip = ({ icon, label, value, wide }) => (
  <div className={`bg-slate-800/60 rounded-lg p-2.5 ${wide ? 'col-span-2' : ''}`}>
    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase mb-1">
      {icon} {label}
    </div>
    <div className="text-xs text-slate-200 font-mono truncate" title={String(value)}>
      {value}
    </div>
  </div>
);

// ─── Layer Toggle ──────────────────────────────────────────────────────────────
const LayerToggle = ({ label, icon, active, onToggle }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
      active
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
        : 'hover:bg-slate-800 text-slate-400 border border-transparent'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={active ? 'text-blue-400' : 'text-slate-500'}>{icon}</div>
      <span className="font-medium">{label}</span>
    </div>
    <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${active ? 'bg-blue-600' : 'bg-slate-700'}`}>
      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${active ? 'translate-x-5' : ''}`} />
    </div>
  </button>
);

// ─── Select Field ──────────────────────────────────────────────────────────────
const SelectField = ({ label, value, onChange, options, placeholder, disabled }) => (
  <div className="space-y-1">
    <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !options.length}
        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.ad}</option>
        ))}
      </select>
      <ChevronRight size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" />
    </div>
  </div>
);

export default Sidebar;
