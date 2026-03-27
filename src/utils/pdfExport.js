import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';
import html2canvas from 'html2canvas';

const trToEn = (str) => {
  if (!str) return '';
  return str.replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
            .replace(/I/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
};

export async function exportToPDF(data, mapElementId, chartElementId, isPro = false) {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const drawWatermark = () => {
      pdf.saveGraphicsState();
      pdf.setGState(new pdf.GState({ opacity: 0.04 }));
      pdf.setFontSize(130);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("AURASOL", pdfW / 2, pdfH / 2 + 30, { angle: 45, align: 'center' });
      pdf.restoreGraphicsState();
    };

    // 0. WATERMARK INITIAL
    drawWatermark();

    // 1. HEADER
    pdf.setFillColor(15, 23, 42); 
    pdf.rect(0, 0, pdfW, 30, 'F');
    
    // Draw Sun Logo
    pdf.setFillColor(250, 204, 21);
    pdf.circle(18, 15, 3, 'F');
    pdf.setDrawColor(250, 204, 21);
    pdf.setLineWidth(0.6);
    for(let i=0; i<8; i++) {
       const ang = (i * 45) * Math.PI / 180;
       const x1 = 18 + Math.cos(ang) * 4.2;
       const y1 = 15 + Math.sin(ang) * 4.2;
       const x2 = 18 + Math.cos(ang) * 6.5;
       const y2 = 15 + Math.sin(ang) * 6.5;
       pdf.line(x1, y1, x2, y2);
    }
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(`AuraSol Dijital On Fizibilite Raporu${isPro ? ' (PRO)' : ''}`, 29, 17);
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleString('tr-TR');
    pdf.text(`Tarih: ${dateStr}`, 15, 24);
    if (isPro) {
      pdf.setTextColor(250, 204, 21); // amber-400
      pdf.text("Durum: PROFESYONEL ONAYLI BELGE", pdfW - 75, 24);
    } else {
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text("Durum: UCRETSIZ TEMEL OZET", pdfW - 65, 24);
    }

    let currentY = 40;

    // 2. MAP IMAGE
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    
    if (isPro) {
      pdf.text(trToEn("1. COGRAFI VE TOPOGRAFIK ANALIZ"), 15, currentY);
      currentY += 8;
      const mapsEl = document.getElementById('pro-export-maps-row');
      if (mapsEl) {
        try {
          // Wait longer for tiles to load (crucial for Leaflet)
          await new Promise(r => setTimeout(r, 4000));
          const { toPng } = await import('html-to-image');
          const mapsImg = await toPng(mapsEl, { 
            quality: 0.9, 
            backgroundColor: '#f1f5f9', 
            pixelRatio: 1.2,
            cacheBust: true
          });
          const imgH = (pdfW - 30) / 4; 
          pdf.addImage(mapsImg, 'PNG', 15, currentY, pdfW - 30, imgH);
          currentY += imgH + 15;
        } catch (mapErr) {
          console.error("Map Capture Error (Skipping maps):", mapErr);
          pdf.setFontSize(8);
          pdf.setTextColor(150, 0, 0);
          pdf.text("HARITA VERILERI YUKLENEMEDI - BAGLANTI HATASI", 15, currentY + 5);
          currentY += 15;
          pdf.setTextColor(30, 41, 59);
        }
      }
    } else {
      pdf.text("1. Bolge ve Cografi Koordinat Analizi", 15, currentY);
      currentY += 8;
      const mapEl = document.getElementById(mapElementId);
      if (mapEl) {
        try {
          const { toJpeg } = await import('html-to-image');
          const mapImg = await toJpeg(mapEl, { quality: 0.8, backgroundColor: '#f1f5f9' });
          pdf.addImage(mapImg, 'JPEG', 15, currentY, pdfW - 30, 85);
        } catch (e) { console.error("Free map capture failed", e); }
      }
      currentY += 95;
    }

    // 3. TABLE
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 41, 59);
    pdf.text("2. Teknik ve Finansal Degerlendirme Ozeti", 15, currentY);
    currentY += 8;

    const startX = 15;
    const col1W = 65;
    const padding = 5;

    const drawRow = (label, val, isHighlightRow = false) => {
      pdf.setDrawColor(203, 213, 225); 
      pdf.setFillColor(248, 250, 252); 
      pdf.rect(startX, currentY, col1W, 10, 'FD'); 
      
      pdf.setFillColor(isHighlightRow ? 254 : 255, isHighlightRow ? 242 : 255, isHighlightRow ? 242 : 255); 
      pdf.rect(startX + col1W, currentY, pdfW - 30 - col1W, 10, 'FD');
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      pdf.text(label, startX + padding, currentY + 6.5);

      pdf.setFont("helvetica", "normal");
      if (isHighlightRow) pdf.setTextColor(185, 28, 28);
      else pdf.setTextColor(15, 23, 42); 
      pdf.text(val.toString(), startX + col1W + padding, currentY + 7);

      currentY += 10;
    };

    drawRow("Yatirim Uygunluk Skoru", `${data.score}%`);
    drawRow("Fiziksel / Uygun Alan", `${data.areaM2.toLocaleString('tr-TR')} m2 (${data.areaHa} hektar)`);
    drawRow("Ortalama Egim & Kot", trToEn(`${data.slope} Derece Egim / ${data.elevation}m Kot`));
    drawRow("Yillik Radyasyon", `${data.radiation} kWh/m2 / Yil` );
    drawRow("Arazi Sinifi ve Zemin", trToEn(`${data.landType} - ${data.soil}`));
    
    if (isPro) {
      drawRow("Sebeke Merkezi Mesafesi", data.substation === null ? "15 km dahilinde trafo bulunamadi" : `${data.substation} km`);
      drawRow("Tahmini Tesis Kapasitesi", `${data.capacity} MW`);
      drawRow("Tahmini Yatirim Butcesi", `$${(data.finalCost/1000000).toFixed(2)} Milyon USD ${data.penaltyPct > 0 ? '(Altyapi ve Izin Kesintisi Dahil)' : ''}`);
    } else {
      drawRow("Trafo / Sebeke Mesafesi", "KILITLI - Pro Raporda Mevcut");
      drawRow("Yatirim Maliyet Analizi", "KILITLI - Pro Raporda Mevcut");
    }

    if (data.mevzuat && isPro) {
      drawRow("Mevzuat / Yasal Riskler", "Risk tespit edildi (Ozel izne tabi tarim/mera sarti)", true);
    }

    currentY += 10;

    // 4. CHART (Native Draw - 'Güneş' Stilinde)
    if (isPro && data.monthlySolar) {
      if (currentY + 100 > pdfH - 25) {
        pdf.addPage();
        drawWatermark();
        currentY = 20;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text(trToEn("3. 12 Aylik Uretim Potansiyeli ve Veri Tablosu"), 15, currentY);
      currentY += 12;

      // Draw Sun Pie Chart (Stabler implementation with triangulation)
      const centerX = 50;
      const centerY = currentY + 30;
      const radius = 25;
      const totalKWh = data.monthlySolar.reduce((s, m) => s + m.kWhM2Month, 0);
      
      let currentAngle = 0;
      data.monthlySolar.forEach((m) => {
        const sliceAngle = (m.kWhM2Month / totalKWh) * 360;
        const color = m.kWhM2Month > 180 ? [251, 191, 36] : m.kWhM2Month > 120 ? [245, 158, 11] : [217, 119, 6];
        
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(0.2);

        // Draw slice using many small triangles to prevent distortion
        const segments = Math.max(4, Math.floor(sliceAngle / 1.5));
        for (let s = 0; s < segments; s++) {
          const a1 = (currentAngle + (sliceAngle * s / segments)) * Math.PI / 180;
          const a2 = (currentAngle + (sliceAngle * (s + 1) / segments)) * Math.PI / 180;
          
          pdf.triangle(
            centerX, centerY,
            centerX + Math.cos(a1) * radius, centerY + Math.sin(a1) * radius,
            centerX + Math.cos(a2) * radius, centerY + Math.sin(a2) * radius,
            'FD'
          );
        }
        currentAngle += sliceAngle;
      });

      // Draw Month Labels around the Pie
      let labelAngle = 0;
      data.monthlySolar.forEach((m) => {
        const sliceAngle = (m.kWhM2Month / totalKWh) * 360;
        const midA = (labelAngle + sliceAngle / 2) * Math.PI / 180;
        // Place label slightly outside the radius
        const lx = centerX + Math.cos(midA) * (radius + 7);
        const ly = centerY + Math.sin(midA) * (radius + 7);
        
        pdf.setFontSize(5);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${trToEn(m.monthName).substring(0,3).toUpperCase()}`, lx, ly, { align: 'center', baseline: 'middle' });
        
        // Small value below month
        pdf.setFontSize(4);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${Math.round(m.kWhM2Month)}`, lx, ly + 2.5, { align: 'center' });

        labelAngle += sliceAngle;
      });

      // Inner Sun Core
      pdf.setFillColor(255, 255, 255);
      pdf.circle(centerX, centerY, radius/2, 'F');
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(8);
      pdf.text("SOLAR", centerX, centerY + 1, { align: 'center' });

      // Sidebar Table for Monthly Data (Improved Clarity)
      const tableX = 85;
      let ty = currentY;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42); // Darker
      pdf.text("AYLIK URETIM DOKUMU (kWh/m2):", tableX, ty);
      ty += 7;
      
      pdf.setFontSize(9);
      data.monthlySolar.forEach((m) => {
        const monthLabel = trToEn(m.monthName).toUpperCase().padEnd(10, ' ');
        const valLabel = Math.round(m.kWhM2Month).toString().padStart(4, ' ');
        pdf.text(`${monthLabel}:  ${valLabel} kWh/m2`, tableX, ty);
        ty += 4.8;
      });

      currentY += 75;
    }

    // 5. FOOTER
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(71, 85, 105);
        if (isPro) {
          pdf.text("Bu rapor yatirim karari oncesi resmi bir on belgedir.", 15, pdfH - 18);
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text("GEOVERA Bilisim A.S. | AuraSol CBS ve Yapay Zeka servisi tarafindan dijital yollarla uretilmistir.", 15, pdfH - 12);
        pdf.text("Kesin yatirim karari icin fiili saha etudu gereklidir.", 15, pdfH - 8);
    }

    pdf.save(`AuraSol_${isPro ? 'Pro' : 'Ozet'}_Fizibilite_${Date.now()}.pdf`);
    return true;
  } catch (error) {
    console.error("PDF Export Error:", error);
    throw error;
  }
}
