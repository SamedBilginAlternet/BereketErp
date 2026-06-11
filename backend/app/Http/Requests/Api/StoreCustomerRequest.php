<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'tc_kimlik' => ['nullable', 'digits:11'],
            'address' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:1000'],
            'ledger_name' => ['nullable', 'string', 'max:100'],
            'ledger_page' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'ledger_row' => ['nullable', 'integer', 'min:1', 'max:9999'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Müşteri adı zorunludur.',
            'name.max' => 'Müşteri adı en fazla 255 karakter olabilir.',
        ];
    }
}
