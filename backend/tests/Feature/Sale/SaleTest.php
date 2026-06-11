<?php

declare(strict_types=1);

use App\Enums\InstallmentStatus;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\User;
use App\Services\InstallmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function saleUser(): string
{
    $user = User::factory()->create();
    return $user->createToken('test')->plainTextToken;
}

// ── INSTALLMENT MATH ─────────────────────────────────────────────────────────

it('splits evenly divisible amount exactly', function () {
    $svc = app(InstallmentService::class);
    $rows = $svc->preview('9000', '0', 3, '2024-11-15');

    expect($rows)->toHaveCount(3);
    expect($rows[0]['amount'])->toBe('3000.00');
    expect($rows[1]['amount'])->toBe('3000.00');
    expect($rows[2]['amount'])->toBe('3000.00');

    $sum = array_reduce($rows, fn ($c, $r) => bcadd($c, $r['amount'], 2), '0');
    expect($sum)->toBe('9000.00');
});

it('last installment absorbs rounding remainder', function () {
    $svc = app(InstallmentService::class);
    // 10000 / 3 = 3333.33 * 2 + 3333.34
    $rows = $svc->preview('10000', '0', 3, '2024-11-15');

    expect($rows[0]['amount'])->toBe('3333.33');
    expect($rows[1]['amount'])->toBe('3333.33');
    expect($rows[2]['amount'])->toBe('3333.34');

    $sum = bcadd(bcadd($rows[0]['amount'], $rows[1]['amount'], 2), $rows[2]['amount'], 2);
    expect($sum)->toBe('10000.00');
});

it('deducts down payment correctly', function () {
    $svc = app(InstallmentService::class);
    // total 12000, peşinat 2000, financed = 10000 / 3
    $rows = $svc->preview('12000', '2000', 3, '2024-11-15');

    $sum = bcadd(bcadd($rows[0]['amount'], $rows[1]['amount'], 2), $rows[2]['amount'], 2);
    expect($sum)->toBe('10000.00');
});

it('handles 1-kuruş remainder on 7 installments', function () {
    $svc = app(InstallmentService::class);
    // 100 / 7 = 14.28 * 6 + 14.32
    $rows = $svc->preview('100', '0', 7, '2024-11-15');
    expect($rows)->toHaveCount(7);
    $sum = array_reduce($rows, fn ($c, $r) => bcadd($c, $r['amount'], 2), '0');
    expect($sum)->toBe('100.00');
});

it('due dates increment monthly', function () {
    $svc = app(InstallmentService::class);
    $rows = $svc->preview('3000', '0', 3, '2024-11-15');

    expect($rows[0]['due_date'])->toBe('2024-11-15');
    expect($rows[1]['due_date'])->toBe('2024-12-15');
    expect($rows[2]['due_date'])->toBe('2025-01-15');
});

// ── API ───────────────────────────────────────────────────────────────────────

it('preview endpoint returns schedule', function () {
    $this->withToken(saleUser())
        ->postJson('/api/v1/sales/preview', [
            'total_amount' => 10000,
            'down_payment' => 0,
            'installment_count' => 3,
            'first_due_date' => '2024-11-15',
        ])
        ->assertOk()
        ->assertJsonPath('data.0.amount', '3333.33')
        ->assertJsonPath('data.2.amount', '3333.34');
});

it('creates sale and installments atomically', function () {
    $customer = Customer::factory()->create();
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'description' => 'Çeyiz seti',
            'total_amount' => 10000,
            'down_payment' => 2000,
            'installment_count' => 3,
            'sale_date' => '2024-10-01',
            'first_due_date' => '2024-11-01',
        ])
        ->assertCreated()
        ->assertJsonPath('data.financed_amount', '8000.00')
        ->assertJsonCount(3, 'data.installments');

    $this->assertDatabaseCount('installments', 3);

    // Exact sum assertion using bcmath (locale-safe)
    $installments = \App\Models\Installment::all();
    $sum = $installments->reduce(fn ($c, $i) => bcadd($c, (string) $i->amount, 2), '0');
    expect($sum)->toBe('8000.00');
});

it('rejects sale with missing customer', function () {
    $this->withToken(saleUser())
        ->postJson('/api/v1/sales', [
            'customer_id' => 9999,
            'total_amount' => 1000,
            'down_payment' => 0,
            'installment_count' => 2,
            'sale_date' => '2024-10-01',
            'first_due_date' => '2024-11-01',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['customer_id']);
});

it('shows sale with installments', function () {
    $customer = Customer::factory()->create();
    $user = User::factory()->create();

    $sale = app(InstallmentService::class)->createSale(
        $customer, $user, '5000', '0', 5, '2024-11-01', '2024-10-01', 'Test'
    );

    $this->withToken($user->createToken('t')->plainTextToken)
        ->getJson("/api/v1/sales/{$sale->id}")
        ->assertOk()
        ->assertJsonCount(5, 'data.installments')
        ->assertJsonPath('data.installments.0.status', InstallmentStatus::Pending->value);
});
