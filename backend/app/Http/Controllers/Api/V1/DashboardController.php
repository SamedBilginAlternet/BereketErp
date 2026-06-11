<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\InstallmentStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function daily(): JsonResponse
    {
        $today    = now('Europe/Istanbul')->toDateString();
        $tomorrow = now('Europe/Istanbul')->addDay()->toDateString();

        // Due today: pending/partial whose due_date = today (NOT already overdue bucket)
        $dueToday = $this->bucket($today, $today);

        // Overdue: unpaid with due_date < today
        $overdue = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->join('customers', 'customers.id', '=', 'sales.customer_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->where('installments.due_date', '<', $today)
            ->whereNull('sales.deleted_at')
            ->select(
                'customers.id as customer_id',
                'customers.name as customer_name',
                'customers.phone',
                'installments.id as installment_id',
                'installments.sequence',
                'installments.amount',
                'installments.paid_amount',
                DB::raw('installments.amount - installments.paid_amount as remaining'),
                'installments.due_date',
                'installments.status',
            )
            ->orderBy('installments.due_date')
            ->get();

        // Due tomorrow: pending/partial whose due_date = tomorrow
        $dueTomorrow = $this->bucket($tomorrow, $tomorrow);

        return response()->json([
            'data' => [
                'due_today_count' => $dueToday->count(),
                'overdue_count' => $overdue->count(),
                'due_tomorrow_count' => $dueTomorrow->count(),
                'due_today' => $dueToday,
                'overdue' => $overdue,
                'due_tomorrow' => $dueTomorrow,
            ],
        ]);
    }

    private function bucket(string $from, string $to): \Illuminate\Support\Collection
    {
        return DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->join('customers', 'customers.id', '=', 'sales.customer_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
            ])
            ->whereBetween('installments.due_date', [$from, $to])
            ->whereNull('sales.deleted_at')
            ->select(
                'customers.id as customer_id',
                'customers.name as customer_name',
                'customers.phone',
                'installments.id as installment_id',
                'installments.sequence',
                'installments.amount',
                'installments.paid_amount',
                DB::raw('installments.amount - installments.paid_amount as remaining'),
                'installments.due_date',
                'installments.status',
            )
            ->orderBy('customers.name')
            ->get();
    }
}
