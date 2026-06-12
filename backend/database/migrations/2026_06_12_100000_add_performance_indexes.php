<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->index('paid_at');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['paid_at']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['name']);
        });
    }
};
