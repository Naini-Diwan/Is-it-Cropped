import React, { useState, useRef } from 'react';
import { UploadedScan, CropZone, BorderSettings, EXIFMetadata } from './types';
import CropCanvas from './components/CropCanvas';
import ExportBuilder from './components/ExportBuilder';
import AdvancedEditor from './components/AdvancedEditor';
import { 
  Upload, 
  Trash2, 
  Sliders, 
  Image as ImageIcon, 
  FileText, 
  Lock, 
  Zap, 
  Scissors, 
  HelpCircle,
  FileCheck,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export default function App() {
  // Main states
  const [scans, setScans] = useState<UploadedScan[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [crops, setCrops] = useState<CropZone[]>([]);
  const [activeCropId, setActiveCropId] = useState<string | null>(null);

  // Customization & Algorithm configurations
  const [borderSettings, setBorderSettings] = useState<BorderSettings>({
    color: '#2563eb', // Royal blue default
    width: 1,
  });
  const [dragOver, setDragOver] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Advanced Editor modal state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropZone | null>(null);

  // Refs for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active scan helper
  const activeScan = scans.find((s) => s.id === activeScanId) || null;
  const activeScanCrops = crops.filter((c) => c.scanId === activeScanId);

  // Convert PDF to images using PDF.js CDN
  const handlePdfFile = async (file: File): Promise<UploadedScan[]> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js is not loaded from the CDN. Please check your network connection.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const uploadedPages: UploadedScan[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Use 2.0 scale for crisp, print-quality image conversion
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        uploadedPages.push({
          id: `scan_${Math.random().toString(36).substr(2, 9)}`,
          name: `${file.name.replace(/\.[^/.]+$/, '')}_Page_${pageNum}`,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
          file,
        });
      }
    }
    return uploadedPages;
  };

  // Main file uploader
  const processFiles = async (fileList: FileList) => {
    const newScans: UploadedScan[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

      try {
        if (isPdf) {
          const pdfScans = await handlePdfFile(file);
          newScans.push(...pdfScans);
        } else {
          // Standard image loading
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Preload to find dimensions
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });

          newScans.push({
            id: `scan_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            dataUrl,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            file,
          });
        }
      } catch (err: any) {
        console.error('File load failure:', err);
        alert(`Failed to load file "${file.name}": ${err.message || err}`);
      }
    }

    if (newScans.length > 0) {
      setScans((prev) => [...prev, ...newScans]);
      setActiveScanId(newScans[0].id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Batch delete handlers
  const handleDeleteCurrentCrops = () => {
    if (!activeScanId) return;
    setCrops((prev) => prev.filter((c) => c.scanId !== activeScanId));
    setActiveCropId(null);
  };

  const handleDeleteAllCrops = () => {
    setCrops([]);
    setActiveCropId(null);
  };

  const handleRemoveScan = (scanId: string) => {
    setScans((prev) => prev.filter((s) => s.id !== scanId));
    setCrops((prev) => prev.filter((c) => c.scanId !== scanId));
    if (activeScanId === scanId) {
      const remaining = scans.filter((s) => s.id !== scanId);
      setActiveScanId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold font-display">
            <span className="text-lg">I</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-900 font-display">
            Is-it-<span className="text-blue-600">Cropped</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {scans.length > 0 && (
            <>
              <button 
                onClick={handleDeleteAllCrops}
                title="Clear all the cropped images"
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Clear Batch
              </button>
              <button 
                onClick={() => {
                  const exportBtn = document.getElementById('btn-download-zip') as HTMLButtonElement | null;
                  if (exportBtn) {
                    exportBtn.click();
                  } else {
                    const el = document.getElementById('export-stage-anchor');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                disabled={isZipping || crops.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Packaging {zipProgress}%...</span>
                  </>
                ) : (
                  <span>Download All (ZIP)</span>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#F8FAFC]">

        {/* Upload Dropzone */}
        {scans.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`max-w-xl w-full border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*,application/pdf"
                className="hidden"
              />
              
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-xs border border-blue-100">
                <Upload className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold font-display text-slate-800 mb-2">
                Batch Upload Scans & Document PDFs
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
                Drag & drop flatbed scan files or multi-page PDFs here. Pages are auto-extracted as high-resolution images entirely inside the browser.
              </p>

              <div className="flex flex-wrap justify-center gap-2 text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                <span className="bg-slate-100 px-2.5 py-1 rounded-md">JPEG / JPG</span>
                <span className="bg-slate-100 px-2.5 py-1 rounded-md">PNG</span>
                <span className="bg-slate-100 px-2.5 py-1 rounded-md">TIFF</span>
                <span className="bg-slate-100 px-2.5 py-1 rounded-md">PDF (Multi-Page)</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Left Sidebar: Batch Scans queue */}
            <aside className="w-full lg:w-48 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploaded files ({scans.length})</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase transition"
                >
                  + ADD MORE
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                />
              </div>
              <div className="flex-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-3 space-y-3 flex lg:flex-col gap-3 lg:gap-0 custom-scrollbar">
                {scans.map((scan) => {
                  const scanCropsCount = crops.filter((c) => c.scanId === scan.id).length;
                  const isActive = scan.id === activeScanId;

                  return (
                    <div
                      key={scan.id}
                      onClick={() => {
                        setActiveScanId(scan.id);
                        setActiveCropId(null);
                      }}
                      className={`flex-shrink-0 relative group w-24 lg:w-full cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-1 ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-100'
                          : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-200 border border-slate-100 relative">
                        <img
                          src={scan.dataUrl}
                          alt={scan.name}
                          className="w-full h-full object-cover"
                        />
                        {scanCropsCount > 0 ? (
                          <span className="absolute bottom-1.5 right-1.5 bg-blue-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">
                            {scanCropsCount} crops
                          </span>
                        ) : (
                          <span className="absolute bottom-1.5 right-1.5 bg-slate-800/80 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">
                            Empty
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-slate-600 truncate mt-1.5 px-1 font-display">
                        {scan.name}
                      </p>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveScan(scan.id);
                        }}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm"
                        title="Remove scan"
                      >
                        <span className="block text-[9px] leading-none px-1">×</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Middle Section: Active Scan Canvas, controls, and ExportBuilder */}
            <section className="flex-1 bg-slate-100 p-4 lg:p-6 flex flex-col overflow-y-auto space-y-6 custom-scrollbar relative">
              
              {/* Active Scan Canvas */}
              {activeScan && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 relative flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex flex-col">
                      <h2 className="text-sm font-bold text-slate-800 font-display">
                        {activeScan.name}
                      </h2>
                      <span className="text-[10px] font-mono text-slate-400">
                        Resolution: {activeScan.width} × {activeScan.height} px • Double-click crop to open advanced editing
                      </span>
                    </div>
                    {activeScanCrops.length > 0 && (
                      <button
                        onClick={handleDeleteCurrentCrops}
                        className="text-xs text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1.5 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Clear active scan crops"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Crops
                      </button>
                    )}
                  </div>

                  {/* Interactive Crop Overlay Stage */}
                  <div className="relative bg-slate-100 rounded-xl overflow-hidden p-2 border border-slate-200/50 flex items-center justify-center min-h-[400px]">
                    <CropCanvas
                      scan={activeScan}
                      crops={activeScanCrops}
                      activeCropId={activeCropId}
                      borderSettings={borderSettings}
                      onCropsChange={(newCrops) => {
                        const otherCrops = crops.filter((c) => c.scanId !== activeScan.id);
                        setCrops([...otherCrops, ...newCrops]);
                      }}
                      onSelectCrop={setActiveCropId}
                      onDoubleClickedCrop={(crop) => {
                        setEditingCrop(crop);
                        setIsAdvancedOpen(true);
                      }}
                    />
                  </div>

                </div>
              )}

              {/* Export Builder Block */}
              <div id="export-stage-anchor" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <ExportBuilder
                  crops={crops}
                  scans={scans}
                  activeCropId={activeCropId}
                  onZipStart={() => setIsZipping(true)}
                  onZipComplete={() => setIsZipping(false)}
                  onZipProgress={(p) => setZipProgress(p)}
                />
              </div>

            </section>

            {/* Right Side: Sidebar panel with Cropped Images, Borders Customization */}
            <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-6 custom-scrollbar">

              {/* Cropped Images */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Cropped Images ({crops.length})
                    </h3>
                  </div>
                </div>

                {crops.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    <p className="text-[11px]">No crops defined yet.</p>
                    <p className="text-[9px] text-slate-400/80 mt-0.5">
                      Drag on the scan to define crop areas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {crops.map((crop) => {
                      const scanOfCrop = scans.find((s) => s.id === crop.scanId);
                      const isSelected = activeCropId === crop.id;

                      return (
                        <div
                          key={crop.id}
                          onClick={() => {
                            setActiveScanId(crop.scanId);
                            setActiveCropId(crop.id);
                          }}
                          className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition ${
                            isSelected
                              ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-0.5 truncate flex-1">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold truncate">{crop.name}</span>
                              {crop.rotation !== 0 && (
                                <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono">
                                  {crop.rotation}°
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-400 truncate">
                              Scan: {scanOfCrop?.name || 'Unknown'}
                            </p>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCrop(crop);
                                setIsAdvancedOpen(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              title="Open advanced editing"
                            >
                              <Sliders className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCrops((prev) => prev.filter((c) => c.id !== crop.id));
                                if (activeCropId === crop.id) setActiveCropId(null);
                              }}
                              className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete Crop"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Real-time Preview Canvas Portal Target */}
              <div id="realtime-preview-portal-target" />

              {/* Visual Crop Overlays Style */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  Visual Overlay Style
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">
                      Border Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={borderSettings.color}
                        onChange={(e) => setBorderSettings({ ...borderSettings, color: e.target.value })}
                        className="w-5 h-5 rounded border border-slate-200 p-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{borderSettings.color}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">
                        Border
                      </label>
                      <span className="text-[9px] font-mono font-medium text-slate-600">
                        {borderSettings.width}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={borderSettings.width}
                      onChange={(e) => setBorderSettings({ ...borderSettings, width: parseInt(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer h-1"
                    />
                  </div>
                </div>
              </div>

            </aside>
          </>
        )}

      </main>

      <footer className="border-t border-slate-100 py-3 px-4 text-center">
        <p className="text-[11px] text-slate-400">
          Built by{' Naini Diwan'}
          {' | '}
          <a 
            href="https://naini-diwan.github.io/Hello-Naini/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-600 transition-colors underline underline-offset-2"
          >
            Portfolio
          </a>
          {' | '}
          <a 
            href="https://www.linkedin.com/in/naini-diwan-profile786/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-600 transition-colors underline underline-offset-2"
          >
            LinkedIn
          </a>
        </p>
      </footer>

      {/* Advanced Inspector modal */}
      {isAdvancedOpen && editingCrop && (
        <AdvancedEditor
          crop={editingCrop}
          scan={scans.find(s => s.id === editingCrop.scanId) || activeScan}
          isOpen={isAdvancedOpen}
          onClose={() => {
            setIsAdvancedOpen(false);
            setEditingCrop(null);
          }}
          onSave={(updatedCrop) => {
            setCrops((prev) =>
              prev.map((c) => (c.id === updatedCrop.id ? updatedCrop : c))
            );
            setActiveCropId(updatedCrop.id);
          }}
        />
      )}

    </div>
  );
}
