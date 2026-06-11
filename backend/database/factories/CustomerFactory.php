<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        static $ledger = ['A', 'B', 'C', 'D'];

        return [
            'name' => $this->faker->name(),
            'phone' => $this->faker->numerify('05## ### ## ##'),
            'address' => $this->faker->address(),
            'note' => $this->faker->optional(0.3)->sentence(),
            'ledger_name' => $this->faker->randomElement($ledger),
            'ledger_page' => $this->faker->numberBetween(1, 200),
            'ledger_row' => $this->faker->numberBetween(1, 30),
        ];
    }
}
