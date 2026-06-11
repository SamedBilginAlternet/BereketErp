<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('call_tasks', function (Blueprint $table) {
            $table->id();
            $table->date('task_date');
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('installment_id')->constrained()->cascadeOnDelete();
            // priority: 1=overdue, 2=due_today, 3=due_tomorrow
            $table->unsignedTinyInteger('priority')->default(2);
            $table->string('status', 20)->default('pending');
            $table->timestamps();

            // Idempotency: one task per installment per day
            $table->unique(['task_date', 'installment_id']);
            $table->index(['task_date', 'priority', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_tasks');
    }
};
