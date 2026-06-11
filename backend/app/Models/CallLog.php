<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallLog extends Model
{
    protected $fillable = [
        'call_task_id',
        'user_id',
        'outcome',
        'promise_date',
        'promise_amount',
        'note',
        'called_at',
    ];

    protected function casts(): array
    {
        return [
            'promise_date'   => 'date',
            'promise_amount' => 'decimal:2',
            'called_at'      => 'datetime',
        ];
    }

    public function callTask(): BelongsTo
    {
        return $this->belongsTo(CallTask::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
