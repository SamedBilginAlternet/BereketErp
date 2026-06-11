# BereketErp

Bereket Tekstil için özel ERP — senet & taksit yönetimi, tahsilat çağrı merkezi, stok/barkod ve satış yönetimi.

- Spec: [issue #1](https://github.com/SamedBilginAlternet/BereketErp/issues/1) · Kararlar: [docs/ROADMAP.md](docs/ROADMAP.md)
- Stack: Laravel 12 API (PHP 8.3) · MySQL 8 · React 18 + TypeScript + Vite · Tailwind + shadcn/ui · Docker

## Docker ile kurulum (önerilen)

```bash
# 1. Repo kopyala
git clone https://github.com/SamedBilginAlternet/BereketErp.git
cd BereketErp

# 2. Docker env dosyasını oluştur
cp .env.example .env          # docker-compose port ayarları

# 3. Backend env dosyasını oluştur
cp backend/.env.example backend/.env

# 4. Container'ları başlat (ilk seferinde --build gerekli)
docker compose up -d --build

# 5. İlk kurulum (tek sefer)
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

> `node` servisi `npm install && npm run dev` komutunu otomatik çalıştırır — ek adım gerekmez.

| Servis | Adres |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| API (nginx → Laravel) | http://localhost:8080 |
| MySQL | localhost:3306 (`bereket` / `bereket_dev`) |

**Giriş:** `admin@bereket.local` / `bereket2024!`

Zamanlanmış görevler (`scheduler` servisi) `php artisan schedule:work` ile otomatik çalışır.

## Native geliştirme (Docker olmadan)

Gereksinimler: PHP 8.2+, Composer, MySQL/MariaDB, Node 20+

```bash
# Backend
cd backend
cp .env.example .env          # DB ayarlarını düzenle
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve             # → http://127.0.0.1:8000

# Frontend (yeni terminal)
cd frontend
npm install
npm run dev                   # → http://localhost:5173
```

## Testler

```bash
docker compose exec app php artisan test       # backend (Pest)
docker compose exec node npm run build         # frontend build + tip kontrolü
```

## Dizin yapısı

```
backend/    Laravel 12 API  (/api/v1, Sanctum)
frontend/   React + TS + Vite SPA
docker/     Servis Dockerfile ve konfigleri
docs/       ROADMAP, DESIGN-SYSTEM, CODING-STANDARDS
```
