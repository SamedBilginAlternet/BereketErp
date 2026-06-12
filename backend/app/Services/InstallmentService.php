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
use InvalidArgumentException;

class InstallmentService
{
    /**
     * Build a preview of the installment schedule without persisting.
     *
     * @param  array<int, string>|null  $customAmounts  decimal strings like ['5000.00','4000.00']
     * @return array<int, array{sequence: int, amount: string, due_date: string}>
     */
    public function preview(
        string $totalAmount,
        string $downPayment,
        int $installmentCount,
        string $firstDueDate,
        ?array $customAmounts = null,
    ): array {
        $customAmountsKurus = null;
        if ($customAmounts !== null) {
            $financedKurus = $this->financedKurus($totalAmount, $downPayment);
            $customAmountsKurus = $this->convertAndValidateCustomAmounts($customAmounts, $installmentCount, $financedKurus);
        }

        $schedule = $this->buildSchedule(
            $totalAmount,
            $downPayment,
            $installmentCount,
            $firstDueDate,
            $customAmountsKurus,
        );

        return array_map(fn ($row) => [
            'sequence' => $row['sequence'],
            'amount' => number_format((float) $row['amount_kurus'] / 100, 2, '.', ''),
            'due_date' => $row['due_date'],
        ], $schedule);
    }

    /**
     * Create a sale and its full installment schedule atomically.
     *
     * @param  array<int, string>|null  $customAmounts  decimal strings like ['5000.00','4000.00']
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
        ?array $customAmounts = null,
    ): Sale {
        $financedKurus = $this->financedKurus($totalAmount, $downPayment);
        $customAmountsKurus = null;
        if ($customAmounts !== null) {
            $customAmountsKurus = $this->convertAndValidateCustomAmounts($customAmounts, $installmentCount, $financedKurus);
        }
        $schedule = $this->buildSchedule($totalAmount, $downPayment, $installmentCount, $firstDueDate, $customAmountsKurus);

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

            $now  = now()->toDateTimeString();
            $rows = array_map(fn ($row) => [
                'sale_id'     => $sale->id,
                'sequence'    => $row['sequence'],
                'amount'      => number_format((float) $row['amount_kurus'] / 100, 2, '.', ''),
                'paid_amount' => '0.00',
                'due_date'    => $row['due_date'],
                'status'      => InstallmentStatus::Pending->value,
                'created_at'  => $now,
                'updated_at'  => $now,
            ], $schedule);

            DB::table('installments')->insert($rows);

            return $sale->load('installments');
        });
    }

    /**
     * Build installment rows in integer kurus.
     * The LAST installment absorbs any rounding remainder.
     * If $customAmountsKurus is provided, use those values directly.
     *
     * @param  array<int, int>|null  $customAmountsKurus
     * @return array<int, array{sequence: int, amount_kurus: int, due_date: string}>
     */
    private function buildSchedule(
        string $totalAmount,
        string $downPayment,
        int $installmentCount,
        string $firstDueDate,
        ?array $customAmountsKurus = null,
    ): array {
        $schedule = [];
        $dueDate = Carbon::parse($firstDueDate);

        if ($customAmountsKurus !== null) {
            for ($i = 1; $i <= $installmentCount; $i++) {
                $schedule[] = [
                    'sequence' => $i,
                    'amount_kurus' => $customAmountsKurus[$i - 1],
                    'due_date' => $dueDate->toDateString(),
                ];
                $dueDate->addMonth();
            }

            return $schedule;
        }

        $financedKurus = $this->financedKurus($totalAmount, $downPayment);
        $baseKurus = intdiv($financedKurus, $installmentCount);
        $remainder = $financedKurus - ($baseKurus * $installmentCount);

        for ($i = 1; $i <= $installmentCount; $i++) {
            $amount = $baseKurus;
            if ($i === $installmentCount) {
                $amount += $remainder;
            }
            $schedule[] = [
                'sequence' => $i,
                'amount_kurus' => $amount,
                'due_date' => $dueDate->toDateString(),
            ];
            $dueDate->addMonth();
        }

        return $schedule;
    }

    /**
     * Convert decimal string amounts to kurus integers and validate count and sum.
     *
     * @param  array<int, string>  $customAmounts
     * @return array<int, int>
     *
     * @throws InvalidArgumentException
     */
    private function convertAndValidateCustomAmounts(array $customAmounts, int $installmentCount, int $financedKurus): array
    {
        if (count($customAmounts) !== $installmentCount) {
            throw new InvalidArgumentException(
                sprintf(
                    'Özel tutar sayısı (%d) taksit sayısıyla (%d) eşleşmiyor.',
                    count($customAmounts),
                    $installmentCount,
                )
            );
        }

        $customAmountsKurus = array_map(fn ($a) => $this->toKurus((string) $a), $customAmounts);
        $sumKurus = array_sum($customAmountsKurus);

        if ($sumKurus !== $financedKurus) {
            throw new InvalidArgumentException(
                sprintf(
                    'Özel tutarların toplamı (%.2f ₺) finansman tutarıyla (%.2f ₺) eşleşmiyor.',
                    $sumKurus / 100,
                    $financedKurus / 100,
                )
            );
        }

        return $customAmountsKurus;
    }

    private function financedKurus(string $totalAmount, string $downPayment): int
    {
        return $this->toKurus($totalAmount) - $this->toKurus($downPayment);
    }

    private function toKurus(string $amount): int
    {
        // bcmath: multiply by 100, round to integer kurus
        return (int) bcmul($amount, '100', 0);
    }
}
