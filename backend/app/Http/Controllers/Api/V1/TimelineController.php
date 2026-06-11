<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TimelineController extends Controller
{
    public function customer(Customer $customer): JsonResponse
    {
        $events = collect();

        // Sales
        $sales = $customer->sales()->with('installments')->latest('sale_date')->get();
        foreach ($sales as $sale) {
            $events->push([
                'type'    => 'sale',
                'date'    => $sale->sale_date->toDateString(),
                'title'   => $sale->description ?? "Satış #{$sale->id}",
                'detail'  => "{$sale->installment_count} taksit · " . number_format((float) $sale->total_amount, 2, ',', '.') . ' ₺',
                'sale_id' => $sale->id,
            ]);
        }

        // Payments
        $payments = DB::table('payments')
            ->join('installments', 'installments.id', '=', 'payments.installment_id')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->where('sales.customer_id', $customer->id)
            ->select(
                'payments.id',
                'payments.amount',
                'payments.paid_at',
                'payments.note',
                'installments.sequence',
                'sales.description as sale_desc',
                'sales.id as sale_id',
            )
            ->orderByDesc('payments.paid_at')
            ->get();

        foreach ($payments as $p) {
            $events->push([
                'type'    => 'payment',
                'date'    => substr($p->paid_at, 0, 10),
                'title'   => 'Ödeme — Taksit #' . $p->sequence,
                'detail'  => number_format((float) $p->amount, 2, ',', '.') . ' ₺' . ($p->note ? " · {$p->note}" : ''),
                'sale_id' => $p->sale_id,
            ]);
        }

        // Call logs
        $callLogs = DB::table('call_logs')
            ->join('call_tasks', 'call_tasks.id', '=', 'call_logs.call_task_id')
            ->where('call_tasks.customer_id', $customer->id)
            ->select(
                'call_logs.id',
                'call_logs.outcome',
                'call_logs.promise_date',
                'call_logs.promise_amount',
                'call_logs.note',
                'call_logs.called_at',
            )
            ->orderByDesc('call_logs.called_at')
            ->get();

        foreach ($callLogs as $l) {
            $label = match ($l->outcome) {
                'reached_paid'     => 'Arama — Ödeme Alındı',
                'reached_promised' => 'Arama — Söz Alındı',
                'unreachable'      => 'Arama — Ulaşılamadı',
                'postponed'        => 'Arama — Ertelendi',
                default            => 'Arama',
            };
            $detail = $l->note ?? '';
            if ($l->promise_date) {
                $detail = "Söz: {$l->promise_date}" . ($detail ? " · {$detail}" : '');
            }
            $events->push([
                'type'   => 'call',
                'date'   => substr($l->called_at, 0, 10),
                'title'  => $label,
                'detail' => $detail,
            ]);
        }

        // Sort descending by date
        $sorted = $events->sortByDesc('date')->values();

        return response()->json(['data' => $sorted]);
    }
}
