<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSaleRequest;
use App\Http\Resources\Api\V1\SaleResource;
use App\Models\Customer;
use App\Models\Sale;
use App\Services\InstallmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SaleController extends Controller
{
    public function __construct(private InstallmentService $installmentService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Sale::with(['customer', 'installments']);

        if ($customerId = $request->integer('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        return SaleResource::collection(
            $query->latest()->paginate(20)
        );
    }

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'down_payment' => ['required', 'numeric', 'min:0'],
            'installment_count' => ['required', 'integer', 'min:1', 'max:60'],
            'first_due_date' => ['required', 'date'],
        ]);

        $schedule = $this->installmentService->preview(
            (string) $validated['total_amount'],
            (string) $validated['down_payment'],
            (int) $validated['installment_count'],
            $validated['first_due_date'],
        );

        return response()->json(['data' => $schedule]);
    }

    public function store(StoreSaleRequest $request): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
    {
        $v = $request->validated();
        $customer = Customer::findOrFail($v['customer_id']);

        $sale = $this->installmentService->createSale(
            customer: $customer,
            user: $request->user(),
            totalAmount: (string) $v['total_amount'],
            downPayment: (string) $v['down_payment'],
            installmentCount: (int) $v['installment_count'],
            firstDueDate: $v['first_due_date'],
            saleDate: $v['sale_date'],
            description: $v['description'] ?? null,
        );

        return (new SaleResource($sale))->response()->setStatusCode(201);
    }

    public function show(Sale $sale): SaleResource
    {
        return new SaleResource($sale->load(['customer', 'installments']));
    }
}
