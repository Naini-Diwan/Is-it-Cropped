import React, { useState, useEffect, useRef } from 'react';
import { CropZone, UploadedScan } from '../types';
import { X, RotateCcw, Save, Move, Sliders } from 'lucide-react';

interface AdvancedEditorProps {
  crop: CropZone;
  scan: UploadedScan;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCrop: CropZone) => void;
}

export default function AdvancedEditor({ crop, scan, isOpen, onClose, onSave }: AdvancedEditorProps) {
  const [x, setX] = useState(crop.x);
  const [y, setY] = useState(crop.y);
  const [width, setWidth] = useState(crop.width);
  const [height, setHeight] = useState(crop.height);
  const [rotation, setRotation] = useState(crop.rotation);
  const [name, setName] = useState(crop.name);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync state with crop prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setX(crop.x);
      setY(crop.y);
      setWidth(crop.width);
      setHeight(crop.height);
      setRotation(crop.rotation);
      setName(crop.name);
    }
  }, [crop, isOpen]);

  // Redraw preview in canvas in real time as sliders change
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    if (scan.dataUrl && !scan.dataUrl.startsWith('data:') && !scan.dataUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const pW = canvas.width;
      const pH = canvas.height;

      // Clear
      ctx.clearRect(0, 0, pW, pH);

      // Create transparent grid or off-white background
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, pW, pH);
      
      // Draw grid
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const gridSize = 15;
      for (let i = 0; i < pW; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, pH);
        ctx.stroke();
      }
      for (let j = 0; j < pH; j += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(pW, j);
        ctx.stroke();
      }

      ctx.save();
      // Move origin to center of canvas
      ctx.translate(pW / 2, pH / 2);
      
      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Determine fits for cropped area
      const scale = Math.min((pW * 0.8) / width, (pH * 0.8) / height, 1.5);
      const dw = width * scale;
      const dh = height * scale;

      // Draw original image cropped
      const sx = Math.max(0, Math.min(img.naturalWidth - 1, x));
      const sy = Math.max(0, Math.min(img.naturalHeight - 1, y));
      const sw = Math.max(1, Math.min(img.naturalWidth - sx, width));
      const sh = Math.max(1, Math.min(img.naturalHeight - sy, height));

      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        -dw / 2,
        -dh / 2,
        dw,
        dh
      );

      ctx.restore();
    };
    img.onerror = (e) => {
      console.error('AdvancedEditor: failed to load image', e);
    };
    img.src = scan.dataUrl;
  }, [isOpen, x, y, width, height, rotation, scan.dataUrl]);

  if (!isOpen) return null;

  const handleReset = () => {
    setX(crop.x);
    setY(crop.y);
    setWidth(crop.width);
    setHeight(crop.height);
    setRotation(crop.rotation);
    setName(crop.name);
  };

  const handleSave = () => {
    onSave({
      ...crop,
      name,
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      width: Math.max(10, Math.round(width)),
      height: Math.max(10, Math.round(height)),
      rotation: Number(rotation),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Side: Live Preview Area */}
        <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
          <div className="text-center mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-1 rounded">
              Advanced Editing
            </span>
            <h3 className="text-sm font-semibold text-slate-700 mt-2">
              {name || 'Crop Region'}
            </h3>
          </div>

          <div className="relative border-4 border-white shadow-lg rounded-xl overflow-hidden bg-slate-200">
            <canvas 
              ref={canvasRef} 
              width={320} 
              height={320}
              className="block w-full max-w-xs h-auto"
            />
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center max-w-xs">
            Grid background represents transparent canvas borders. Rotation corrections are calculated around the crop center point.
          </p>
        </div>

        {/* Right Side: Parameters Controls */}
        <div className="w-full md:w-[420px] p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-display font-semibold text-slate-800">
                  Advanced Inspector
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Crop Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Photo Card"
                />
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Position X (px)
                  </label>
                  <input
                    type="number"
                    value={x}
                    onChange={(e) => setX(Number(e.target.value))}
                    max={scan.width}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Position Y (px)
                  </label>
                  <input
                    type="number"
                    value={y}
                    onChange={(e) => setY(Number(e.target.value))}
                    max={scan.height}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    max={scan.width}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    max={scan.height}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Rotation Slider */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">
                    Rotation Angle
                  </label>
                  <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="0.5"
                  value={rotation}
                  onChange={(e) => setRotation(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>-180° (Flip)</span>
                  <span>0° (Straight)</span>
                  <span>180° (Flip)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
            <button
              onClick={handleReset}
              className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-sm shadow-blue-200 transition"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
