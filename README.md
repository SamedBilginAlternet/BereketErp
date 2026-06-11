# BereketErp

Bereket Tekstil için özel ERP — senet & taksit yönetimi, tahsilat çağrı merkezi, stok/barkod ve satış yönetimi.

- Spec: [issue #1](https://github.com/SamedBilginAlternet/BereketErp/issues/1) · Kararlar: [docs/ROADMAP.md](docs/ROADMAP.md)
- Stack: Laravel 12 API (PHP 8.3) · MySQL 8 · React 18 + TypeScript + Vite · Tailwind + shadcn/ui · Docker

## Geliştirme ortamı (Docker)

```bash
cp .env.example .env
docker compose up -d --build

# İlk kurulum (tek sefer)
docker compose exec app composer install
docker compose exec app cp .env.example .env
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

| Servis | Adres |
|---|---|
| API (nginx → Laravel) | http://localhost:8080 |
| Frontend (Vite dev) | http://localhost:5173 |
| MySQL | localhost:3306 (`bereket` / `bereket_dev`) |

Zamanlanmış görevler (`scheduler` servisi) `php artisan schedule:work` ile otomatik çalışır.

### Testler

```bash
docker compose exec app php artisan test       # backend (Pest)
docker compose exec node npm run build         # frontend build + tip kontrolü
```

## Dizin yapısı

```
backend/    Laravel 12 API  (/api/v1, Sanctum)
frontend/   React + TS + Vite SPA
docker/     Servis Dockerfile ve konfigleri
docs/       ROADMAP, DESIGN-SYSTEM, CODING-STANDARDS, adr/
```
