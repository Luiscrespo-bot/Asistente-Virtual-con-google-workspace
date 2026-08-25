/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { Mic, MicOff, Send, LogOut, Calendar, Mail, CheckSquare, Loader2, MessageSquare, PenTool, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DrawingApp from './components/DrawingApp';
import AccountingApp from './components/AccountingApp';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'drawing' | 'accounting'>('assistant');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: '¡Hola! Soy tu asistente virtual. Puedo ayudarte a gestionar tu Google Calendar, leer y enviar correos, y gestionar tus tareas. ¿En qué te puedo ayudar hoy?'
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setToken(token);
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setLoginError('El inicio de sesión fue cancelado. Por favor, inténtalo de nuevo.');
      } else {
        setLoginError('Hubo un error al iniciar sesión. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setNeedsAuth(true);
    setToken(null);
    setUser(null);
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || !token) return;

    if (messageText.trim().startsWith('/')) {
      const command = messageText.trim().substring(1).toLowerCase().split(' ')[0];
      
      if (['dibujo', 'ampliar'].includes(command)) {
        setActiveTab('drawing');
        setTimeout(() => window.dispatchEvent(new CustomEvent('app-command', { detail: command })), 100);
      } else if (['pdf', 'grafica', 'contabilidad'].includes(command)) {
        setActiveTab('accounting');
        setTimeout(() => window.dispatchEvent(new CustomEvent('app-command', { detail: command })), 100);
      } else if (['asistente', 'chat'].includes(command)) {
        setActiveTab('assistant');
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: `Comando no reconocido: /${command}. Comandos disponibles: /dibujo, /contabilidad, /asistente, /ampliar, /pdf, /grafica` }]);
        setTextInput('');
        return;
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: `Ejecutando comando: /${command}` }]);
      setTextInput('');
      return;
    }

    const newMessage: Message = { id: Date.now().toString(), role: 'user', text: messageText };
    setMessages(prev => [...prev, newMessage]);
    setTextInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, accessToken: token }),
      });
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: `Error: ${data.error}` }]);
        speakText('Hubo un error al procesar tu solicitud.');
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: data.text }]);
        speakText(data.text);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Error de conexión.' }]);
      speakText('Hubo un error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'es-ES';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onstart = () => setIsRecording(true);
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsRecording(false);
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current.start();
  };

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#F5F5F5] flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden relative shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/20 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="p-8 text-center relative z-10 border-b border-white/5">
            <span className="text-xs uppercase tracking-[0.3em] text-[#8E9299] font-medium block mb-2">Sistema Activo</span>
            <h1 className="text-3xl font-light serif italic mb-2">Asistente Virtual</h1>
            <p className="text-[#8E9299] text-sm">Google Calendar, Gmail y Tasks</p>
          </div>
          <div className="p-8 flex flex-col items-center relative z-10">
            <div className="flex gap-4 mb-8 text-cyan-400/70">
              <Calendar size={32} />
              <Mail size={32} />
              <CheckSquare size={32} />
            </div>
            <p className="text-[#8E9299] text-center mb-8 text-sm">
              Para continuar, inicia sesión y autoriza el acceso a tus servicios de Google Workspace.
            </p>
            {loginError && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center w-full">
                {loginError}
              </div>
            )}
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full flex items-center justify-center bg-white/10 border border-white/20 hover:bg-white/20 rounded shadow-sm py-2.5 px-4 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span className="text-sm font-medium text-[#F5F5F5]">
                  {isLoggingIn ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] flex flex-col font-sans overflow-hidden">
      <header className="bg-transparent border-b border-white/5 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between sticky top-0 z-20 backdrop-blur-md gap-4 sm:gap-0">
        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 p-2 rounded-full text-cyan-400">
            <Mic size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#8E9299] font-bold">Conectado a Google Workspace</span>
            <h1 className="text-xl font-light serif italic">Asistente Virtual</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 mx-auto sm:mx-0 min-h-[44px]">
          {activeTab !== 'assistant' && (
            <div className="bg-white/5 p-1 rounded-full border border-white/10 flex items-center">
              <button 
                onClick={() => setActiveTab('assistant')}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors text-[#8E9299] hover:text-[#F5F5F5] hover:bg-white/5"
              >
                <MessageSquare size={16} />
                <span className="hidden md:inline">Volver al Asistente</span>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-right absolute top-4 right-6 sm:relative sm:top-auto sm:right-auto">
          <span className="text-xs text-[#8E9299] hidden sm:block tracking-widest uppercase">{user?.email}</span>
          <button 
            onClick={handleLogout}
            className="p-2 text-[#8E9299] hover:text-[#F5F5F5] hover:bg-white/5 rounded-full transition-colors border border-transparent hover:border-white/10"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col relative z-10 h-[calc(100vh-[120px])] sm:h-[calc(100vh-80px)] overflow-y-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        {activeTab === 'assistant' && (
          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden flex flex-col relative shadow-2xl min-h-[500px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 border ${
                      msg.role === 'user' 
                        ? 'bg-cyan-500/10 text-cyan-50 border-cyan-500/20 rounded-br-none shadow-[0_0_15px_rgba(34,211,238,0.05)]' 
                        : 'bg-white/5 text-[#F5F5F5] border-white/10 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex justify-start"
              >
                <div className="bg-white/5 border border-white/10 text-[#8E9299] rounded-2xl rounded-bl-none px-5 py-3 flex items-center gap-3 backdrop-blur-sm">
                  <Loader2 className="animate-spin text-cyan-400" size={16} />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-cyan-400/80">Procesando...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-[#050505]/50 border-t border-white/10 backdrop-blur-md">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
              <button onClick={() => sendMessage("Dame un resumen de mi día")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Resumen del día</button>
              <button onClick={() => sendMessage("Escribe y envía un correo")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Enviar Correo</button>
              <button onClick={() => sendMessage("Resume mis últimos correos")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Resumir Correos</button>
              <button onClick={() => sendMessage("¿Cómo está el clima hoy?")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Clima Hoy</button>
              <button onClick={() => sendMessage("Añadir tarea importante")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Nueva Tarea Urgente</button>
              <button onClick={() => sendMessage("Buscar un contacto")} className="whitespace-nowrap px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#8E9299] hover:text-[#F5F5F5] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors">Buscar Contacto</button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(textInput);
              }}
              className="flex items-end gap-3"
            >
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex-shrink-0 p-4 rounded-full transition-all border ${
                  isRecording 
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)] animate-pulse' 
                    : 'bg-white/5 text-[#8E9299] border-white/10 hover:bg-white/10 hover:text-[#F5F5F5]'
                }`}
                title={isRecording ? 'Detener grabación' : 'Hablar'}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Escribe o habla tu comando..."
                  className="w-full bg-white/5 border border-white/10 text-[#F5F5F5] rounded-2xl pl-5 pr-12 py-4 focus:bg-white/10 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all outline-none placeholder-[#8E9299] text-sm"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/40 disabled:opacity-30 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
            {isRecording && (
              <p className="text-center text-[10px] uppercase tracking-[0.4em] text-cyan-400 font-semibold animate-pulse mt-4 mb-2">
                Escuchando comandos...
              </p>
            )}
          </div>
          </div>
        )}

        {activeTab === 'drawing' && (
          <div className="flex-1 w-full relative z-10 animate-in fade-in zoom-in duration-300">
            {user && <DrawingApp user={user} />}
          </div>
        )}

        {activeTab === 'accounting' && (
          <div className="flex-1 w-full relative z-10 animate-in fade-in zoom-in duration-300">
            {user && <AccountingApp user={user} />}
          </div>
        )}
      </main>
    </div>
  );
}
