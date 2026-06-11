<?php

declare(strict_types=1);

use App\Enums\InstallmentStatus;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\User;
use App\Services\InstallmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('generates call tasks for due today installments', function () {
    $customer = Customer::factory()->create();
    $user     = User::factory()->create();
    $today    = now()->toDateString();

    app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', 1, $today, $today, 'Test'
    );

    $this->artisan('app:generate-call-tasks', ['--date' => $today])
        ->assertSuccessful();

    expect(DB::table('call_tasks')->where('task_date', $today)->count())->toBe(1);
});

it('is idempotent when run twice', function () {
    $customer = Customer::factory()->create();
    $user     = User::factory()->create();
    $today    = now()->toDateString();

    app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', 1, $today, $today, 'Test'
    );

    $this->artisan('app:generate-call-tasks', ['--date' => $today])->assertSuccessful();
    $this->artisan('app:generate-call-tasks', ['--date' => $today])->assertSuccessful();

    expect(DB::table('call_tasks')->where('task_date', $today)->count())->toBe(1);
});

it('requeues promised installments on promise_date', function () {
    $customer  = Customer::factory()->create();
    $user      = User::factory()->create();
    $yesterday = now()->subDay()->toDateString();
    $today     = now()->toDateString();

    $sale = app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', 1, $yesterday, $yesterday, 'Test'
    );

    // Mark the installment overdue so it is eligible
    $installment = $sale->installments()->first();
    $installment->update(['status' => InstallmentStatus::Overdue->value]);

    // Create a call_task for yesterday and a call_log with promise for today
    $taskId = DB::table('call_tasks')->insertGetId([
        'task_date'      => $yesterday,
        'customer_id'    => $customer->id,
        'installment_id' => $installment->id,
        'priority'       => 1,
        'status'         => 'promised',
        'created_at'     => now(),
        'updated_at'     => now(),
    ]);

    DB::table('call_logs')->insert([
        'call_task_id'   => $taskId,
        'user_id'        => $user->id,
        'outcome'        => 'reached_promised',
        'promise_date'   => $today,
        'promise_amount' => '3000.00',
        'note'           => null,
        'called_at'      => now()->subDay(),
        'created_at'     => now(),
        'updated_at'     => now(),
    ]);

    $this->artisan('app:generate-call-tasks', ['--date' => $today])
        ->assertSuccessful();

    expect(
        DB::table('call_tasks')
            ->where('task_date', $today)
            ->where('installment_id', $installment->id)
            ->count()
    )->toBe(1);
});

it('does not requeue already paid installments', function () {
    $customer  = Customer::factory()->create();
    $user      = User::factory()->create();
    $yesterday = now()->subDay()->toDateString();
    $today     = now()->toDateString();

    $sale = app(InstallmentService::class)->createSale(
        $customer, $user, '3000', '0', 1, $yesterday, $yesterday, 'Test'
    );

    $installment = $sale->installments()->first();
    // Mark as paid — not eligible for re-queue
    $installment->update(['status' => InstallmentStatus::Paid->value]);

    $taskId = DB::table('call_tasks')->insertGetId([
        'task_date'      => $yesterday,
        'customer_id'    => $customer->id,
        'installment_id' => $installment->id,
        'priority'       => 1,
        'status'         => 'promised',
        'created_at'     => now(),
        'updated_at'     => now(),
    ]);

    DB::table('call_logs')->insert([
        'call_task_id'   => $taskId,
        'user_id'        => $user->id,
        'outcome'        => 'reached_promised',
        'promise_date'   => $today,
        'promise_amount' => '3000.00',
        'note'           => null,
        'called_at'      => now()->subDay(),
        'created_at'     => now(),
        'updated_at'     => now(),
    ]);

    $this->artisan('app:generate-call-tasks', ['--date' => $today])
        ->assertSuccessful();

    expect(
        DB::table('call_tasks')
            ->where('task_date', $today)
            ->where('installment_id', $installment->id)
            ->count()
    )->toBe(0);
});
