<?php

declare(strict_types=1);

use App\Enums\InstallmentStatus;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\User;
use App\Services\InstallmentService;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function setupSale(int $installments = 3): array
{
    $user = User::factory()->create();
    $customer = Customer::factory()->create();
    $sale = app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', $installments, '2024-11-15', '2024-10-01'
    );
    return [$user, $customer, $sale, $user->createToken('t')->plainTextToken];
}

// ── PARTIAL PAYMENT ───────────────────────────────────────────────────────────

it('records partial payment and sets status to partial', function () {
    [$user, , $sale, $token] = setupSale();
    $installment = $sale->installments->first();

    $this->withToken($token)
        ->postJson("/api/v1/installments/{$installment->id}/payments", [
            'amount' => 600,
            'paid_at' => '2024-11-15',
        ])
        ->assertCreated()
        ->assertJsonPath('data.amount', '600.00');

    $installment->refresh();
    expect($installment->paid_amount)->toBe('600.00');
    expect($installment->status)->toBe(InstallmentStatus::Partial);
});

it('paying the remainder marks installment as paid', function () {
    [$user, , $sale, $token] = setupSale();
    $installment = $sale->installments->first();
    $remaining = (string) $installment->amount;

    $this->withToken($token)
        ->postJson("/api/v1/installments/{$installment->id}/payments", [
            'amount' => $remaining,
            'paid_at' => '2024-11-15',
        ])
        ->assertCreated();

    $installment->refresh();
    expect($installment->status)->toBe(InstallmentStatus::Paid);
});

it('partial payment then full payment marks paid', function () {
    [$user, , $sale, $token] = setupSale();
    $installment = $sale->installments->first();
    $amount = (float) $installment->amount;

    $this->withToken($token)->postJson("/api/v1/installments/{$installment->id}/payments", [
        'amount' => $amount * 0.6,
        'paid_at' => '2024-11-15',
    ]);
    $this->withToken($token)->postJson("/api/v1/installments/{$installment->id}/payments", [
        'amount' => $amount * 0.4,
        'paid_at' => '2024-11-20',
    ]);

    $installment->refresh();
    expect($installment->status)->toBe(InstallmentStatus::Paid);
});

it('rejects overpayment', function () {
    [$user, , $sale, $token] = setupSale();
    $installment = $sale->installments->first();
    $overAmount = bcadd((string) $installment->amount, '0.01', 2);

    $this->withToken($token)
        ->postJson("/api/v1/installments/{$installment->id}/payments", [
            'amount' => $overAmount,
            'paid_at' => '2024-11-15',
        ])
        ->assertUnprocessable()
        ->assertJsonPath('message', fn ($msg) => str_contains($msg, 'kalan'));
});

it('rejects payment on already paid installment', function () {
    [$user, , $sale, $token] = setupSale();
    $installment = $sale->installments->first();

    $this->withToken($token)->postJson("/api/v1/installments/{$installment->id}/payments", [
        'amount' => (string) $installment->amount,
        'paid_at' => '2024-11-15',
    ]);

    $this->withToken($token)
        ->postJson("/api/v1/installments/{$installment->id}/payments", [
            'amount' => '1',
            'paid_at' => '2024-11-16',
        ])
        ->assertUnprocessable()
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'ödenmiş'));
});

// ── CUSTOMER BALANCE ──────────────────────────────────────────────────────────

it('customer balance decreases after payment', function () {
    [$user, $customer, $sale, $token] = setupSale(3);
    $installment = $sale->installments->first();

    $before = $this->withToken($token)
        ->getJson("/api/v1/customers/{$customer->id}/balance")
        ->assertOk()
        ->json('data.total_debt');

    $this->withToken($token)->postJson("/api/v1/installments/{$installment->id}/payments", [
        'amount' => (string) $installment->amount,
        'paid_at' => '2024-11-15',
    ]);

    $after = $this->withToken($token)
        ->getJson("/api/v1/customers/{$customer->id}/balance")
        ->json('data.total_debt');

    expect(bccomp($after, $before, 2))->toBe(-1);
});

// ── OVERDUE STATUS ────────────────────────────────────────────────────────────

it('refresh command marks past-due installments as overdue', function () {
    $user = User::factory()->create();
    $customer = Customer::factory()->create();

    // Create a sale with first_due_date in the past
    $sale = app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', 3, '2020-01-01', '2019-12-01'
    );

    app(PaymentService::class)->refreshOverdueStatuses();

    $sale->installments->each(function ($i) {
        $i->refresh();
        expect($i->status)->toBe(InstallmentStatus::Overdue);
    });
});

it('refresh command is idempotent', function () {
    $user = User::factory()->create();
    $customer = Customer::factory()->create();
    app(InstallmentService::class)->createSale(
        $customer, $user, '1000', '0', 2, '2020-01-01', '2019-12-01'
    );

    $svc = app(PaymentService::class);
    $first = $svc->refreshOverdueStatuses();
    $second = $svc->refreshOverdueStatuses();

    expect($second)->toBe(0); // second run changes nothing
});
