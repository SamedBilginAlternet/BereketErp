<?php

declare(strict_types=1);

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function authUser(): string
{
    $user = User::factory()->create();
    return $user->createToken('test')->plainTextToken;
}

// ── LIST & SEARCH ─────────────────────────────────────────────────────────────

it('returns paginated customer list', function () {
    Customer::factory(5)->create();

    $this->withToken(authUser())
        ->getJson('/api/v1/customers')
        ->assertOk()
        ->assertJsonStructure(['data', 'meta', 'links']);
});

it('requires auth to list customers', function () {
    $this->getJson('/api/v1/customers')->assertUnauthorized();
});

it('searches by name prefix', function () {
    Customer::factory()->create(['name' => 'Ali Yılmaz']);
    Customer::factory()->create(['name' => 'Ayşe Demir']);

    $this->withToken(authUser())
        ->getJson('/api/v1/customers?search=Ali')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Ali Yılmaz');
});

it('searches by phone', function () {
    Customer::factory()->create(['name' => 'Şükrü Çağlayan', 'phone' => '05321112233']);
    Customer::factory()->create(['name' => 'Zeynep Korkmaz', 'phone' => '05439998877']);

    $this->withToken(authUser())
        ->getJson('/api/v1/customers?search=0532')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('returns all customers when search is empty', function () {
    Customer::factory(3)->create();

    $this->withToken(authUser())
        ->getJson('/api/v1/customers')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

// ── CREATE ────────────────────────────────────────────────────────────────────

it('creates customer with all fields', function () {
    $this->withToken(authUser())
        ->postJson('/api/v1/customers', [
            'name' => 'Fatma Şahin',
            'phone' => '05551234567',
            'address' => 'Beşiktaş, İstanbul',
            'ledger_name' => 'A',
            'ledger_page' => 12,
            'ledger_row' => 5,
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Fatma Şahin')
        ->assertJsonPath('data.ledger_name', 'A')
        ->assertJsonPath('data.ledger_page', 12);

    $this->assertDatabaseHas('customers', ['name' => 'Fatma Şahin']);
});

it('rejects customer creation without name', function () {
    $this->withToken(authUser())
        ->postJson('/api/v1/customers', ['phone' => '05551234567'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});

// ── SHOW ──────────────────────────────────────────────────────────────────────

it('returns a single customer', function () {
    $customer = Customer::factory()->create(['name' => 'Hasan Özdemir']);

    $this->withToken(authUser())
        ->getJson("/api/v1/customers/{$customer->id}")
        ->assertOk()
        ->assertJsonPath('data.name', 'Hasan Özdemir');
});

// ── UPDATE ────────────────────────────────────────────────────────────────────

it('updates customer fields', function () {
    $customer = Customer::factory()->create(['name' => 'Eski Ad']);

    $this->withToken(authUser())
        ->putJson("/api/v1/customers/{$customer->id}", ['name' => 'Yeni Ad'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Yeni Ad');
});

// ── DELETE ────────────────────────────────────────────────────────────────────

it('soft-deletes a customer', function () {
    $customer = Customer::factory()->create();

    $this->withToken(authUser())
        ->deleteJson("/api/v1/customers/{$customer->id}")
        ->assertOk();

    $this->assertSoftDeleted('customers', ['id' => $customer->id]);
});
