<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('note')->nullable();
            // Legacy ledger fields for cross-referencing paper books
            $table->string('ledger_name')->nullable();
            $table->unsignedSmallInteger('ledger_page')->nullable();
            $table->unsignedSmallInteger('ledger_row')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index('phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
