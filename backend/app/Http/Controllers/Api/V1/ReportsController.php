<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\InstallmentStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    public function summary(): JsonResponse
    {
        $today        = now('Europe/Istanbul')->toDateString();
        $startOfMonth = now('Europe/Istanbul')->startOfMonth()->toDateString();
        $endOfMonth   = now('Europe/Istanbul')->endOfMonth()->toDateString();

        $data = Cache::remember("reports.summary.{$today}", 60, function () use ($today, $startOfMonth, $endOfMonth) {
            $unpaid = [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ];

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

            $payments = DB::selectOne("
                SELECT
                    SUM(amount)                                                        AS all_time,
                    SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN amount ELSE 0 END)     AS this_month
                FROM payments
            ", [$startOfMonth, $endOfMonth]);

            return [
                'total_remaining_debt' => number_format((float) ($row->total_remaining ?? 0), 2, '.', ''),
                'overdue_total'        => number_format((float) ($row->overdue_total ?? 0), 2, '.', ''),
                'overdue_count'        => (int) ($row->overdue_count ?? 0),
                'collected_this_month' => number_format((float) ($payments->this_month ?? 0), 2, '.', ''),
                'collected_all_time'   => number_format((float) ($payments->all_time ?? 0), 2, '.', ''),
                'active_customers'     => (int) ($row->active_customers ?? 0),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function aging(): JsonResponse
    {
        $today = now('Europe/Istanbul')->toDateString();

        $data = Cache::remember("reports.aging.{$today}", 60, function () use ($today) {
            $unpaid = [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ];

            $rows = DB::table('installments as i')
                ->join('sales as s', 's.id', '=', 'i.sale_id')
                ->join('customers as c', 'c.id', '=', 's.customer_id')
                ->whereIn('i.status', $unpaid)
                ->where('i.due_date', '<', $today)
                ->whereNull('s.deleted_at')
                ->selectRaw('
                    c.id   AS customer_id,
                    c.name AS customer_name,
                    c.phone,
                    i.sequence,
                    i.due_date,
                    i.amount - i.paid_amount              AS remaining,
                    DATEDIFF(?, i.due_date)               AS days_overdue,
                    CASE
                        WHEN DATEDIFF(?, i.due_date) <= 30 THEN \'1-30\'
                        WHEN DATEDIFF(?, i.due_date) <= 60 THEN \'31-60\'
                        WHEN DATEDIFF(?, i.due_date) <= 90 THEN \'61-90\'
                        ELSE \'90+\'
                    END AS bucket
                ', [$today, $today, $today, $today])
                ->orderByDesc('days_overdue')
                ->get();

            $order = ['1-30', '31-60', '61-90', '90+'];
            $grouped = $rows->groupBy('bucket');

            return collect($order)->map(function ($label) use ($grouped) {
                $items = $grouped->get($label, collect());
                return [
                    'bucket' => $label,
                    'count'  => $items->count(),
                    'total'  => number_format((float) $items->sum('remaining'), 2, '.', ''),
                    'items'  => $items->values(),
                ];
            })->values()->all();
        });

        return response()->json(['data' => $data]);
    }
}
