import React, { useState, useEffect, useRef } from 'react';
import { Play, Code, Layout, Terminal } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';

type SandboxMode = 'web' | 'python';

export default function SandboxApp({ initialCode, initialLanguage }: { initialCode: string, initialLanguage: string }) {
  const [mode, setMode] = useState<SandboxMode>(
    ['html', 'javascript', 'css', 'web'].includes(initialLanguage.toLowerCase()) ? 'web' : 'python'
  );
  const [code, setCode] = useState(initialCode || '');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setMode(['html', 'javascript', 'css', 'web'].includes(initialLanguage.toLowerCase()) ? 'web' : 'python');
    }
  }, [initialCode, initialLanguage]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Ejecutando...');

    if (mode === 'web') {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = code;
      }
      setOutput('Renderizado en la vista previa.');
      setIsRunning(false);
    } else {
      try {
        // Ejecutar en el backend (el backend ejecuta el python real)
        const res = await fetch('/api/execute-sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: 'python', code })
        });
        const data = await res.json();
        
        if (data.success) {
          setOutput(data.output || 'Ejecutado sin salida.');
        } else {
          setOutput(`Error:\n${data.error}\n\n${data.output || ''}`);
        }
      } catch (err: any) {
        setOutput(`Error de red: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }
  };

  const getLanguageForPrism = () => {
    if (mode === 'python') return Prism.languages.python;
    return Prism.languages.markup; // para web podemos usar markup que incluye tags
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
        <h2 className="text-xl font-light serif italic flex items-center gap-2">
          <Terminal size={20} className="text-cyan-400" />
          Code Sandbox
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setMode('python')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'python' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:text-white hover:bg-white/5'}`}
            >
              Python
            </button>
            <button 
              onClick={() => setMode('web')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'web' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#8E9299] hover:text-white hover:bg-white/5'}`}
            >
              HTML/JS/CSS
            </button>
          </div>
          <button 
            onClick={runCode}
            disabled={isRunning || !code.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Play size={16} />
            {isRunning ? 'Ejecutando...' : 'Ejecutar'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 overflow-hidden">
        {/* Editor Pane */}
        <div className="flex-1 bg-[#1a1b26] border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-[300px]">
          <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2 text-sm text-[#8E9299]">
            <Code size={16} />
            Editor ({mode === 'python' ? 'main.py' : 'index.html'})
          </div>
          <div className="flex-1 overflow-auto p-4 custom-scrollbar" style={{ fontSize: '14px', fontFamily: '"Fira Code", monospace' }}>
            <Editor
              value={code}
              onValueChange={setCode}
              highlight={code => Prism.highlight(code, mode === 'python' ? Prism.languages.python : Prism.languages.markup, mode === 'python' ? 'python' : 'markup')}
              padding={10}
              style={{
                fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                fontSize: 14,
                backgroundColor: 'transparent',
                minHeight: '100%',
              }}
              textareaClassName="focus:outline-none"
            />
          </div>
        </div>

        {/* Output Pane */}
        <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-[300px]">
          <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2 text-sm text-[#8E9299]">
            <Layout size={16} />
            Resultado
          </div>
          <div className="flex-1 bg-white relative p-4">
            {mode === 'web' ? (
              <iframe 
                ref={iframeRef}
                className="w-full h-full border-none bg-white rounded-lg"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-modals"
              />
            ) : (
              <pre className="w-full h-full text-black font-mono text-sm overflow-auto whitespace-pre-wrap">
                {output || 'La salida de tu programa aparecerá aquí...'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
