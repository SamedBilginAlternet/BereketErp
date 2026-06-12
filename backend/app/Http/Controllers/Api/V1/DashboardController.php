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

        $pending = [InstallmentStatus::Pending->value, InstallmentStatus::Partial->value];
        $unpaid  = [...$pending, InstallmentStatus::Overdue->value];

        // Single query covering all three buckets; partition in PHP
        $all = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->join('customers', 'customers.id', '=', 'sales.customer_id')
            ->whereNull('sales.deleted_at')
            ->where(function ($q) use ($today, $tomorrow, $pending, $unpaid) {
                $q->where(function ($inner) use ($today, $unpaid) {
                    $inner->where('installments.due_date', '<', $today)
                          ->whereIn('installments.status', $unpaid);
                })->orWhere(function ($inner) use ($today, $pending) {
                    $inner->where('installments.due_date', $today)
                          ->whereIn('installments.status', $pending);
                })->orWhere(function ($inner) use ($tomorrow, $pending) {
                    $inner->where('installments.due_date', $tomorrow)
                          ->whereIn('installments.status', $pending);
                });
            })
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
            ->orderBy('customers.name')
            ->get();

        $dueToday    = $all->filter(fn ($r) => $r->due_date === $today);
        $overdue     = $all->filter(fn ($r) => $r->due_date < $today);
        $dueTomorrow = $all->filter(fn ($r) => $r->due_date === $tomorrow);

        $sum = fn ($col) => number_format((float) $col->sum('remaining'), 2, '.', '');

        return response()->json([
            'data' => [
                'due_today_count'    => $dueToday->count(),
                'due_today_total'    => $sum($dueToday),
                'overdue_count'      => $overdue->count(),
                'overdue_total'      => $sum($overdue),
                'due_tomorrow_count' => $dueTomorrow->count(),
                'due_tomorrow_total' => $sum($dueTomorrow),
                'due_today'          => $dueToday->values(),
                'overdue'            => $overdue->values(),
                'due_tomorrow'       => $dueTomorrow->values(),
            ],
        ]);
    }
}
