<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
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
            'name' => $this->name,
            'phone' => $this->phone,
            'tc_kimlik' => $this->tc_kimlik,
            'address' => $this->address,
            'note' => $this->note,
            'ledger_name' => $this->ledger_name,
            'ledger_page' => $this->ledger_page,
            'ledger_row' => $this->ledger_row,
            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}
