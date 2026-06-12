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
        $today        = now('Europe/Istanbul')->toDateString();
        $startOfMonth = now('Europe/Istanbul')->startOfMonth()->toDateString();
        $endOfMonth   = now('Europe/Istanbul')->endOfMonth()->toDateString();
        $unpaid       = [
            InstallmentStatus::Pending->value,
            InstallmentStatus::Partial->value,
            InstallmentStatus::Overdue->value,
        ];

        // Single query: total remaining + overdue total + overdue count + active customers
        $row = DB::selectOne("
            SELECT
                SUM(i.amount - i.paid_amount)                                          AS total_remaining,
                SUM(CASE WHEN i.due_date < ? THEN i.amount - i.paid_amount ELSE 0 END) AS overdue_total,
                SUM(CASE WHEN i.due_date < ? THEN 1 ELSE 0 END)                        AS overdue_count,
                COUNT(DISTINCT s.customer_id)                                           AS active_customers
            FROM installments i
            JOIN sales s ON s.id = i.sale_id AND s.deleted_at IS NULL
            WHERE i.status IN (?, ?, ?)
        ", [$today, $today, ...$unpaid]);

        // Single query: payment totals (this month + all time)
        $payments = DB::selectOne("
            SELECT
                SUM(amount)                                                            AS all_time,
                SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN amount ELSE 0 END)         AS this_month
            FROM payments
        ", [$startOfMonth, $endOfMonth]);

        return response()->json([
            'data' => [
                'total_remaining_debt' => number_format((float) ($row->total_remaining ?? 0), 2, '.', ''),
                'overdue_total'        => number_format((float) ($row->overdue_total ?? 0), 2, '.', ''),
                'overdue_count'        => (int) ($row->overdue_count ?? 0),
                'collected_this_month' => number_format((float) ($payments->this_month ?? 0), 2, '.', ''),
                'collected_all_time'   => number_format((float) ($payments->all_time ?? 0), 2, '.', ''),
                'active_customers'     => (int) ($row->active_customers ?? 0),
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
