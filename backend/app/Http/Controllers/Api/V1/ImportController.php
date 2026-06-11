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
    private const HEADERS = [
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

    public function __construct(private InstallmentService $installmentService) {}

    public function template(): StreamedResponse
    {
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bereket_sablon.csv"',
        ];

        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel opens correctly
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, self::HEADERS);
            // Example row
            fputcsv($out, ['A', '1', '1', 'Ahmet Yılmaz', '05301234567', 'Telefon', '5000.00', '500.00', '10', date('Y-m-d'), date('Y-m-d', strtotime('+1 month'))]);
            fclose($out);
        }, 'bereket_sablon.csv', $headers);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);

        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');

        // Skip header row
        fgetcsv($handle);

        $rowNum    = 1;
        $imported  = 0;
        $skipped   = 0;
        $rowErrors = [];

        while (($cols = fgetcsv($handle)) !== false) {
            $rowNum++;
            if (array_filter($cols, fn($v) => trim($v) !== '') === []) {
                continue; // blank row
            }

            $row = array_combine(self::HEADERS, array_pad($cols, count(self::HEADERS), ''));

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

            // Duplicate check: same ledger coords
            $duplicate = Customer::where('ledger_name', $row['defter'])
                ->where('ledger_page', (int) $row['sayfa'])
                ->where('ledger_row', (int) $row['satir'])
                ->exists();

            if ($duplicate) {
                $rowErrors[] = [
                    'row'     => $rowNum,
                    'field'   => 'defter/sayfa/satir',
                    'message' => "Bu defter konumu ({$row['defter']}/{$row['sayfa']}/{$row['satir']}) zaten mevcut.",
                ];
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
                $imported++;
            } catch (\Throwable $e) {
                $rowErrors[] = ['row' => $rowNum, 'field' => '-', 'message' => 'Kayıt oluşturulamadı: ' . $e->getMessage()];
            }
        }

        fclose($handle);

        return response()->json([
            'data' => [
                'imported' => $imported,
                'skipped'  => $skipped,
                'errors'   => $rowErrors,
            ],
        ]);
    }
}
