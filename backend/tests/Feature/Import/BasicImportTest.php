<?php

declare(strict_types=1);

use App\Models\Customer;
use App\Models\User;
use App\Services\InstallmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

function importUser(): string
{
    return User::factory()->create()->createToken('test')->plainTextToken;
}

function makeCsv(array $rows, array $headers = ['defter', 'sayfa', 'satir', 'musteri_adi', 'telefon', 'tc_kimlik']): UploadedFile
{
    $content = "\xEF\xBB\xBF" . implode(',', $headers) . "\n";
    foreach ($rows as $row) {
        $content .= implode(',', $row) . "\n";
    }
    return UploadedFile::fake()->createWithContent('import.csv', $content);
}

// ── BASIC TEMPLATE ──────────────────────────────────────────────────────────

it('basicTemplate returns CSV download', function () {
    $this->withToken(importUser())
        ->get('/api/v1/imports/basic-template')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
});

// ── BASIC IMPORT ─────────────────────────────────────────────────────────────

it('basicImport creates customers without sales', function () {
    $file = makeCsv([
        ['A', '1', '1', 'Ahmet Yılmaz', '05301234567', '12345678901'],
        ['A', '1', '2', 'Fatma Demir',  '05441234567', ''],
    ]);

    $this->withToken(importUser())
        ->post('/api/v1/imports/customers', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('data.imported', 2)
        ->assertJsonPath('data.skipped', 0);

    expect(Customer::count())->toBe(2);
    expect(Customer::where('import_source', 'csv')->count())->toBe(2);
    expect(Customer::first()->sales()->count())->toBe(0);
});

it('basicImport skips TC kimlik duplicates', function () {
    Customer::factory()->create(['tc_kimlik' => '12345678901']);

    $file = makeCsv([
        ['B', '2', '1', 'Yeni Müşteri', '05501234567', '12345678901'],
    ]);

    $response = $this->withToken(importUser())
        ->post('/api/v1/imports/customers', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('data.imported', 0)
        ->assertJsonPath('data.skipped', 1);

    expect(Customer::count())->toBe(1); // only the pre-existing one
    expect($response->json('data.errors.0.field'))->toBe('tc_kimlik');
});

it('basicImport skips ledger coordinate duplicates', function () {
    Customer::factory()->create(['ledger_name' => 'A', 'ledger_page' => 1, 'ledger_row' => 1]);

    $file = makeCsv([
        ['A', '1', '1', 'Ahmet Yılmaz', '', ''],
    ]);

    $this->withToken(importUser())
        ->post('/api/v1/imports/customers', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('data.imported', 0)
        ->assertJsonPath('data.skipped', 1);

    expect(Customer::count())->toBe(1);
});

// ── PENDING DETAIL ────────────────────────────────────────────────────────────

it('pendingDetail returns customers without sales', function () {
    $withSale    = Customer::factory()->create(['name' => 'Has Sale']);
    $withoutSale = Customer::factory()->create(['name' => 'No Sale']);

    app(InstallmentService::class)->createSale(
        customer: $withSale,
        user: User::factory()->create(),
        totalAmount: '5000',
        downPayment: '0',
        installmentCount: 3,
        firstDueDate: '2024-11-01',
        saleDate: '2024-10-01',
    );

    $this->withToken(importUser())
        ->get('/api/v1/customers/pending-detail')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'No Sale');
});

it('pendingDetail excludes customers with sales', function () {
    $customer = Customer::factory()->create();
    app(InstallmentService::class)->createSale(
        customer: $customer,
        user: User::factory()->create(),
        totalAmount: '1000',
        downPayment: '0',
        installmentCount: 2,
        firstDueDate: '2024-11-01',
        saleDate: '2024-10-01',
    );

    $this->withToken(importUser())
        ->get('/api/v1/customers/pending-detail')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
