<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns token on valid login', function () {
    User::factory()->create([
        'email' => 'admin@bereket.local',
        'password' => bcrypt('bereket2024!'),
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@bereket.local',
        'password' => 'bereket2024!',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);
});

it('rejects invalid password', function () {
    User::factory()->create([
        'email' => 'admin@bereket.local',
        'password' => bcrypt('bereket2024!'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@bereket.local',
        'password' => 'wrong',
    ])->assertUnauthorized()->assertJson(['message' => 'E-posta veya şifre hatalı.']);
});

it('validates required fields', function () {
    $this->postJson('/api/v1/auth/login', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password']);
});

it('returns current user on /me', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('email', $user->email);
});

it('rejects /me without token', function () {
    $this->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('logs out and invalidates token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

    // Token row is deleted; personal access token table should have 0 rows
    expect($user->tokens()->count())->toBe(0);
});
