<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CallTaskController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ImportController;
use App\Http\Controllers\Api\V1\LedgerController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\ReportsController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\TimelineController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('customers/pending-detail', [CustomerController::class, 'pendingDetail']);
        Route::apiResource('customers', CustomerController::class);

        Route::post('sales/preview', [SaleController::class, 'preview']);
        Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);

        Route::post('installments/{installment}/payments', [PaymentController::class, 'store']);
        Route::get('customers/{customer}/balance', [PaymentController::class, 'balance']);

        Route::get('dashboard/daily', [DashboardController::class, 'daily']);

        Route::get('reports/summary', [ReportsController::class, 'summary']);
        Route::get('reports/aging', [ReportsController::class, 'aging']);

        Route::post('ledger/entry', [LedgerController::class, 'store']);

        Route::get('call-tasks', [CallTaskController::class, 'index']);
        Route::post('call-tasks/{callTask}/log', [CallTaskController::class, 'log']);

        Route::get('customers/{customer}/timeline', [TimelineController::class, 'customer']);

        Route::get('imports/template', [ImportController::class, 'template']);
        Route::post('imports/ledger', [ImportController::class, 'store']);
        Route::get('imports/basic-template', [ImportController::class, 'basicTemplate']);
        Route::post('imports/customers', [ImportController::class, 'basicImport']);
    });
});
