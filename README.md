# Pastane Üretim Planlama

Butik pastane mutfağı için tam stack haftalık üretim planlama uygulaması.

## Özellikler

- Haftalık üretim planı oluşturma
- Baz ürün ve hammadde yönetimi
- Otomatik çizelge üretimi (fire oranı + %5 emniyet marjı dahil)
- FIFO & raf ömrü uyarıları
- Hammadde maliyet hesaplama
- Düşük stok uyarıları
- Admin / Viewer rol sistemi

## Kurulum

```bash
npm install
cp .env.local.example .env.local
# .env.local içine DATABASE_URL ve NEXTAUTH_SECRET değerlerini gir
npm run db:push      # Neon'a şema gönder
npm run db:seed      # Örnek veri yükle
npm run dev          # http://localhost:3000
```

## Vercel Deploy

1. [neon.tech](https://neon.tech) → ücretsiz proje aç → bağlantı string'ini kopyala
2. `npm run db:push` ile şemayı Neon'a gönder
3. `npm run db:seed` ile örnek veriyi yükle
4. GitHub'a push et
5. [vercel.com](https://vercel.com) → "Import Project" → env değişkenlerini ekle → Deploy

### Gerekli Env Değişkenleri (Vercel)

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | Neon pooled connection string |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Vercel URL (örn. https://kitchenplanner.vercel.app) |

## Seed Kullanıcıları

| Email | Şifre | Rol |
|-------|-------|-----|
| admin@pastane.com | Admin123! | admin |
| viewer@pastane.com | Viewer123! | viewer |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js v5
- **Stil**: Tailwind CSS
- **Toast**: react-hot-toast
