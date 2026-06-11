import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { FileText, Users, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { DataTable } from '@/components/DataTable'
import { getPendingDetailCustomers, type Customer } from '@/api/customers'

interface ImportError { row: number; field: string; message: string }

const errorColumns: ColumnDef<ImportError, unknown>[] = [
  { accessorKey: 'row', header: 'Satır', cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue() as number}</span> },
  { accessorKey: 'field', header: 'Alan', cell: ({ getValue }) => <code className="font-mono text-xs">{getValue() as string}</code> },
  { accessorKey: 'message', header: 'Hata', cell: ({ getValue }) => <span className="text-xs text-red-600">{getValue() as string}</span> },
]

const pendingColumns: ColumnDef<Customer, unknown>[] = [
  { accessorKey: 'name', header: 'Müşteri Adı' },
  {
    accessorKey: 'ledger_name',
    header: 'Defter Konumu',
    cell: ({ row }) => {
      const c = row.original
      if (!c.ledger_name) return <span className="text-muted-foreground text-xs">—</span>
      return <span className="tabular-nums text-xs">{c.ledger_name}/{c.ledger_page}/{c.ledger_row}</span>
    },
  },
  { accessorKey: 'phone', header: 'Telefon', cell: ({ getValue }) => (getValue() as string) || '—' },
  { accessorKey: 'tc_kimlik', header: 'TC Kimlik', cell: ({ getValue }) => (getValue() as string) || '—' },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Link
        to={`/defter-aktarim?customer_id=${row.original.id}`}
        className="text-xs text-primary hover:underline font-medium"
      >
        Defter Girişi Yap →
      </Link>
    ),
  },
]

interface ImportResult {
  imported: number
  skipped: number
  errors: ImportError[]
}

async function importFull(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ data: ImportResult }>('/imports/ledger', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

async function importBasic(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ data: ImportResult }>('/imports/customers', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

async function downloadTemplate(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(res.data as Blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function ImportPanel({
  onImport,
  templateUrl,
  templateFilename,
  accept,
}: {
  onImport: (file: File) => Promise<ImportResult>
  templateUrl: string
  templateFilename: string
  accept: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const mutation = useMutation({
    mutationFn: (f: File) => onImport(f),
    onSuccess: (data) => {
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
  })

  return (
    <div className="max-w-2xl">
      <div className="border border-border rounded-lg p-5 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => void downloadTemplate(templateUrl, templateFilename)}
            className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium hover:bg-border transition-colors"
          >
            ↓ Şablonu İndir
          </button>
          <span className="text-xs text-muted-foreground">CSV formatı — Excel ile açılır, UTF-8 BOM</span>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mb-4">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
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

function PendingDetailTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['customers-pending-detail'],
    queryFn: getPendingDetailCustomers,
  })

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Temel liste olarak aktarılmış, henüz senet/taksit girişi yapılmamış müşteriler.
        &ldquo;Defter Girişi Yap&rdquo; ile Defter Aktarımı sayfasına yönlendirilirsiniz.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data?.length ? (
        <div className="border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">Bekleyen müşteri yok.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Önce "Temel Liste" sekmesinden müşterileri aktarın.
          </p>
        </div>
      ) : (
        <DataTable
          data={data}
          columns={pendingColumns}
          searchPlaceholder="Müşteri ara…"
          pageSize={25}
          emptyText="Müşteri bulunamadı."
        />
      )}
    </div>
  )
}

type Tab = 'temel' | 'detay' | 'tam'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'temel', label: 'Temel Liste', icon: Users },
  { id: 'detay', label: 'Detay Girişi', icon: FileText },
  { id: 'tam', label: 'Tam Aktarım', icon: Upload },
]

export default function Aktarim() {
  const [activeTab, setActiveTab] = useState<Tab>('temel')

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-7 pb-5 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Excel / CSV Aktarım</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          İki aşamalı aktarım: önce müşteri listesi, sonra finansal detaylar.
        </p>
      </div>

      <div className="border-b border-border px-8">
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {activeTab === 'temel' && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Sadece müşteri bilgilerini (ad, telefon, TC, defter konumu) içeren basit liste.
              Finansal detaylar daha sonra &ldquo;Detay Girişi&rdquo; sekmesinden girilir.
            </p>
            <ImportPanel
              onImport={importBasic}
              templateUrl="/imports/basic-template"
              templateFilename="bereket_musteri_listesi.csv"
              accept=".csv,text/csv"
            />
          </div>
        )}

        {activeTab === 'detay' && <PendingDetailTab />}

        {activeTab === 'tam' && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Müşteri ve tüm finansal bilgileri (tutar, peşinat, taksit, vadeler) tek seferde aktarır.
            </p>
            <ImportPanel
              onImport={importFull}
              templateUrl="/imports/template"
              templateFilename="bereket_sablon.csv"
              accept=".csv,text/csv"
            />
          </div>
        )}
      </div>
    </div>
  )
}
