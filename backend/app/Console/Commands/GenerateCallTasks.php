<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\InstallmentStatus;
use App\Models\CallTask;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class GenerateCallTasks extends Command
{
    protected $signature   = 'app:generate-call-tasks {--date= : Override today\'s date (Y-m-d)}';
    protected $description = 'Generate daily call tasks for overdue and due installments (idempotent)';

    public function handle(): int
    {
        $today    = $this->option('date') ?? now()->toDateString();
        $tomorrow = now()->parse($today)->addDay()->toDateString();

        $inserted = 0;

        // Priority 2: promised installments whose promise_date = today (re-queue)
        $inserted += $this->insertPromiseBucket($today);

        // Priority 1: overdue (due_date < today, unpaid)
        $inserted += $this->insertBucket($today, null, $today, 1);

        // Priority 2: due today
        $inserted += $this->insertBucket($today, $today, $today, 2);

        // Priority 3: due tomorrow
        $inserted += $this->insertBucket($today, $tomorrow, $tomorrow, 3);

        $this->info("Generated {$inserted} new call tasks for {$today}.");

        return self::SUCCESS;
    }

    private function insertPromiseBucket(string $taskDate): int
    {
        $now  = now()->format('Y-m-d H:i:s');
        $rows = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->whereNull('sales.deleted_at')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->whereExists(function ($q) use ($taskDate) {
                $q->select(DB::raw(1))
                    ->from('call_tasks')
                    ->join('call_logs', 'call_logs.call_task_id', '=', 'call_tasks.id')
                    ->whereColumn('call_tasks.installment_id', 'installments.id')
                    ->where('call_logs.outcome', 'reached_promised')
                    ->whereDate('call_logs.promise_date', $taskDate);
            })
            ->select(
                DB::raw("'$taskDate' as task_date"),
                'sales.customer_id',
                'installments.id as installment_id',
                DB::raw('2 as priority'),
                DB::raw("'pending' as status"),
            )
            ->get()
            ->map(fn ($r) => array_merge((array) $r, ['created_at' => $now, 'updated_at' => $now]))
            ->toArray();

        if (empty($rows)) {
            return 0;
        }

        DB::table('call_tasks')->insertOrIgnore($rows);

        return count($rows);
    }

    private function insertBucket(string $taskDate, ?string $dueDateFrom, string $dueDateTo, int $priority): int
    {
        $now   = now()->format('Y-m-d H:i:s');
        $query = DB::table('installments')
            ->join('sales', 'sales.id', '=', 'installments.sale_id')
            ->whereIn('installments.status', [
                InstallmentStatus::Pending->value,
                InstallmentStatus::Partial->value,
                InstallmentStatus::Overdue->value,
            ])
            ->whereNull('sales.deleted_at')
            ->select(
                DB::raw("'$taskDate' as task_date"),
                'sales.customer_id',
                'installments.id as installment_id',
                DB::raw("$priority as priority"),
                DB::raw("'pending' as status"),
            );

        if ($dueDateFrom === null) {
            // overdue: due_date < taskDate
            $query->whereDate('installments.due_date', '<', $taskDate);
        } else {
            $query->whereDate('installments.due_date', '>=', $dueDateFrom)
                  ->whereDate('installments.due_date', '<=', $dueDateTo);
        }

        $rows = $query->get()
            ->map(fn ($r) => array_merge((array) $r, ['created_at' => $now, 'updated_at' => $now]))
            ->toArray();

        if (empty($rows)) {
            return 0;
        }

        // insertOrIgnore for idempotency (unique on task_date + installment_id)
        DB::table('call_tasks')->insertOrIgnore($rows);

        return count($rows);
    }
}
