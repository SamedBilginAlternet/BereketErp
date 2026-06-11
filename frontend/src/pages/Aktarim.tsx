import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { DataTable } from '@/components/DataTable'

interface ImportError { row: number; field: string; message: string }

const errorColumns: ColumnDef<ImportError, unknown>[] = [
  { accessorKey: 'row', header: 'Satır', cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue() as number}</span> },
  { accessorKey: 'field', header: 'Alan', cell: ({ getValue }) => <code className="font-mono text-xs">{getValue() as string}</code> },
  { accessorKey: 'message', header: 'Hata', cell: ({ getValue }) => <span className="text-xs text-red-600">{getValue() as string}</span> },
]

interface ImportResult {
  imported: number
  skipped: number
  errors: ImportError[]
}

async function importLedger(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ data: ImportResult }>('/imports/ledger', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

async function downloadTemplate() {
  const res = await api.get('/imports/template', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bereket_sablon.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Aktarim() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const mutation = useMutation({
    mutationFn: (f: File) => importLedger(f),
    onSuccess: (data) => {
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: () => {
      setResult(null)
    },
  })

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">Excel / CSV Aktarım</h1>
      <p className="text-xs text-muted-foreground mb-5">
        Şablonu indirin, doldurun, yükleyin. Her satır bağımsız olarak doğrulanır.
      </p>

      <div className="bg-card border border-border rounded-lg p-5 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium hover:bg-border transition-colors"
          >
            ↓ Şablonu İndir
          </button>
          <span className="text-xs text-muted-foreground">
            CSV formatı — Excel ile açılır, UTF-8 BOM
          </span>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mb-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Kaldır
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-2">CSV dosyası seçin</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Dosya Seç
              </button>
            </div>
          )}
        </div>

        {file && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(file)}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {mutation.isPending ? 'Aktarılıyor…' : 'Aktar'}
            </button>
          </div>
        )}

        {mutation.isError && (
          <p className="mt-3 text-xs text-red-500">Sunucu hatası. Dosya formatını kontrol edin.</p>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-emerald-800">{result.imported}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Aktarıldı</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-amber-800">{result.skipped}</p>
              <p className="text-xs text-amber-700 mt-0.5">Atlandı (Mükerrer)</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-red-800">{result.errors.length}</p>
              <p className="text-xs text-red-700 mt-0.5">Hatalı Satır</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Hata Detayları</p>
              <DataTable
                data={result.errors}
                columns={errorColumns}
                searchPlaceholder="Hata ara…"
                pageSize={15}
                emptyText="Hata yok."
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
