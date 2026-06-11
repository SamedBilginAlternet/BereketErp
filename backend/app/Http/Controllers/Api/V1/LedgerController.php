<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\SaleResource;
use App\Models\Customer;
use App\Models\Installment;
use App\Services\InstallmentService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LedgerController extends Controller
{
    public function __construct(
        private InstallmentService $installmentService,
        private PaymentService $paymentService,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'customer_id'                    => ['nullable', 'integer', 'exists:customers,id'],
            'ledger_name'                    => ['required_without:customer_id', 'nullable', 'string', 'max:50'],
            'ledger_page'                    => ['required_without:customer_id', 'nullable', 'integer', 'min:1'],
            'ledger_row'                     => ['required_without:customer_id', 'nullable', 'integer', 'min:1'],
            'name'                           => ['required_without:customer_id', 'nullable', 'string', 'max:255'],
            'phone'                          => ['nullable', 'string', 'max:20'],
            'tc_kimlik'                      => ['nullable', 'digits:11'],
            'description'                    => ['nullable', 'string', 'max:500'],
            'total_amount'                   => ['required', 'numeric', 'min:0.01'],
            'down_payment'                   => ['required', 'numeric', 'min:0'],
            'installment_count'              => ['required', 'integer', 'min:1', 'max:60'],
            'sale_date'                      => ['required', 'date'],
            'first_due_date'                 => ['required', 'date'],
            'amounts'                        => ['nullable', 'array'],
            'amounts.*'                      => ['numeric', 'min:0.01'],
            'paid_installments'              => ['nullable', 'array'],
            'paid_installments.*.sequence'   => ['required', 'integer', 'min:1'],
            'paid_installments.*.paid_at'    => ['required', 'date'],
        ]);

        try {
            $sale = DB::transaction(function () use ($v, $request) {
                if (!empty($v['customer_id'])) {
                    $customer = Customer::findOrFail($v['customer_id']);
                    // Update ledger position if supplied (covers case where basic import didn't set it)
                    $ledgerUpdate = array_filter([
                        'ledger_name' => $v['ledger_name'] ?? null,
                        'ledger_page' => $v['ledger_page'] ?? null,
                        'ledger_row'  => $v['ledger_row'] ?? null,
                    ]);
                    if (!empty($ledgerUpdate)) {
                        $customer->update($ledgerUpdate);
                    }
                } else {
                    $customer = Customer::create([
                        'name'        => $v['name'],
                        'phone'       => $v['phone'] ?? null,
                        'tc_kimlik'   => $v['tc_kimlik'] ?? null,
                        'ledger_name' => $v['ledger_name'],
                        'ledger_page' => $v['ledger_page'],
                        'ledger_row'  => $v['ledger_row'],
                    ]);
                }

                $sale = $this->installmentService->createSale(
                    customer: $customer,
                    user: $request->user(),
                    totalAmount: (string) $v['total_amount'],
                    downPayment: (string) $v['down_payment'],
                    installmentCount: (int) $v['installment_count'],
                    firstDueDate: $v['first_due_date'],
                    saleDate: $v['sale_date'],
                    description: $v['description'] ?? null,
                    customAmounts: isset($v['amounts']) ? array_map('strval', $v['amounts']) : null,
                );

                if (!empty($v['paid_installments'])) {
                    foreach ($v['paid_installments'] as $paidItem) {
                        $installment = Installment::where('sale_id', $sale->id)
                            ->where('sequence', $paidItem['sequence'])
                            ->first();

                        if ($installment === null) {
                            continue;
                        }

                        $this->paymentService->recordPayment(
                            installment: $installment,
                            user: $request->user(),
                            amount: (string) $installment->amount,
                            paidAt: $paidItem['paid_at'],
                        );
                    }
                }

                return $sale;
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['amounts' => [$e->getMessage()]]], 422);
        }

        return (new SaleResource($sale->load(['customer', 'installments'])))
            ->response()
            ->setStatusCode(201);
    }
}
