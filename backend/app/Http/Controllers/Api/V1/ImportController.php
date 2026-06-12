<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\InstallmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    private const FULL_HEADERS = [
        'defter',
        'sayfa',
        'satir',
        'musteri_adi',
        'telefon',
        'aciklama',
        'toplam_tutar',
        'pesinet',
        'taksit_sayisi',
        'satis_tarihi',
        'ilk_vade',
    ];

    private const BASIC_HEADERS = [
        'defter',
        'sayfa',
        'satir',
        'musteri_adi',
        'telefon',
        'tc_kimlik',
    ];

    public function __construct(private InstallmentService $installmentService) {}

    public function template(): StreamedResponse
    {
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bereket_sablon.csv"',
        ];

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, self::FULL_HEADERS);
            fputcsv($out, ['A', '1', '1', 'Ahmet Yılmaz', '05301234567', 'Telefon', '5000.00', '500.00', '10', date('Y-m-d'), date('Y-m-d', strtotime('+1 month'))]);
            fclose($out);
        }, 'bereket_sablon.csv', $headers);
    }

    public function basicTemplate(): StreamedResponse
    {
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bereket_musteri_listesi.csv"',
        ];

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, self::BASIC_HEADERS);
            fputcsv($out, ['A', '1', '1', 'Ahmet Yılmaz', '05301234567', '12345678901']);
            fputcsv($out, ['A', '1', '2', 'Fatma Demir', '05441234567', '']);
            fclose($out);
        }, 'bereket_musteri_listesi.csv', $headers);
    }

    public function basicImport(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);

        $path   = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');
        fgetcsv($handle); // skip header

        // First pass: collect all rows
        $allRows = [];
        while (($cols = fgetcsv($handle)) !== false) {
            if (array_filter($cols, fn ($v) => trim($v) !== '') !== []) {
                $allRows[] = array_combine(self::BASIC_HEADERS, array_pad($cols, count(self::BASIC_HEADERS), ''));
            }
        }
        fclose($handle);

        // Bulk pre-load existing TCs and ledger coords (2 queries total)
        $allTcs = array_filter(array_map(fn ($r) => trim($r['tc_kimlik']) ?: null, $allRows));
        $existingTcs = $allTcs
            ? Customer::whereIn('tc_kimlik', $allTcs)->pluck('tc_kimlik')->flip()->all()
            : [];

        $existingCoords = Customer::whereNotNull('ledger_name')
            ->get(['ledger_name', 'ledger_page', 'ledger_row'])
            ->mapWithKeys(fn ($c) => ["{$c->ledger_name}-{$c->ledger_page}-{$c->ledger_row}" => true])
            ->all();

        $rowNum = 1;
        $imported = 0;
        $skipped  = 0;
        $rowErrors = [];

        foreach ($allRows as $row) {
            $rowNum++;

            $v = Validator::make($row, [
                'defter'      => ['required', 'string', 'max:50'],
                'sayfa'       => ['required', 'integer', 'min:1'],
                'satir'       => ['required', 'integer', 'min:1'],
                'musteri_adi' => ['required', 'string', 'max:255'],
                'telefon'     => ['nullable', 'string', 'max:20'],
                'tc_kimlik'   => ['nullable', 'digits:11'],
            ]);

            if ($v->fails()) {
                foreach ($v->errors()->messages() as $field => $msgs) {
                    $rowErrors[] = ['row' => $rowNum, 'field' => $field, 'message' => $msgs[0]];
                }
                continue;
            }

            $tc    = trim($row['tc_kimlik']) ?: null;
            $coord = "{$row['defter']}-{$row['sayfa']}-{$row['satir']}";

            if ($tc !== null && isset($existingTcs[$tc])) {
                $rowErrors[] = ['row' => $rowNum, 'field' => 'tc_kimlik', 'message' => "Bu TC Kimlik numarası ({$tc}) zaten kayıtlı."];
                $skipped++;
                continue;
            }

            if (isset($existingCoords[$coord])) {
                $rowErrors[] = ['row' => $rowNum, 'field' => 'defter/sayfa/satir', 'message' => "Bu defter konumu ({$row['defter']}/{$row['sayfa']}/{$row['satir']}) zaten mevcut."];
                $skipped++;
                continue;
            }

            try {
                Customer::create([
                    'name'          => trim($row['musteri_adi']),
                    'phone'         => trim($row['telefon']) ?: null,
                    'tc_kimlik'     => $tc,
                    'import_source' => 'csv',
                    'ledger_name'   => trim($row['defter']),
                    'ledger_page'   => (int) $row['sayfa'],
                    'ledger_row'    => (int) $row['satir'],
                ]);
                // Keep in-memory sets current so within-file duplicates are also caught
                if ($tc !== null) {
                    $existingTcs[$tc] = true;
                }
                $existingCoords[$coord] = true;
                $imported++;
            } catch (\Throwable $e) {
                $rowErrors[] = ['row' => $rowNum, 'field' => '-', 'message' => 'Kayıt oluşturulamadı: ' . $e->getMessage()];
            }
        }

        return response()->json([
            'data' => ['imported' => $imported, 'skipped' => $skipped, 'errors' => $rowErrors],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);

        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');

        fgetcsv($handle);

        $rowNum    = 1;
        $imported  = 0;
        $skipped   = 0;
        $rowErrors = [];

        // First pass: collect all rows
        $allRows = [];
        while (($cols = fgetcsv($handle)) !== false) {
            if (array_filter($cols, fn ($v) => trim($v) !== '') !== []) {
                $allRows[] = array_combine(self::FULL_HEADERS, array_pad($cols, count(self::FULL_HEADERS), ''));
            }
        }
        fclose($handle);

        // Bulk pre-load existing ledger coords (1 query)
        $existingCoords = Customer::whereNotNull('ledger_name')
            ->get(['ledger_name', 'ledger_page', 'ledger_row'])
            ->mapWithKeys(fn ($c) => ["{$c->ledger_name}-{$c->ledger_page}-{$c->ledger_row}" => true])
            ->all();

        foreach ($allRows as $row) {
            $rowNum++;

            $v = Validator::make($row, [
                'defter'        => ['required', 'string', 'max:50'],
                'sayfa'         => ['required', 'integer', 'min:1'],
                'satir'         => ['required', 'integer', 'min:1'],
                'musteri_adi'   => ['required', 'string', 'max:255'],
                'telefon'       => ['nullable', 'string', 'max:20'],
                'aciklama'      => ['nullable', 'string', 'max:500'],
                'toplam_tutar'  => ['required', 'numeric', 'min:0.01'],
                'pesinet'       => ['required', 'numeric', 'min:0'],
                'taksit_sayisi' => ['required', 'integer', 'min:1', 'max:60'],
                'satis_tarihi'  => ['required', 'date'],
                'ilk_vade'      => ['required', 'date'],
            ]);

            if ($v->fails()) {
                foreach ($v->errors()->messages() as $field => $msgs) {
                    $rowErrors[] = ['row' => $rowNum, 'field' => $field, 'message' => $msgs[0]];
                }
                continue;
            }

            $coord = "{$row['defter']}-{$row['sayfa']}-{$row['satir']}";
            if (isset($existingCoords[$coord])) {
                $rowErrors[] = ['row' => $rowNum, 'field' => 'defter/sayfa/satir', 'message' => "Bu defter konumu ({$row['defter']}/{$row['sayfa']}/{$row['satir']}) zaten mevcut."];
                $skipped++;
                continue;
            }

            try {
                DB::transaction(function () use ($row, $request) {
                    $customer = Customer::create([
                        'name'        => trim($row['musteri_adi']),
                        'phone'       => trim($row['telefon']) ?: null,
                        'ledger_name' => trim($row['defter']),
                        'ledger_page' => (int) $row['sayfa'],
                        'ledger_row'  => (int) $row['satir'],
                    ]);

                    $this->installmentService->createSale(
                        customer: $customer,
                        user: $request->user(),
                        totalAmount: (string) $row['toplam_tutar'],
                        downPayment: (string) $row['pesinet'],
                        installmentCount: (int) $row['taksit_sayisi'],
                        firstDueDate: $row['ilk_vade'],
                        saleDate: $row['satis_tarihi'],
                        description: trim($row['aciklama']) ?: null,
                    );
                });
                $existingCoords[$coord] = true;
                $imported++;
            } catch (\Throwable $e) {
                $rowErrors[] = ['row' => $rowNum, 'field' => '-', 'message' => 'Kayıt oluşturulamadı: ' . $e->getMessage()];
            }
        }

        return response()->json([
            'data' => [
                'imported' => $imported,
                'skipped'  => $skipped,
                'errors'   => $rowErrors,
            ],
        ]);
    }
}
