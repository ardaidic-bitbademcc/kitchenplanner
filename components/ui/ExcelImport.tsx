"use client";
import { useState, useRef } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import toast from "react-hot-toast";

interface Props {
  type: "raw-materials" | "base-products" | "products";
  onSuccess: () => void;
}

export function ExcelImport({ type, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[]; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    window.open(`/api/excel/template/${type}`, "_blank");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Sadece .xlsx veya .xls dosyaları kabul edilir");
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/excel/import/${type}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      toast.error(data.error || "İçe aktarma hatası");
      return;
    }

    setResult(data);
    if (data.inserted > 0) {
      toast.success(`${data.inserted} kayıt başarıyla eklendi`);
      onSuccess();
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        📥 Excel İçe Aktar
      </Button>

      <Modal open={open} onClose={() => { setOpen(false); setResult(null); }} title="Excel İle Toplu Ekleme">
        <div className="space-y-5">
          {/* Step 1: Download template */}
          <div className="border border-cream-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-brown-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">1</span>
              <span className="font-medium text-brown-800">Şablonu İndir</span>
            </div>
            <p className="text-sm text-brown-500 pl-7">Zorunlu kolonları ve örnek verileri içeren Excel şablonunu indirin.</p>
            <div className="pl-7">
              <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}>
                📄 Şablonu İndir (.xlsx)
              </Button>
            </div>
          </div>

          {/* Step 2: Fill in */}
          <div className="border border-cream-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-brown-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">2</span>
              <span className="font-medium text-brown-800">Şablonu Doldur</span>
            </div>
            <p className="text-sm text-brown-500 pl-7">Örnek satırları sil, kendi verilerini gir. <strong>*</strong> ile işaretli alanlar zorunludur.</p>
          </div>

          {/* Step 3: Upload */}
          <div className="border border-cream-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-brown-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">3</span>
              <span className="font-medium text-brown-800">Dosyayı Yükle</span>
            </div>
            <div className="pl-7">
              <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl p-6 cursor-pointer transition ${uploading ? "opacity-50 cursor-not-allowed" : "border-cream-300 hover:border-brown-400 hover:bg-cream-50"}`}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
                {uploading ? (
                  <span className="text-sm text-brown-500">Yükleniyor...</span>
                ) : (
                  <>
                    <span className="text-2xl">📂</span>
                    <span className="text-sm text-brown-600 font-medium">Excel dosyası seç</span>
                    <span className="text-xs text-brown-400">(.xlsx, .xls)</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.errors.length === 0 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
              <p className="font-medium text-sm mb-2">
                {result.inserted > 0
                  ? `✅ ${result.inserted} / ${result.total} kayıt eklendi`
                  : `❌ Hiç kayıt eklenemedi`}
              </p>
              {result.errors.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-yellow-800">⚠️ {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => { setOpen(false); setResult(null); }}>Kapat</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
