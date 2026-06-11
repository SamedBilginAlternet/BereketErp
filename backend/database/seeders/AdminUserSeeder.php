<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@bereket.local')],
            [
                'name' => env('ADMIN_NAME', 'Bereket Admin'),
                'password' => Hash::make(env('ADMIN_PASSWORD', 'bereket2024!')),
            ]
        );
    }
}
