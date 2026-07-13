import React, { useState, useRef, useEffect } from 'react';
import { CropZone, UploadedScan, BorderSettings } from '../types';
import { Trash2, Maximize2, Settings } from 'lucide-react';

interface CropCanvasProps {
  scan: UploadedScan;
  crops: CropZone[];
  activeCropId: string | null;
  borderSettings: BorderSettings;
  onCropsChange: (crops: CropZone[]) => void;
  onSelectCrop: (cropId: string | null) => void;
  onDoubleClickedCrop: (crop: CropZone) => void;
}

type DragAction = 'draw' | 'move' | 'resize' | null;
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'se' | 'sw';

export default function CropCanvas({
  scan,
  crops,
  activeCropId,
  borderSettings,
  onCropsChange,
  onSelectCrop,
  onDoubleClickedCrop,
}: CropCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [dragAction, setDragAction] = useState<DragAction>(null);
  const [draggedCropId, setDraggedCropId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  
  // Starting point of drag in ORIGINAL image coordinates
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [drawCrop, setDrawCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [originalCropState, setOriginalCropState] = useState<CropZone | null>(null);

  // Monitor element sizing to calculate scaling factor
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    const updateDimensions = () => {
      setDimensions({
        width: img.clientWidth || 1,
        height: img.clientHeight || 1,
      });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(img);
    return () => resizeObserver.disconnect();
  }, [scan.id]);

  // Convert client coordinates (relative to image element) to original image pixels
  const clientToOriginal = (clientX: number, clientY: number) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const rx = clientX - rect.left;
    const ry = clientY - rect.top;

    const scaleX = scan.width / (rect.width || 1);
    const scaleY = scan.height / (rect.height || 1);

    return {
      x: Math.min(scan.width, Math.max(0, Math.round(rx * scaleX))),
      y: Math.min(scan.height, Math.max(0, Math.round(ry * scaleY))),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const target = e.target as HTMLElement;
    
    // Check if clicking a delete or edit button
    if (target.closest('.action-btn')) {
      return;
    }

    const { x: origX, y: origY } = clientToOriginal(e.clientX, e.clientY);
    
    // Check if clicked inside a resize handle
    const handleEl = target.closest('[data-handle]') as HTMLElement;
    if (handleEl) {
      const handle = handleEl.dataset.handle as ResizeHandle;
      const cropId = handleEl.dataset.cropId!;
      const crop = crops.find((c) => c.id === cropId);
      if (crop) {
        setDragAction('resize');
        setDraggedCropId(cropId);
        setResizeHandle(handle);
        setDragStart({ x: origX, y: origY });
        setOriginalCropState({ ...crop });
        onSelectCrop(cropId);
        e.stopPropagation();
        return;
      }
    }

    // Check if clicked inside a crop box to move
    const cropBoxEl = target.closest('[data-crop-box]') as HTMLElement;
    if (cropBoxEl) {
      const cropId = cropBoxEl.dataset.cropBox!;
      const crop = crops.find((c) => c.id === cropId);
      if (crop) {
        setDragAction('move');
        setDraggedCropId(cropId);
        setDragStart({ x: origX, y: origY });
        setOriginalCropState({ ...crop });
        onSelectCrop(cropId);
        e.stopPropagation();
        return;
      }
    }

    // Clicked empty background - starting to DRAW a custom crop
    setDragAction('draw');
    setDragStart({ x: origX, y: origY });
    setDrawCrop({ x: origX, y: origY, w: 0, h: 0 });
    onSelectCrop(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragAction) return;

    const { x: origX, y: origY } = clientToOriginal(e.clientX, e.clientY);

    if (dragAction === 'draw' && drawCrop) {
      const x = Math.min(dragStart.x, origX);
      const y = Math.min(dragStart.y, origY);
      const w = Math.abs(origX - dragStart.x);
      const h = Math.abs(origY - dragStart.y);

      setDrawCrop({ x, y, w, h });
    }

    else if (dragAction === 'move' && draggedCropId && originalCropState) {
      const dx = origX - dragStart.x;
      const dy = origY - dragStart.y;

      let newX = originalCropState.x + dx;
      let newY = originalCropState.y + dy;

      // Keep inside bounds
      newX = Math.max(0, Math.min(scan.width - originalCropState.width, newX));
      newY = Math.max(0, Math.min(scan.height - originalCropState.height, newY));

      const updatedCrops = crops.map((c) =>
        c.id === draggedCropId ? { ...c, x: newX, y: newY } : c
      );
      onCropsChange(updatedCrops);
    }

    else if (dragAction === 'resize' && draggedCropId && originalCropState && resizeHandle) {
      const dx = origX - dragStart.x;
      const dy = origY - dragStart.y;

      let { x, y, width, height } = originalCropState;

      switch (resizeHandle) {
        case 'se':
          width = Math.max(10, width + dx);
          height = Math.max(10, height + dy);
          break;
        case 'sw':
          const swX = x + dx;
          if (swX >= 0 && swX < x + width) {
            width = width + (x - swX);
            x = swX;
          }
          height = Math.max(10, height + dy);
          break;
        case 'ne':
          width = Math.max(10, width + dx);
          const neY = y + dy;
          if (neY >= 0 && neY < y + height) {
            height = height + (y - neY);
            y = neY;
          }
          break;
        case 'nw':
          const nwX = x + dx;
          if (nwX >= 0 && nwX < x + width) {
            width = width + (x - nwX);
            x = nwX;
          }
          const nwY = y + dy;
          if (nwY >= 0 && nwY < y + height) {
            height = height + (y - nwY);
            y = nwY;
          }
          break;
        case 'e':
          width = Math.max(10, width + dx);
          break;
        case 'w':
          const wX = x + dx;
          if (wX >= 0 && wX < x + width) {
            width = width + (x - wX);
            x = wX;
          }
          break;
        case 's':
          height = Math.max(10, height + dy);
          break;
        case 'n':
          const nY = y + dy;
          if (nY >= 0 && nY < y + height) {
            height = height + (y - nY);
            y = nY;
          }
          break;
      }

      // Constrain inside image boundaries
      x = Math.max(0, Math.min(scan.width - 10, x));
      y = Math.max(0, Math.min(scan.height - 10, y));
      width = Math.min(scan.width - x, width);
      height = Math.min(scan.height - y, height);

      const updatedCrops = crops.map((c) =>
        c.id === draggedCropId ? { ...c, x, y, width, height } : c
      );
      onCropsChange(updatedCrops);
    }
  };

  const handleMouseUp = () => {
    if (dragAction === 'draw' && drawCrop) {
      // If drawn box is big enough, save it
      if (drawCrop.w > 15 && drawCrop.h > 15) {
        const newCrop: CropZone = {
          id: `crop_${Math.random().toString(36).substr(2, 9)}`,
          scanId: scan.id,
          x: Math.round(drawCrop.x),
          y: Math.round(drawCrop.y),
          width: Math.round(drawCrop.w),
          height: Math.round(drawCrop.h),
          rotation: 0,
          name: `Custom Crop ${crops.length + 1}`,
        };
        onCropsChange([...crops, newCrop]);
        onSelectCrop(newCrop.id);
      }
    }

    setDragAction(null);
    setDraggedCropId(null);
    setResizeHandle(null);
    setDrawCrop(null);
    setOriginalCropState(null);
  };

  const deleteCrop = (cropId: string) => {
    onCropsChange(crops.filter((c) => c.id !== cropId));
    if (activeCropId === cropId) onSelectCrop(null);
  };

  return (
    <div 
      className="relative select-none flex justify-center items-center p-4 bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden shadow-inner w-full min-h-[400px] h-full"
      ref={containerRef}
    >
      <div 
        className="relative shadow-lg border border-slate-300 rounded-lg overflow-hidden cursor-crosshair transition-all"
        style={{ maxWidth: '100%', maxHeight: '72vh' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* The Scan Image */}
        <img
          ref={imageRef}
          src={scan.dataUrl}
          alt={scan.name}
          className="block h-auto w-auto max-w-full max-h-[72vh]"
          draggable={false}
        />

        {/* Crops Overlays Container */}
        {dimensions.width > 1 && (
          <div className="absolute inset-0 pointer-events-none">
            
            {/* Draw Crop Box Highlight (When drawing) */}
            {dragAction === 'draw' && drawCrop && (
              <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
                style={{
                  left: `${(drawCrop.x / scan.width) * 100}%`,
                  top: `${(drawCrop.y / scan.height) * 100}%`,
                  width: `${(drawCrop.w / scan.width) * 100}%`,
                  height: `${(drawCrop.h / scan.height) * 100}%`,
                }}
              />
            )}

            {/* Existing Crop Zones */}
            {crops.map((crop) => {
              const leftPercent = (crop.x / scan.width) * 100;
              const topPercent = (crop.y / scan.height) * 100;
              const widthPercent = (crop.width / scan.width) * 100;
              const heightPercent = (crop.height / scan.height) * 100;

              const isActive = activeCropId === crop.id;

              return (
                <div
                  key={crop.id}
                  data-crop-box={crop.id}
                  className={`absolute pointer-events-auto transition-[border-color,box-shadow] group cursor-grab active:cursor-grabbing`}
                  style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`,
                    transform: `rotate(${crop.rotation}deg)`,
                    transformOrigin: 'center center',
                    border: `${borderSettings.width}px solid ${borderSettings.color}`,
                    boxShadow: isActive 
                      ? `0 0 0 3px rgba(37, 99, 235, 0.4), 0 10px 15px -3px rgba(0, 0, 0, 0.1)` 
                      : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    zIndex: isActive ? 30 : 10,
                  }}
                  onDoubleClick={() => onDoubleClickedCrop(crop)}
                >
                  {/* Overlay background to help click grab */}
                  <div className="absolute inset-0 bg-transparent" />

                  {/* Crop Label & Delete Button (Top Floating Bar) */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md border border-slate-700/50 scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto action-btn z-50">
                    <span className="font-medium truncate max-w-[120px]">{crop.name}</span>
                    {crop.rotation !== 0 && (
                      <span className="text-[10px] bg-blue-500/80 px-1 py-0.5 rounded text-blue-100">
                        {crop.rotation}°
                      </span>
                    )}
                    <button
                      onClick={() => deleteCrop(crop.id)}
                      className="p-1 rounded-full bg-red-600 hover:bg-red-700 text-white transition pointer-events-auto cursor-pointer"
                      title="Delete Crop"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDoubleClickedCrop(crop)}
                      className="p-1 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition pointer-events-auto cursor-pointer"
                      title="Open advanced editing"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Corner Resize Handles */}
                  {isActive && (() => {
                    const vertexSize = Math.round(Math.max(10, Math.min(24, 8 + borderSettings.width * 2)));
                    const edgeLength = Math.round(Math.max(16, Math.min(36, 16 + borderSettings.width * 2.5)));
                    const edgeThickness = Math.round(Math.max(6, Math.min(14, 5 + borderSettings.width * 1.2)));

                    return (
                      <>
                        {/* Top Left */}
                        <div
                          data-handle="nw"
                          data-crop-id={crop.id}
                          className="absolute bg-white border-2 rounded-full cursor-nwse-resize hover:bg-blue-50 hover:scale-110 shadow-sm z-40"
                          style={{
                            width: `${vertexSize}px`,
                            height: `${vertexSize}px`,
                            left: `${-vertexSize / 2}px`,
                            top: `${-vertexSize / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* Top Right */}
                        <div
                          data-handle="ne"
                          data-crop-id={crop.id}
                          className="absolute bg-white border-2 rounded-full cursor-nesw-resize hover:bg-blue-50 hover:scale-110 shadow-sm z-40"
                          style={{
                            width: `${vertexSize}px`,
                            height: `${vertexSize}px`,
                            right: `${-vertexSize / 2}px`,
                            top: `${-vertexSize / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* Bottom Left */}
                        <div
                          data-handle="sw"
                          data-crop-id={crop.id}
                          className="absolute bg-white border-2 rounded-full cursor-nesw-resize hover:bg-blue-50 hover:scale-110 shadow-sm z-40"
                          style={{
                            width: `${vertexSize}px`,
                            height: `${vertexSize}px`,
                            left: `${-vertexSize / 2}px`,
                            bottom: `${-vertexSize / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* Bottom Right */}
                        <div
                          data-handle="se"
                          data-crop-id={crop.id}
                          className="absolute bg-white border-2 rounded-full cursor-nwse-resize hover:bg-blue-50 hover:scale-110 shadow-sm z-40"
                          style={{
                            width: `${vertexSize}px`,
                            height: `${vertexSize}px`,
                            right: `${-vertexSize / 2}px`,
                            bottom: `${-vertexSize / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />

                        {/* Side Edge Handles */}
                        {/* North */}
                        <div
                          data-handle="n"
                          data-crop-id={crop.id}
                          className="absolute left-1/2 -translate-x-1/2 bg-white/80 border rounded-full cursor-ns-resize hover:bg-blue-50 shadow-sm z-30 flex items-center justify-center"
                          style={{
                            width: `${edgeLength}px`,
                            height: `${edgeThickness}px`,
                            top: `${-edgeThickness / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* South */}
                        <div
                          data-handle="s"
                          data-crop-id={crop.id}
                          className="absolute left-1/2 -translate-x-1/2 bg-white/80 border rounded-full cursor-ns-resize hover:bg-blue-50 shadow-sm z-30 flex items-center justify-center"
                          style={{
                            width: `${edgeLength}px`,
                            height: `${edgeThickness}px`,
                            bottom: `${-edgeThickness / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* East */}
                        <div
                          data-handle="e"
                          data-crop-id={crop.id}
                          className="absolute top-1/2 -translate-y-1/2 bg-white/80 border rounded-full cursor-ew-resize hover:bg-blue-50 shadow-sm z-30 flex items-center justify-center"
                          style={{
                            width: `${edgeThickness}px`,
                            height: `${edgeLength}px`,
                            right: `${-edgeThickness / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                        {/* West */}
                        <div
                          data-handle="w"
                          data-crop-id={crop.id}
                          className="absolute top-1/2 -translate-y-1/2 bg-white/80 border rounded-full cursor-ew-resize hover:bg-blue-50 shadow-sm z-30 flex items-center justify-center"
                          style={{
                            width: `${edgeThickness}px`,
                            height: `${edgeLength}px`,
                            left: `${-edgeThickness / 2}px`,
                            borderColor: borderSettings.color,
                          }}
                        />
                      </>
                    );
                  })()}
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
