<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
            ]),
            'description' => $this->description,
            'total_amount' => $this->total_amount,
            'down_payment' => $this->down_payment,
            'financed_amount' => $this->financed_amount,
            'installment_count' => $this->installment_count,
            'sale_date' => $this->sale_date?->toDateString(),
            'first_due_date' => $this->first_due_date?->toDateString(),
            'installments' => InstallmentResource::collection($this->whenLoaded('installments')),
            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}
