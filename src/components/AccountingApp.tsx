import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { getAccessToken } from '../lib/firebase';
import { FileUp, Download, Loader2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AccountingApp({ user }: { user: User }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Materiales');
  const [description, setDescription] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInvoices();

    const handleCommand = (e: any) => {
      if (e.detail === 'pdf') {
        exportPDF();
      } else if (e.detail === 'grafica') {
        document.getElementById('accounting-chart')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    window.addEventListener('app-command', handleCommand);
    return () => window.removeEventListener('app-command', handleCommand);
  }, []);

  const loadInvoices = async () => {
    const q = query(collection(db, 'invoices'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) {
      alert("Por favor ingresa un monto válido.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'invoices'), {
        userId: user.uid,
        amount: Number(amount),
        category,
        description,
        receiptImageData: receiptImage,
        createdAt: serverTimestamp(),
        date: new Date().toISOString()
      });
      setAmount('');
      setDescription('');
      setReceiptImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadInvoices();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la factura');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    // using a ref or direct state since state might be stale in listener if not careful, 
    // but React's dispatchEvent goes through window so we use functional approach for freshness
    setInvoices(currentInvoices => {
      if (currentInvoices.length === 0) {
        alert("No hay gastos para exportar.");
        return currentInvoices;
      }
      const doc = new jsPDF();
      doc.text("Registro de Gastos - Asistente Virtual", 14, 15);
      
      const tableData = currentInvoices.map(inv => [
        inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'Hoy',
        inv.category,
        inv.description,
        `$${inv.amount.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [['Fecha', 'Categoría', 'Descripción', 'Monto']],
        body: tableData,
        startY: 20,
        theme: 'grid',
        headStyles: { fillColor: [34, 211, 238] }
      });

      doc.save("registro_gastos.pdf");
      return currentInvoices;
    });
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        alert("No se encontró el token de acceso.");
        return;
      }
      
      const invoiceData = invoices.map(inv => ({
        date: inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'Hoy',
        category: inv.category,
        description: inv.description,
        amount: inv.amount
      }));

      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, invoices: invoiceData })
      });
      
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert(data.error || "Error al generar el reporte");
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setReportLoading(false);
    }
  };

  const categoryTotals = invoices.reduce((acc, inv) => {
    acc[inv.category] = (acc[inv.category] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(categoryTotals).map(key => ({
    name: key,
    value: categoryTotals[key]
  }));
  const COLORS = ['#22d3ee', '#818cf8', '#34d399', '#f472b6', '#fbbf24'];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-light serif italic">Contabilidad y Facturas</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => exportPDF()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium"
            >
              <FileText size={16} />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
            <button 
              onClick={generateReport}
              disabled={reportLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors text-sm font-medium"
            >
              {reportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="hidden sm:inline">Reporte Sheets</span>
            </button>
          </div>
        </div>

        <form onSubmit={saveInvoice} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8E9299] mb-1">Monto ($)</label>
            <input 
              type="number" 
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8E9299] mb-1">Categoría</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-cyan-500/50"
            >
              <option value="Materiales">Materiales</option>
              <option value="Servicios">Servicios</option>
              <option value="Transporte">Transporte</option>
              <option value="Software">Software</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-[#8E9299] mb-1">Descripción</label>
            <input 
              type="text" 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-[#8E9299] mb-1">Recibo (opcional)</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                id="receipt-upload"
              />
              <label 
                htmlFor="receipt-upload"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors text-sm text-[#F5F5F5]"
              >
                <FileUp size={16} />
                Subir Imagen
              </label>
              {receiptImage && <span className="text-xs text-green-400">Imagen adjunta</span>}
            </div>
          </div>
          <div className="sm:col-span-2 pt-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-colors text-sm font-medium"
            >
              {loading ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 min-h-[300px] grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3 pb-10">
          <h2 className="text-xl font-light serif italic mb-4">Registro de Gastos</h2>
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {inv.receiptImageData && (
                  <img src={inv.receiptImageData} alt="Recibo" className="w-12 h-12 rounded object-cover" />
                )}
                <div>
                  <p className="text-sm font-medium text-[#F5F5F5]">{inv.description}</p>
                  <p className="text-xs text-[#8E9299]">
                    {inv.category} • {inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'Hoy'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg text-cyan-400 font-medium">${inv.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {invoices.length === 0 && (
            <div className="text-center text-[#8E9299] text-sm py-8">
              No hay gastos registrados.
            </div>
          )}
        </div>
        
        <div className="lg:col-span-1 pb-10" id="accounting-chart">
          <h2 className="text-xl font-light serif italic mb-4">Resumen por Categoría</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 h-[300px] flex items-center justify-center">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#F5F5F5' }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[#8E9299]">Sin datos para graficar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
