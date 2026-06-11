<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id'       => ['required', 'integer', 'exists:customers,id'],
            'description'       => ['nullable', 'string', 'max:500'],
            'total_amount'      => ['required', 'numeric', 'min:0.01'],
            'down_payment'      => ['required', 'numeric', 'min:0'],
            'installment_count' => ['required', 'integer', 'min:1', 'max:60'],
            'sale_date'         => ['required', 'date'],
            'first_due_date'    => ['required', 'date'],
            'amounts'           => ['nullable', 'array'],
            'amounts.*'         => ['numeric', 'min:0.01'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'Müşteri seçimi zorunludur.',
            'customer_id.exists' => 'Seçilen müşteri bulunamadı.',
            'total_amount.required' => 'Toplam tutar zorunludur.',
            'total_amount.min' => 'Toplam tutar sıfırdan büyük olmalıdır.',
            'down_payment.min' => 'Peşinat negatif olamaz.',
            'installment_count.required' => 'Taksit sayısı zorunludur.',
            'installment_count.min' => 'En az 1 taksit olmalıdır.',
        ];
    }
}
