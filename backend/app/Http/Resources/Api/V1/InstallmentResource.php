<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InstallmentResource extends JsonResource
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
            'sale_id' => $this->sale_id,
            'sequence' => $this->sequence,
            'amount' => $this->amount,
            'paid_amount' => $this->paid_amount,
            'remaining' => number_format(
                (float) bcsub((string) $this->amount, (string) $this->paid_amount, 2),
                2, '.', ''
            ),
            'due_date' => $this->due_date?->toDateString(),
            'status' => $this->status?->value,
        ];
    }
}
