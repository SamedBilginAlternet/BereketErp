<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Daily at 06:00 Istanbul time — mark overdue installments
Schedule::command('app:refresh-overdue-installments')->dailyAt('06:00');

// Daily at 06:05 Istanbul time — build today's call list
Schedule::command('app:generate-call-tasks')->dailyAt('06:05');
