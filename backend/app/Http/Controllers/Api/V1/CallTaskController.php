<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use App\Models\CallTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CallTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $date = $request->input('date', now()->toDateString());

        $tasks = CallTask::with(['customer', 'installment', 'callLogs'])
            ->where('task_date', $date)
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->map(fn(CallTask $t) => [
                'id'             => $t->id,
                'task_date'      => $t->task_date->toDateString(),
                'priority'       => $t->priority,
                'status'         => $t->status,
                'customer_id'    => $t->customer_id,
                'customer_name'  => $t->customer->name,
                'phone'          => $t->customer->phone,
                'ledger_name'    => $t->customer->ledger_name,
                'ledger_page'    => $t->customer->ledger_page,
                'ledger_row'     => $t->customer->ledger_row,
                'installment_id' => $t->installment_id,
                'sequence'       => $t->installment->sequence,
                'amount'         => $t->installment->amount,
                'paid_amount'    => $t->installment->paid_amount,
                'remaining'      => bcsub((string) $t->installment->amount, (string) $t->installment->paid_amount, 2),
                'due_date'       => $t->installment->due_date,
                'inst_status'    => $t->installment->status,
                'last_log'       => $t->callLogs->last(),
            ]);

        return response()->json(['data' => $tasks]);
    }

    public function log(Request $request, CallTask $callTask): JsonResponse
    {
        $v = $request->validate([
            'outcome'        => ['required', 'string', 'in:reached_paid,reached_promised,unreachable,postponed'],
            'promise_date'   => ['nullable', 'date', 'required_if:outcome,reached_promised'],
            'promise_amount' => ['nullable', 'numeric', 'min:0.01', 'required_if:outcome,reached_promised'],
            'note'           => ['nullable', 'string', 'max:1000'],
            'called_at'      => ['nullable', 'date_format:Y-m-d H:i:s'],
        ]);

        $log = CallLog::create([
            'call_task_id'   => $callTask->id,
            'user_id'        => $request->user()->id,
            'outcome'        => $v['outcome'],
            'promise_date'   => $v['promise_date'] ?? null,
            'promise_amount' => $v['promise_amount'] ?? null,
            'note'           => $v['note'] ?? null,
            'called_at'      => $v['called_at'] ?? now(),
        ]);

        // Update task status
        $newStatus = match ($v['outcome']) {
            'reached_paid'     => 'done',
            'reached_promised' => 'promised',
            'unreachable'      => 'unreachable',
            'postponed'        => 'postponed',
            default            => $callTask->status,
        };
        $callTask->update(['status' => $newStatus]);

        return response()->json(['data' => $log], 201);
    }
}
