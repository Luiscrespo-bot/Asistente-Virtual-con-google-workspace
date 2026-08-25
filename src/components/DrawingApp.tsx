import React, { useRef, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { X, Undo2, MousePointer2, Pencil, Square, Minus, ArrowRight, Trash2, Eraser } from 'lucide-react';
import { fabric } from 'fabric';

type Tool = 'select' | 'draw' | 'eraser' | 'rect' | 'line' | 'arrow';

export default function DrawingApp({ user }: { user: User }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  
  const [drawings, setDrawings] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#22d3ee');
  const [brushSize, setBrushSize] = useState(2);
  const [history, setHistory] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    loadDrawings();
    
    const handleCommand = (e: any) => {
      if (e.detail === 'ampliar') {
        setDrawings(current => {
          if (current.length > 0) setModalImage(current[0].imageData);
          return current;
        });
      }
    };
    
    window.addEventListener('app-command', handleCommand);
    return () => window.removeEventListener('app-command', handleCommand);
  }, []);

  const loadDrawings = async () => {
    const q = query(collection(db, 'drawings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    setDrawings(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: containerRef.current.clientWidth,
      height: 400,
      backgroundColor: '#ffffff'
    });
    
    fabricRef.current = canvas;
    
    setHistory([JSON.stringify(canvas)]);
    
    const saveState = () => {
       setHistory(prev => {
         const newState = JSON.stringify(canvas);
         const next = [...prev, newState];
         setCanUndo(next.length > 1);
         return next;
       });
    };

    canvas.on('object:added', (e: any) => {
      if (!e.target?.excludeFromExport) saveState();
    });
    canvas.on('object:modified', saveState);
    
    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === 'draw' || activeTool === 'eraser';
    canvas.selection = activeTool === 'select';
    canvas.forEachObject(obj => {
      obj.selectable = activeTool === 'select';
      obj.evented = activeTool === 'select';
    });
    
    if (activeTool === 'draw') {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (activeTool === 'eraser') {
      canvas.freeDrawingBrush.color = '#ffffff';
      canvas.freeDrawingBrush.width = brushSize * 4;
    }

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let currentShape: any = null;
    let tempLine: fabric.Line | null = null;
    let tempTriangle: fabric.Triangle | null = null;

    if (['rect', 'line', 'arrow'].includes(activeTool)) {
      canvas.on('mouse:down', (o) => {
        if (canvas.getActiveObject()) return;
        isDown = true;
        const pointer = canvas.getPointer(o.e);
        startX = pointer.x;
        startY = pointer.y;

        if (activeTool === 'rect') {
          currentShape = new fabric.Rect({
            left: startX, top: startY, width: 0, height: 0,
            fill: 'transparent', stroke: color, strokeWidth: brushSize,
            selectable: false, excludeFromExport: true
          });
          canvas.add(currentShape);
        } else if (activeTool === 'line') {
          currentShape = new fabric.Line([startX, startY, startX, startY], {
            stroke: color, strokeWidth: brushSize, selectable: false, excludeFromExport: true
          });
          canvas.add(currentShape);
        } else if (activeTool === 'arrow') {
          tempLine = new fabric.Line([startX, startY, startX, startY], {
            stroke: color, strokeWidth: brushSize, selectable: false, excludeFromExport: true
          });
          tempTriangle = new fabric.Triangle({
            left: startX, top: startY, originX: 'center', originY: 'center',
            fill: color, width: brushSize * 4 + 5, height: brushSize * 4 + 5, selectable: false, excludeFromExport: true, angle: 90
          });
          canvas.add(tempLine, tempTriangle);
        }
      });

      canvas.on('mouse:move', (o) => {
        if (!isDown) return;
        const pointer = canvas.getPointer(o.e);

        if (activeTool === 'rect' && currentShape) {
          currentShape.set({
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY)
          });
        } else if (activeTool === 'line' && currentShape) {
          currentShape.set({ x2: pointer.x, y2: pointer.y });
        } else if (activeTool === 'arrow' && tempLine && tempTriangle) {
          tempLine.set({ x2: pointer.x, y2: pointer.y });
          const dx = pointer.x - startX;
          const dy = pointer.y - startY;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          tempTriangle.set({ left: pointer.x, top: pointer.y, angle: angle + 90 });
        }
        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        if (!isDown) return;
        isDown = false;
        
        if (activeTool === 'rect' && currentShape) {
           currentShape.set({ selectable: true, excludeFromExport: false });
           currentShape.setCoords();
           canvas.fire('object:modified', { target: currentShape });
        } else if (activeTool === 'line' && currentShape) {
           currentShape.set({ selectable: true, excludeFromExport: false });
           currentShape.setCoords();
           canvas.fire('object:modified', { target: currentShape });
        } else if (activeTool === 'arrow' && tempLine && tempTriangle) {
           tempLine.set({ excludeFromExport: false });
           tempTriangle.set({ excludeFromExport: false });
           const group = new fabric.Group([tempLine, tempTriangle], {
             selectable: true
           });
           canvas.remove(tempLine, tempTriangle);
           canvas.add(group);
        }
        currentShape = null;
        tempLine = null;
        tempTriangle = null;
      });
    }
  }, [activeTool, color, brushSize]);

  const handlePropertyChange = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach(obj => {
        if (obj.type === 'path' || obj.type === 'line' || obj.type === 'rect') {
           if (obj.type === 'rect') obj.set('stroke', color);
           else if (obj.type === 'path' || obj.type === 'line') obj.set('stroke', color);
           obj.set('strokeWidth', brushSize);
        } else if (obj.type === 'group') {
           const objects = (obj as fabric.Group).getObjects();
           objects.forEach(subObj => {
             if (subObj.type === 'line') {
               subObj.set('stroke', color);
               subObj.set('strokeWidth', brushSize);
             } else if (subObj.type === 'triangle') {
               subObj.set('fill', color);
               subObj.set('width', brushSize * 4 + 5);
               subObj.set('height', brushSize * 4 + 5);
             }
           });
        }
      });
      canvas.renderAll();
      setHistory(prev => {
         const newState = JSON.stringify(canvas);
         const next = [...prev, newState];
         setCanUndo(next.length > 1);
         return next;
       });
    }
  };
  
  useEffect(() => {
     handlePropertyChange();
  }, [color, brushSize]);

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const previousState = newHistory[newHistory.length - 1];
    
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.loadFromJSON(previousState, () => {
        canvas.renderAll();
        setHistory(newHistory);
        setCanUndo(newHistory.length > 1);
      });
    }
  };

  const clearCanvas = () => {
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
      const newState = JSON.stringify(canvas);
      setHistory([newState]);
      setCanUndo(false);
    }
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (canvas) {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length) {
        activeObjects.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        setHistory(prev => {
          const newState = JSON.stringify(canvas);
          const next = [...prev, newState];
          setCanUndo(next.length > 1);
          return next;
        });
      }
    }
  };

  const saveDrawing = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!name.trim()) {
      alert("Por favor, ingresa un nombre para el dibujo.");
      return;
    }

    setLoading(true);
    canvas.discardActiveObject();
    canvas.renderAll();
    
    const imageData = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    
    try {
      await addDoc(collection(db, 'drawings'), {
        userId: user.uid,
        name: name,
        imageData: imageData,
        createdAt: serverTimestamp()
      });
      setName('');
      clearCanvas();
      await loadDrawings();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el dibujo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-xl font-light serif italic">Lienzo Interactivo</h2>
          
          <div className="flex flex-wrap items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
             <button onClick={() => setActiveTool('select')} className={`p-2 rounded-lg ${activeTool === 'select' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Seleccionar/Mover/Rotar"><MousePointer2 size={16} /></button>
             <button onClick={() => setActiveTool('draw')} className={`p-2 rounded-lg ${activeTool === 'draw' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Dibujo Libre"><Pencil size={16} /></button>
             <button onClick={() => setActiveTool('eraser')} className={`p-2 rounded-lg ${activeTool === 'eraser' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Borrador"><Eraser size={16} /></button>
             <button onClick={() => setActiveTool('rect')} className={`p-2 rounded-lg ${activeTool === 'rect' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Rectángulo"><Square size={16} /></button>
             <button onClick={() => setActiveTool('line')} className={`p-2 rounded-lg ${activeTool === 'line' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Línea"><Minus size={16} /></button>
             <button onClick={() => setActiveTool('arrow')} className={`p-2 rounded-lg ${activeTool === 'arrow' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:bg-white/5 hover:text-white'}`} title="Flecha"><ArrowRight size={16} /></button>
             
             <div className="w-px h-6 bg-white/10 mx-1"></div>
             
             <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" title="Color" />
             <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20 accent-cyan-400" title="Grosor" />

             <div className="w-px h-6 bg-white/10 mx-1"></div>

             <button onClick={deleteSelected} className="p-2 rounded-lg text-red-400 hover:bg-white/5" title="Borrar Selección"><Trash2 size={16} /></button>
          </div>
        </div>

        <div ref={containerRef} className="bg-white rounded-lg overflow-hidden mb-4 border border-white/10">
          <canvas ref={canvasRef} />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder="Nombre del proyecto..." 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-cyan-500/50"
          />
          <button 
            onClick={undo}
            disabled={!canUndo}
            className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Undo2 size={16} />
            Deshacer
          </button>
          <button 
            onClick={clearCanvas}
            className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-colors text-sm"
          >
            Limpiar Todo
          </button>
          <button 
            onClick={saveDrawing}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors text-sm font-medium"
          >
            {loading ? 'Guardando...' : 'Guardar Proyecto'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[300px]">
        <h2 className="text-xl font-light serif italic mb-4">Mis Proyectos Guardados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-10">
          {drawings.map(d => (
            <div 
              key={d.id} 
              onClick={() => setModalImage(d.imageData)}
              className="bg-white/5 border border-white/10 rounded-xl p-3 overflow-hidden cursor-pointer hover:border-cyan-500/50 transition-colors group"
            >
              <div className="relative">
                <img src={d.imageData} alt={d.name} className="w-full h-32 object-contain bg-white rounded-lg mb-2" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <span className="text-white text-xs font-medium px-3 py-1.5 bg-black/50 rounded-full border border-white/20 backdrop-blur-md">Ampliar</span>
                </div>
              </div>
              <p className="text-sm font-medium text-[#F5F5F5] truncate">{d.name}</p>
              <p className="text-xs text-[#8E9299]">
                {d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'Justo ahora'}
              </p>
            </div>
          ))}
          {drawings.length === 0 && (
            <div className="col-span-full text-center text-[#8E9299] text-sm py-8">
              No tienes dibujos guardados.
            </div>
          )}
        </div>
      </div>

      {modalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalImage(null)}>
          <div className="relative max-w-4xl w-full h-auto bg-[#050505] p-2 rounded-2xl border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setModalImage(null)}
              className="absolute -top-4 -right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 backdrop-blur-md transition-colors"
            >
              <X size={20} />
            </button>
            <img src={modalImage} alt="Proyecto ampliado" className="w-full h-auto max-h-[80vh] object-contain bg-white rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
