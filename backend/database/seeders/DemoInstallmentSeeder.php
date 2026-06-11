<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\User;
use App\Services\InstallmentService;
use Illuminate\Database\Seeder;

class DemoInstallmentSeeder extends Seeder
{
    public function run(InstallmentService $service): void
    {
        $admin = User::first();

        $ledgers = ['A', 'B', 'C', 'D'];
        $firstNames = [
            'Ahmet', 'Mehmet', 'Ali', 'Hasan', 'Hüseyin', 'İbrahim', 'Mustafa', 'Ömer',
            'Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Zehra',
            'Yusuf', 'Murat', 'Kemal', 'Serkan', 'Burak', 'Emre', 'Tolga', 'Caner',
            'Selma', 'Gül', 'Nur', 'Seda', 'Pınar', 'Tuğba',
        ];
        $lastNames = [
            'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Doğan', 'Kılıç', 'Arslan',
            'Aydın', 'Özdemir', 'Erdoğan', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat',
            'Avcı', 'Aktaş', 'Bulut', 'Güneş',
        ];

        $start = new \DateTime('2026-06-11');
        $end   = new \DateTime('2026-06-30');
        $page  = 1;

        for ($date = clone $start; $date <= $end; $date->modify('+1 day')) {
            $dueDate = $date->format('Y-m-d');

            for ($i = 1; $i <= 20; $i++) {
                $name = $firstNames[array_rand($firstNames)] . ' ' . $lastNames[array_rand($lastNames)];
                $phone = '05' . rand(30, 59) . rand(1000000, 9999999);

                $customer = Customer::create([
                    'name'        => $name,
                    'phone'       => $phone,
                    'ledger_name' => $ledgers[array_rand($ledgers)],
                    'ledger_page' => $page,
                    'ledger_row'  => $i,
                ]);

                // Random total between 2000-15000, down payment 0-20%
                $total     = rand(2000, 15000);
                $down      = rand(0, (int) ($total * 0.2));
                $instCount = rand(1, 12);

                $service->createSale(
                    customer: $customer,
                    user: $admin,
                    totalAmount: (string) $total,
                    downPayment: (string) $down,
                    installmentCount: $instCount,
                    firstDueDate: $dueDate,
                    saleDate: '2026-06-01',
                    description: 'Demo satış',
                );
            }

            $page++;
        }

        $this->command->info('Demo: 11.06–30.06.2026 arası her güne 20 müşteri oluşturuldu.');
    }
}
