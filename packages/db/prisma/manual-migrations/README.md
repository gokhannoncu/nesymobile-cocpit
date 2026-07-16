# Manuel PostgreSQL migrasyonları

`aras_db` üzerinde Prisma `db push` yerine DDL dosyası ile güncelleme yapıyorsanız:

1. İlgeli `*.sql` dosyasını inceleyin (örn. [`20260429_courier_wallets_aras_db.sql`](20260429_courier_wallets_aras_db.sql)).
2. **`DATABASE_URL` ortamında `aras_db` hedefini** doğrulayın.

### Prisma `db execute` (önerilir)

`packages/db` dizininden, `.env` otomatik yüklenir:

```bash
cd packages/db
pnpm exec prisma db execute --file prisma/manual-migrations/20260429_courier_wallets_aras_db.sql --schema prisma/schema.prisma
```

### `psql`

```bash
psql "$DATABASE_URL" -f prisma/manual-migrations/20260429_courier_wallets_aras_db.sql
```

DDL çalıştıktan sonra istemcisini oluşturun:

```bash
pnpm exec prisma generate
```
