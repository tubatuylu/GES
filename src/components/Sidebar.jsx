import React from 'react';
import { Layers, Thermometer, Sun, Wind } from 'lucide-react';

const Sidebar = ({ layers, toggleLayer }) => {
  return (
    <div className="w-full md:w-80 bg-slate-900 text-white h-auto md:h-full max-h-[30vh] md:max-h-none flex flex-col border-b md:border-b-0 md:border-r border-slate-700 shadow-xl overflow-y-auto shrink-0">
      <div className="p-4 md:p-6 border-b border-slate-700 shrink-0">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          GES Analiz
        </h1>
        <p className="text-slate-400 text-sm mt-1">Güneş Enerjisi Santrali Potansiyel Analizi</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
            Analiz Katmanları
          </h2>
          <div className="space-y-2">
            <LayerToggle 
              id="dem" 
              label="DEM (Yükseklik)" 
              icon={<Layers size={18} />} 
              active={layers.dem} 
              onToggle={() => toggleLayer('dem')} 
            />
            <LayerToggle 
              id="slope" 
              label="Slope (Eğim)" 
              icon={<Thermometer size={18} />} 
              active={layers.slope} 
              onToggle={() => toggleLayer('slope')} 
            />
            <LayerToggle 
              id="aspect" 
              label="Aspect (Bakı)" 
              icon={<Sun size={18} />} 
              active={layers.aspect} 
              onToggle={() => toggleLayer('aspect')} 
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-700">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
            Proje Bilgileri
          </h2>
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
            <p>Seçilen alanı analiz etmek için harici araçları kullanarak bir poligon çizin.</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          Sistem Aktif
        </div>
      </div>
    </div>
  );
};

const LayerToggle = ({ id, label, icon, active, onToggle }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
        : 'hover:bg-slate-800 text-slate-400 border border-transparent'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`${active ? 'text-blue-400' : 'text-slate-500'}`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </div>
    <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${active ? 'bg-blue-600' : 'bg-slate-700'}`}>
      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${active ? 'translate-x-5' : ''}`}></div>
    </div>
  </button>
);

export default Sidebar;
