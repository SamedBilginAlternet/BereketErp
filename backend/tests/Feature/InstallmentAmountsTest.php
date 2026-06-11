<?php

declare(strict_types=1);

use App\Enums\InstallmentStatus;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\Sale;
use App\Models\User;
use App\Services\InstallmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function amountsUser(): string
{
    $user = User::factory()->create();
    return $user->createToken('test')->plainTextToken;
}

// ── PREVIEW ENDPOINT ────────────────────────────────────────────────────────

it('custom amounts are accepted by preview endpoint', function () {
    $this->withToken(amountsUser())
        ->postJson('/api/v1/sales/preview', [
            'total_amount'      => 10000,
            'down_payment'      => 0,
            'installment_count' => 3,
            'first_due_date'    => '2024-11-15',
            'amounts'           => ['3000.00', '3000.00', '4000.00'],
        ])
        ->assertOk()
        ->assertJsonPath('data.0.amount', '3000.00')
        ->assertJsonPath('data.1.amount', '3000.00')
        ->assertJsonPath('data.2.amount', '4000.00');
});

it('custom amounts that do not sum to financed amount are rejected with 422', function () {
    $this->withToken(amountsUser())
        ->postJson('/api/v1/sales/preview', [
            'total_amount'      => 10000,
            'down_payment'      => 0,
            'installment_count' => 3,
            'first_due_date'    => '2024-11-15',
            'amounts'           => ['3000.00', '3000.00', '3000.00'], // sum = 9000, not 10000
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.amounts.0', fn ($v) => is_string($v));
});

it('custom amounts count mismatch is rejected with 422', function () {
    $this->withToken(amountsUser())
        ->postJson('/api/v1/sales/preview', [
            'total_amount'      => 10000,
            'down_payment'      => 0,
            'installment_count' => 3,
            'first_due_date'    => '2024-11-15',
            'amounts'           => ['5000.00', '5000.00'], // only 2 items for 3 installments
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.amounts.0', fn ($v) => is_string($v));
});

// ── LEDGER ENTRY ─────────────────────────────────────────────────────────────

it('ledger entry with custom amounts creates correct installments', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/ledger/entry', [
            'ledger_name'       => 'A',
            'ledger_page'       => 1,
            'ledger_row'        => 1,
            'name'              => 'Test Müşteri',
            'total_amount'      => 10000,
            'down_payment'      => 0,
            'installment_count' => 3,
            'sale_date'         => '2024-10-01',
            'first_due_date'    => '2024-11-01',
            'amounts'           => ['2000.00', '3000.00', '5000.00'],
        ])
        ->assertCreated();

    $installments = Installment::all();
    expect($installments)->toHaveCount(3);

    $sorted = $installments->sortBy('sequence')->values();
    expect($sorted[0]->amount)->toBe('2000.00');
    expect($sorted[1]->amount)->toBe('3000.00');
    expect($sorted[2]->amount)->toBe('5000.00');
});

it('ledger entry with paid_installments marks those installments as paid', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/ledger/entry', [
            'ledger_name'       => 'A',
            'ledger_page'       => 1,
            'ledger_row'        => 2,
            'name'              => 'Ödemeli Müşteri',
            'total_amount'      => 9000,
            'down_payment'      => 0,
            'installment_count' => 3,
            'sale_date'         => '2024-10-01',
            'first_due_date'    => '2024-11-01',
            'paid_installments' => [
                ['sequence' => 1, 'paid_at' => '2024-11-01'],
                ['sequence' => 2, 'paid_at' => '2024-12-01'],
            ],
        ])
        ->assertCreated();

    $installments = Installment::all()->sortBy('sequence')->values();
    expect($installments[0]->status)->toBe(InstallmentStatus::Paid);
    expect($installments[1]->status)->toBe(InstallmentStatus::Paid);
    expect($installments[2]->status)->toBe(InstallmentStatus::Pending);
});

it('paid installment with wrong sequence is handled gracefully', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    // sequence 99 does not exist — should be silently skipped
    $this->withToken($token)
        ->postJson('/api/v1/ledger/entry', [
            'ledger_name'       => 'A',
            'ledger_page'       => 1,
            'ledger_row'        => 3,
            'name'              => 'Müşteri X',
            'total_amount'      => 6000,
            'down_payment'      => 0,
            'installment_count' => 2,
            'sale_date'         => '2024-10-01',
            'first_due_date'    => '2024-11-01',
            'paid_installments' => [
                ['sequence' => 99, 'paid_at' => '2024-11-01'],
            ],
        ])
        ->assertCreated();

    // All installments should remain pending (sequence 99 was ignored)
    $installments = Installment::all();
    expect($installments->every(fn ($i) => $i->status === InstallmentStatus::Pending))->toBeTrue();
});
