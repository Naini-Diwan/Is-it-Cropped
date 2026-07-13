import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CropZone, UploadedScan, ExportSettings, ImageQuality, EXIFMetadata } from '../types';
import { Download, Sliders, LayoutGrid, Settings, Layers, Image as ImageIcon, Sparkles, Plus, Trash } from 'lucide-react';
import JSZip from 'jszip';

interface ExportBuilderProps {
  crops: CropZone[];
  scans: UploadedScan[];
  activeCropId: string | null;
  onZipStart?: () => void;
  onZipComplete?: () => void;
  onZipProgress?: (progress: number) => void;
}

export default function ExportBuilder({
  crops,
  scans,
  activeCropId,
  onZipStart,
  onZipComplete,
  onZipProgress,
}: ExportBuilderProps) {
  // Selected single crop for live preview
  const [selectedCrop, setSelectedCrop] = useState<CropZone | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Custom aspect ratios list saved to localStorage
  const [customRatios, setCustomRatios] = useState<string[]>(() => {
    const saved = localStorage.getItem('cropit_custom_ratios');
    return saved ? JSON.parse(saved) : ['16:9', '2:3'];
  });
  const [newRatioInput, setNewRatioInput] = useState('');

  // EXIF Metadata default state
  const [exif, setExif] = useState<EXIFMetadata>({
    title: 'Scanned Archive',
    description: 'Digitized and cropped with Is-it-Cropped',
    tags: 'vintage, scan, photos',
    creationDate: new Date().toISOString().split('T')[0],
    author: 'Is-it-Cropped',
  });

  // Main export configurations
  const [aspectRatio, setAspectRatio] = useState<string>('original');
  const [bgFillType, setBgFillType] = useState<'color' | 'transparent'>('color');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [quality, setQuality] = useState<ImageQuality>('high');
  const [captureMargin, setCaptureMargin] = useState<number>(0);
  const [feathering, setFeathering] = useState<number>(0);
  const [filenameTemplate, setFilenameTemplate] = useState<string>('{file}_crop_{crop}');

  // Progress tracking during zip creation
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Portal target for real-time export canvas
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('realtime-preview-portal-target'));
  }, []);

  // Update selected crop for preview
  useEffect(() => {
    if (crops.length === 0) {
      setSelectedCrop(null);
      return;
    }
    const current = crops.find((c) => c.id === activeCropId) || crops[0];
    setSelectedCrop(current);
  }, [crops, activeCropId]);

  // Redraw preview in real time
  useEffect(() => {
    if (!selectedCrop) return;
    const scan = scans.find((s) => s.id === selectedCrop.scanId);
    if (!scan) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      renderSingleCropToCanvas(
        img,
        selectedCrop,
        canvas,
        {
          aspectRatio,
          bgFillType,
          bgColor,
          format,
          quality,
          captureMargin,
          feathering,
          filenameTemplate,
          exif,
        },
        300 // Bound size of the preview canvas
      );
    };
    img.src = scan.dataUrl;
  }, [selectedCrop, aspectRatio, bgFillType, bgColor, format, quality, captureMargin, feathering, scans]);

  // Function to calculate dimensions and draw a single crop to any canvas (Preview or Export size)
  const renderSingleCropToCanvas = (
    img: HTMLImageElement,
    crop: CropZone,
    canvas: HTMLCanvasElement,
    settings: ExportSettings,
    maxCanvasDim?: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Calculate Feathering
    const fFactor = 1 + settings.feathering / 100;
    const fW = crop.width * fFactor;
    const fH = crop.height * fFactor;
    const fX = crop.x + crop.width / 2 - fW / 2;
    const fY = crop.y + crop.height / 2 - fH / 2;

    // 2. Calculate Capture Margin
    let mX = fX - settings.captureMargin;
    let mY = fY - settings.captureMargin;
    let mW = fW + settings.captureMargin * 2;
    let mH = fH + settings.captureMargin * 2;

    // Bound checks on base dimensions (minimum 10px)
    mW = Math.max(10, mW);
    mH = Math.max(10, mH);

    // 3. Setup temporary rotated canvas to isolate cropped piece
    // This handles rotated bounding box cropping cleanly.
    const tempCanvas = document.createElement('canvas');
    const diagonal = Math.ceil(Math.sqrt(mW * mW + mH * mH));
    tempCanvas.width = diagonal;
    tempCanvas.height = diagonal;
    const tCtx = tempCanvas.getContext('2d');
    
    if (tCtx) {
      tCtx.clearRect(0, 0, diagonal, diagonal);
      tCtx.save();
      
      // Move to center of canvas
      tCtx.translate(diagonal / 2, diagonal / 2);
      // Rotate
      tCtx.rotate((crop.rotation * Math.PI) / 180);

      // Draw original image shifted
      tCtx.drawImage(
        img,
        Math.max(0, Math.round(mX)),
        Math.max(0, Math.round(mY)),
        Math.min(img.naturalWidth - mX, Math.round(mW)),
        Math.min(img.naturalHeight - mY, Math.round(mH)),
        -mW / 2,
        -mH / 2,
        mW,
        mH
      );
      tCtx.restore();
    }

    // Now crop out the aligned bounding box from the diagonal rotated canvas
    const croppedW = Math.round(mW);
    const croppedH = Math.round(mH);

    // 4. Calculate Aspect Ratio Padding
    let finalW = croppedW;
    let finalH = croppedH;

    if (settings.aspectRatio !== 'original') {
      let targetRatio = 1;
      if (settings.aspectRatio === '3:4') targetRatio = 3 / 4;
      else if (settings.aspectRatio === '5:7') targetRatio = 5 / 7;
      else if (settings.aspectRatio === '4:5') targetRatio = 4 / 5;
      else if (settings.aspectRatio === '1:1') targetRatio = 1;
      else if (settings.aspectRatio.includes(':')) {
        const [aw, ah] = settings.aspectRatio.split(':').map(Number);
        if (aw && ah) targetRatio = aw / ah;
      }

      const currentRatio = croppedW / croppedH;
      if (currentRatio < targetRatio) {
        // Current is narrower than target ratio: expand width
        finalW = Math.round(croppedH * targetRatio);
        finalH = croppedH;
      } else {
        // Current is wider than target ratio: expand height
        finalW = croppedW;
        finalH = Math.round(croppedW / targetRatio);
      }
    }

    // Set canvas dimensions
    let scale = 1;
    if (maxCanvasDim) {
      scale = Math.min(maxCanvasDim / finalW, maxCanvasDim / finalH, 1);
      canvas.width = finalW * scale;
      canvas.height = finalH * scale;
    } else {
      canvas.width = finalW;
      canvas.height = finalH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background color
    if (settings.bgFillType === 'color' || settings.format === 'jpeg') {
      ctx.fillStyle = settings.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Transparency grid preview on canvas
      if (maxCanvasDim) {
        ctx.fillStyle = '#e2e8f0';
        const gSize = 10;
        for (let x = 0; x < canvas.width; x += gSize * 2) {
          for (let y = 0; y < canvas.height; y += gSize * 2) {
            ctx.fillRect(x, y, gSize, gSize);
            ctx.fillRect(x + gSize, y + gSize, gSize, gSize);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Draw centered cropped image
    const dx = ((finalW - croppedW) / 2) * scale;
    const dy = ((finalH - croppedH) / 2) * scale;
    const dw = croppedW * scale;
    const dh = croppedH * scale;

    ctx.drawImage(
      tempCanvas,
      (diagonal - croppedW) / 2,
      (diagonal - croppedH) / 2,
      croppedW,
      croppedH,
      dx,
      dy,
      dw,
      dh
    );
  };

  // Add a custom Aspect Ratio
  const handleAddCustomRatio = () => {
    if (!newRatioInput.includes(':')) return;
    const clean = newRatioInput.trim();
    if (!customRatios.includes(clean)) {
      const updated = [...customRatios, clean];
      setCustomRatios(updated);
      localStorage.setItem('cropit_custom_ratios', JSON.stringify(updated));
    }
    setAspectRatio(clean);
    setNewRatioInput('');
  };

  // Remove custom aspect ratio
  const handleRemoveCustomRatio = (ratio: string) => {
    const updated = customRatios.filter((r) => r !== ratio);
    setCustomRatios(updated);
    localStorage.setItem('cropit_custom_ratios', JSON.stringify(updated));
    if (aspectRatio === ratio) setAspectRatio('original');
  };

  // Generate ZIP of cropped files
  const handleExportZip = async () => {
    if (crops.length === 0) return;
    setIsZipping(true);
    setZipProgress(0);
    if (onZipProgress) onZipProgress(0);
    if (onZipStart) onZipStart();

    try {
      const zip = new JSZip();
      
      // Load and cache images
      const loadedImages: Record<string, HTMLImageElement> = {};
      for (const scan of scans) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error(`Failed to load image ${scan.name}`));
          img.src = scan.dataUrl;
        });
        loadedImages[scan.id] = img;
      }

      // Render each crop to offscreen canvas and zip
      const settings: ExportSettings = {
        aspectRatio,
        bgFillType,
        bgColor,
        format,
        quality,
        captureMargin,
        feathering,
        filenameTemplate,
        exif,
      };

      const total = crops.length;
      for (let i = 0; i < total; i++) {
        const crop = crops[i];
        const originalScan = scans.find((s) => s.id === crop.scanId);
        if (!originalScan) continue;

        const img = loadedImages[crop.scanId];
        const offscreenCanvas = document.createElement('canvas');

        // Draw crop area in full source resolution
        renderSingleCropToCanvas(img, crop, offscreenCanvas, settings);

        // Convert canvas to Blob
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const qVal = quality === 'max' ? 1.0 : quality === 'high' ? 0.9 : quality === 'medium' ? 0.75 : 0.5;

        const blob = await new Promise<Blob | null>((resolve) => {
          offscreenCanvas.toBlob((b) => resolve(b), mimeType, qVal);
        });

        if (blob) {
          // Format filename using template tokens
          const cleanScanName = originalScan.name.replace(/\.[^/.]+$/, '');
          let filename = filenameTemplate
            .replace('{file}', cleanScanName)
            .replace('{crop}', (i + 1).toString());

          const ext = format === 'png' ? '.png' : '.jpg';
          filename += ext;

          zip.file(filename, blob);
        }

        const progress = Math.round(((i + 1) / total) * 100);
        setZipProgress(progress);
        if (onZipProgress) onZipProgress(progress);
      }

      // Generate the ZIP file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `IsItCropped_Scans_${new Date().toISOString().slice(0,10)}.zip`;
      link.click();
    } catch (err) {
      console.error('ZIP generation error:', err);
      alert('Failed to pack your cropped scans. Please try again.');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
      if (onZipProgress) onZipProgress(0);
      if (onZipComplete) onZipComplete();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Settings Panel */}
      <div className="space-y-6">
        
        {/* Aspect Ratio Padding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Aspect Ratio Padding & Alignment
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'original', label: 'Original Ratio (No Padding)' },
              { id: '1:1', label: '1:1 Square' },
              { id: '3:4', label: '3:4 Portrait' },
              { id: '5:7', label: '5:7 Print' },
              { id: '4:5', label: '4:5 Social Media' },
            ].map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setAspectRatio(ratio.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  aspectRatio === ratio.id
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {ratio.label}
              </button>
            ))}

            {/* Custom Ratio List */}
            {customRatios.map((ratio) => (
              <div
                key={ratio}
                className={`inline-flex items-center rounded-lg text-xs font-medium border transition overflow-hidden ${
                  aspectRatio === ratio
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <button
                  onClick={() => setAspectRatio(ratio)}
                  className="py-1.5 pl-3 pr-2 hover:bg-blue-100/50 cursor-pointer h-full"
                >
                  {ratio}
                </button>
                <button
                  onClick={() => handleRemoveCustomRatio(ratio)}
                  className="p-1 px-1.5 hover:bg-red-50 hover:text-red-600 border-l border-slate-200 h-full text-[10px]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add Custom Ratio Form */}
          <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-slate-100">
            <input
              type="text"
              placeholder="e.g., 16:9 or 2:3"
              value={newRatioInput}
              onChange={(e) => setNewRatioInput(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddCustomRatio}
              className="py-1.5 px-3 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 text-slate-600 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Ratio
            </button>
          </div>
        </div>

        {/* Canvas Background Fill & Format Control */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Background Canvas Fill
              </h4>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="bgFillType"
                    checked={bgFillType === 'color'}
                    onChange={() => setBgFillType('color')}
                    className="accent-blue-600"
                  />
                  Solid Background Color
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="bgFillType"
                    checked={bgFillType === 'transparent'}
                    onChange={() => setBgFillType('transparent')}
                    className="accent-blue-600"
                  />
                  Transparent (PNG only)
                </label>
              </div>

              {bgFillType === 'color' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-200 p-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-24 uppercase font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                File Format & Quality Control
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'jpeg' | 'png')}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="jpeg">JPG / JPEG</option>
                  <option value="png">PNG (Lossless)</option>
                </select>
              </div>

              {format === 'jpeg' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Quality
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as ImageQuality)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="max">Max (Archival)</option>
                    <option value="high">High (Lossless-like)</option>
                    <option value="medium">Medium (Web Default)</option>
                    <option value="standard">Standard (Compact)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Live Preview Rendered in Portal Target */}
      {portalTarget && createPortal(
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded mb-4">
              CURRENTLY SELECTED IMAGE
            </span>

            {selectedCrop ? (
              <div className="relative border border-slate-200 bg-white shadow-inner rounded-xl overflow-hidden p-2 flex items-center justify-center w-full max-w-[240px] aspect-square">
                <canvas
                  ref={previewCanvasRef}
                  className="block max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 max-w-xs">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No active crop selected to render live preview.</p>
              </div>
            )}

            {selectedCrop && (
              <div className="w-full text-center mt-4 space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  {selectedCrop.name} Output Size:
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {selectedCrop.width} x {selectedCrop.height} px
                </p>
              </div>
            )}
          </div>

          {/* Sliders: Capture Margin & Feathering */}
          <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  Capture Margin (px)
                </label>
                <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {captureMargin > 0 ? `+${captureMargin}` : captureMargin} px
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mb-2 leading-tight">
                Expands (+) or shrinks (-) the borders of all crops at export.
              </p>
              <input
                type="range"
                min="-30"
                max="50"
                value={captureMargin}
                onChange={(e) => setCaptureMargin(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  Uniform Crop Feathering %
                </label>
                <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {feathering > 0 ? `+${feathering}` : feathering}%
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mb-2 leading-tight">
                Scales crops uniformly around their center point at export.
              </p>
              <input
                type="range"
                min="-20"
                max="20"
                value={feathering}
                onChange={(e) => setFeathering(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>,
        portalTarget
      )}

      {/* Hidden button for programmatic trigger */}
      <button
        id="btn-download-zip"
        onClick={handleExportZip}
        className="hidden"
        disabled={crops.length === 0}
      />
    </div>
  );
}
