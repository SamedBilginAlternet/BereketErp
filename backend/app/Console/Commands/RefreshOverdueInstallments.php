<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\PaymentService;
use Illuminate\Console\Command;

class RefreshOverdueInstallments extends Command
{
    protected $signature = 'app:refresh-overdue-installments';
    protected $description = 'Mark due installments as overdue (runs daily via scheduler)';

    public function handle(PaymentService $paymentService): int
    {
        $count = $paymentService->refreshOverdueStatuses();
        $this->info("Gecikmiş olarak işaretlenen taksit: {$count}");
        return self::SUCCESS;
    }
}
