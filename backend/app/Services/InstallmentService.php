<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\InstallmentStatus;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\Sale;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InstallmentService
{
    /**
     * Build a preview of the installment schedule without persisting.
     *
     * @return array<int, array{sequence: int, amount: string, due_date: string}>
     */
    public function preview(
        string $totalAmount,
        string $downPayment,
        int $installmentCount,
        string $firstDueDate,
    ): array {
        $schedule = $this->buildSchedule(
            $totalAmount,
            $downPayment,
            $installmentCount,
            $firstDueDate,
        );

        return array_map(fn ($row) => [
            'sequence' => $row['sequence'],
            'amount' => number_format((float) $row['amount_kuruş'] / 100, 2, '.', ''),
            'due_date' => $row['due_date'],
        ], $schedule);
    }

    /**
     * Create a sale and its full installment schedule atomically.
     */
    public function createSale(
        Customer $customer,
        User $user,
        string $totalAmount,
        string $downPayment,
        int $installmentCount,
        string $firstDueDate,
        string $saleDate,
        ?string $description = null,
    ): Sale {
        $financedKurus = $this->financedKurus($totalAmount, $downPayment);
        $schedule = $this->buildSchedule($totalAmount, $downPayment, $installmentCount, $firstDueDate);

        return DB::transaction(function () use (
            $customer, $user, $totalAmount, $downPayment,
            $installmentCount, $firstDueDate, $saleDate,
            $description, $financedKurus, $schedule,
        ) {
            $sale = Sale::create([
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'description' => $description,
                'total_amount' => number_format((float) $this->toKurus($totalAmount) / 100, 2, '.', ''),
                'down_payment' => number_format((float) $this->toKurus($downPayment) / 100, 2, '.', ''),
                'financed_amount' => number_format((float) $financedKurus / 100, 2, '.', ''),
                'installment_count' => $installmentCount,
                'sale_date' => $saleDate,
                'first_due_date' => $firstDueDate,
            ]);

            foreach ($schedule as $row) {
                Installment::create([
                    'sale_id' => $sale->id,
                    'sequence' => $row['sequence'],
                    'amount' => number_format((float) $row['amount_kuruş'] / 100, 2, '.', ''),
                    'paid_amount' => '0.00',
                    'due_date' => $row['due_date'],
                    'status' => InstallmentStatus::Pending,
                ]);
            }

            return $sale->load('installments');
        });
    }

    /**
     * Build installment rows in integer kuruş.
     * The LAST installment absorbs any rounding remainder.
     *
     * @return array<int, array{sequence: int, amount_kuruş: int, due_date: string}>
     */
    private function buildSchedule(
        string $totalAmount,
        string $downPayment,
        int $installmentCount,
        string $firstDueDate,
    ): array {
        $financedKurus = $this->financedKurus($totalAmount, $downPayment);
        $baseKurus = intdiv($financedKurus, $installmentCount);
        $remainder = $financedKurus - ($baseKurus * $installmentCount);

        $schedule = [];
        $dueDate = Carbon::parse($firstDueDate);

        for ($i = 1; $i <= $installmentCount; $i++) {
            $amount = $baseKurus;
            if ($i === $installmentCount) {
                $amount += $remainder;
            }
            $schedule[] = [
                'sequence' => $i,
                'amount_kuruş' => $amount,
                'due_date' => $dueDate->toDateString(),
            ];
            $dueDate->addMonth();
        }

        return $schedule;
    }

    private function financedKurus(string $totalAmount, string $downPayment): int
    {
        return $this->toKurus($totalAmount) - $this->toKurus($downPayment);
    }

    private function toKurus(string $amount): int
    {
        // bcmath: multiply by 100, round to integer kuruş
        return (int) bcmul($amount, '100', 0);
    }
}
