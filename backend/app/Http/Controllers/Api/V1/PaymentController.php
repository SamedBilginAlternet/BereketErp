<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePaymentRequest;
use App\Http\Resources\Api\V1\PaymentResource;
use App\Models\Customer;
use App\Models\Installment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $paymentService) {}

    public function store(StorePaymentRequest $request, Installment $installment): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
    {
        $v = $request->validated();

        try {
            $payment = $this->paymentService->recordPayment(
                installment: $installment,
                user: $request->user(),
                amount: (string) $v['amount'],
                paidAt: $v['paid_at'],
                note: $v['note'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new PaymentResource($payment))->response()->setStatusCode(201);
    }

    public function balance(Customer $customer): JsonResponse
    {
        return response()->json([
            'data' => $this->paymentService->customerBalance($customer->id),
        ]);
    }
}
