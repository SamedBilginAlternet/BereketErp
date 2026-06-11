<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\InstallmentStatus;
use App\Models\Installment;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PaymentService
{
    public function recordPayment(
        Installment $installment,
        User $user,
        string $amount,
        string $paidAt,
        ?string $note = null,
    ): Payment {
        if (bccomp($amount, '0.00', 2) <= 0) {
            throw new InvalidArgumentException('Ödeme tutarı sıfırdan büyük olmalıdır.');
        }

        if ($installment->status === InstallmentStatus::Paid) {
            throw new InvalidArgumentException('Bu taksit zaten ödenmiş.');
        }

        $remaining = bcsub((string) $installment->amount, (string) $installment->paid_amount, 2);

        if (bccomp($amount, $remaining, 2) > 0) {
            throw new InvalidArgumentException(
                "Ödeme tutarı kalan borçtan fazla olamaz. Kalan: {$remaining} ₺"
            );
        }

        return DB::transaction(function () use ($installment, $user, $amount, $paidAt, $note) {
            $payment = Payment::create([
                'installment_id' => $installment->id,
                'user_id' => $user->id,
                'amount' => $amount,
                'paid_at' => $paidAt,
                'note' => $note,
            ]);

            $newPaid = bcadd((string) $installment->paid_amount, $amount, 2);
            $newStatus = bccomp($newPaid, (string) $installment->amount, 2) >= 0
                ? InstallmentStatus::Paid
                : InstallmentStatus::Partial;

            $installment->update([
                'paid_amount' => $newPaid,
                'status' => $newStatus,
            ]);

            return $payment;
        });
    }

    /**
     * Refresh overdue status for all pending/partial installments whose due_date < today.
     * Idempotent — safe to run multiple times per day.
     */
    public function refreshOverdueStatuses(): int
    {
        return Installment::query()
            ->whereIn('status', [InstallmentStatus::Pending->value, InstallmentStatus::Partial->value])
            ->where('due_date', '<', now()->toDateString())
            ->update(['status' => InstallmentStatus::Overdue]);
    }

    /**
     * Calculate the total balance for a customer.
     *
     * @return array{total_debt: string, remaining_installments: int, next_payment_amount: string|null, next_due_date: string|null}
     */
    public function customerBalance(int $customerId): array
    {
        $installments = Installment::query()
            ->whereHas('sale', fn ($q) => $q->where('customer_id', $customerId))
            ->whereNotIn('status', [InstallmentStatus::Paid->value])
            ->orderBy('due_date')
            ->get();

        $totalDebt = $installments->reduce(
            fn ($carry, $i) => bcadd($carry, bcsub((string) $i->amount, (string) $i->paid_amount, 2), 2),
            '0.00'
        );

        $next = $installments->first();

        return [
            'total_debt' => $totalDebt,
            'remaining_installments' => $installments->count(),
            'next_payment_amount' => $next
                ? bcsub((string) $next->amount, (string) $next->paid_amount, 2)
                : null,
            'next_due_date' => $next?->due_date?->toDateString(),
        ];
    }
}
