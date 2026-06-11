<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\InstallmentStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    public function summary(): JsonResponse
    {
        $today = now('Europe/Istanbul')->toDateString();

        $totalRemaining = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->whereNull('sales.deleted_at')
            ->sum(DB::raw('installments.amount - installments.paid_amount'));

        $overdueTotal = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->where('installments.due_date', '<', $today)
            ->whereNull('sales.deleted_at')
            ->sum(DB::raw('installments.amount - installments.paid_amount'));

        $overdueCount = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->where('installments.due_date', '<', $today)
            ->whereNull('sales.deleted_at')
            ->count();

        $startOfMonth = now('Europe/Istanbul')->startOfMonth()->toDateString();
        $endOfMonth   = now('Europe/Istanbul')->endOfMonth()->toDateString();

        $collectedThisMonth = DB::table('payments')
            ->whereBetween('paid_at', [$startOfMonth, $endOfMonth])
            ->sum('amount');

        $collectedAllTime = DB::table('payments')->sum('amount');

        $activeCustomers = DB::table('customers')
            ->join('sales', 'sales.customer_id', '=', 'customers.id')
            ->join('installments', 'installments.sale_id', '=', 'sales.id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->whereNull('sales.deleted_at')
            ->whereNull('customers.deleted_at')
            ->distinct('customers.id')
            ->count('customers.id');

        return response()->json([
            'data' => [
                'total_remaining_debt' => number_format((float) $totalRemaining, 2, '.', ''),
                'overdue_total'        => number_format((float) $overdueTotal, 2, '.', ''),
                'overdue_count'        => $overdueCount,
                'collected_this_month' => number_format((float) $collectedThisMonth, 2, '.', ''),
                'collected_all_time'   => number_format((float) $collectedAllTime, 2, '.', ''),
                'active_customers'     => $activeCustomers,
            ],
        ]);
    }

    public function aging(): JsonResponse
    {
        $today = now('Europe/Istanbul')->toDateString();

        $rows = DB::table('installments')
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
                'installments.sequence',
                'installments.due_date',
                DB::raw('installments.amount - installments.paid_amount as remaining'),
                DB::raw('DATEDIFF(CURDATE(), installments.due_date) as days_overdue'),
            )
            ->orderByDesc('days_overdue')
            ->get();

        $bucketDefs = [
            '1-30'  => [1, 30],
            '31-60' => [31, 60],
            '61-90' => [61, 90],
            '90+'   => [91, PHP_INT_MAX],
        ];

        $buckets = [];
        foreach ($bucketDefs as $label => [$min, $max]) {
            $filtered = $rows->filter(fn ($r) => $r->days_overdue >= $min && $r->days_overdue <= $max);
            $total    = $filtered->sum(fn ($r) => (float) $r->remaining);
            $buckets[] = [
                'bucket' => $label,
                'count'  => $filtered->count(),
                'total'  => number_format($total, 2, '.', ''),
                'items'  => $filtered->values(),
            ];
        }

        return response()->json(['data' => $buckets]);
    }
}
