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

        // Priority 1: overdue (due_date < today, unpaid)
        $inserted += $this->insertBucket($today, null, $today, 1);

        // Priority 2: due today
        $inserted += $this->insertBucket($today, $today, $today, 2);

        // Priority 3: due tomorrow
        $inserted += $this->insertBucket($today, $tomorrow, $tomorrow, 3);

        $this->info("Generated {$inserted} new call tasks for {$today}.");

        return self::SUCCESS;
    }

    private function insertBucket(string $taskDate, ?string $dueDateFrom, string $dueDateTo, int $priority): int
    {
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
                DB::raw('NOW() as created_at'),
                DB::raw('NOW() as updated_at'),
            );

        if ($dueDateFrom === null) {
            // overdue: due_date < taskDate
            $query->where('installments.due_date', '<', $taskDate);
        } else {
            $query->whereBetween('installments.due_date', [$dueDateFrom, $dueDateTo]);
        }

        $rows = $query->get()->map(fn($r) => (array) $r)->toArray();

        if (empty($rows)) {
            return 0;
        }

        // insertOrIgnore for idempotency (unique on task_date + installment_id)
        DB::table('call_tasks')->insertOrIgnore($rows);

        return count($rows);
    }
}
