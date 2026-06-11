<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'address',
        'note',
        'ledger_name',
        'ledger_page',
        'ledger_row',
    ];

    protected function casts(): array
    {
        return [
            'ledger_page' => 'integer',
            'ledger_row' => 'integer',
        ];
    }
}
