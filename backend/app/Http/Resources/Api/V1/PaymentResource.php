<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
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
            'installment_id' => $this->installment_id,
            'amount' => $this->amount,
            'paid_at' => $this->paid_at?->toDateString(),
            'note' => $this->note,
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
