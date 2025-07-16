# Telegram E-commerce Bot

Bu loyiha Node.js va MongoDB yordamida yaratilgan Telegram e-commerce botidir.

## Xususiyatlar

- 🛍️ Mahsulotlarni ko'rish va filtrlash
- 🛒 Savatcha funksiyasi
- 📜 Buyurtmalar boshqaruvi
- 💬 Chat tizimi
- ⭐ Reyting va izohlar
- 👥 Foydalanuvchi rollari (Client, Seller, Admin)
- 📊 Admin statistikasi

## O'rnatish

1. Loyihani klonlang:
\`\`\`bash
git clone <repository-url>
cd telegram-ecommerce-bot
\`\`\`

2. Paketlarni o'rnating:
\`\`\`bash
npm install
\`\`\`

3. `.env` faylini yarating va sozlang:
\`\`\`bash
cp .env.example .env
\`\`\`

4. `.env` faylida quyidagi ma'lumotlarni to'ldiring:
- `TELEGRAM_BOT_TOKEN` - BotFather dan olingan bot token
- `MONGODB_URI` - MongoDB ulanish manzili
- `JWT_SECRET` - JWT uchun maxfiy kalit
- `PORT` - Server porti (ixtiyoriy, standart: 3000)

5. Botni ishga tushiring:
\`\`\`bash
npm start
\`\`\`

Yoki development rejimida:
\`\`\`bash
npm run dev
\`\`\`

## Fayl tuzilishi

\`\`\`
├── server.js              # Asosiy server fayli
├── bot/
│   └── index.js           # Bot konfiguratsiyasi
├── config/
│   └── database.js        # MongoDB ulanishi
├── models/
│   ├── User.js            # Foydalanuvchi modeli
│   ├── Product.js         # Mahsulot modeli
│   ├── Order.js           # Buyurtma modeli
│   └── Message.js         # Xabar modeli
├── handlers/
│   ├── startHandler.js    # /start buyrug'i
│   ├── contactHandler.js  # Kontakt ulashish
│   ├── menuHandler.js     # Asosiy menyu
│   ├── productHandler.js  # Mahsulotlar
│   ├── cartHandler.js     # Savatcha
│   ├── orderHandler.js    # Buyurtmalar
│   ├── chatHandler.js     # Chat
│   ├── categoryHandler.js # Kategoriyalar
│   ├── filterHandler.js   # Filtrlash
│   ├── addProductHandler.js    # Mahsulot qo'shish
│   ├── editProductHandler.js   # Mahsulot tahrirlash
│   ├── adminHandler.js    # Admin panel
│   ├── statsHandler.js    # Statistika
│   ├── messageHandler.js  # Xabarlar
│   ├── photoHandler.js    # Rasmlar
│   └── callbackHandler.js # Callback so'rovlar
├── services/
│   ├── botService.js      # Bot xizmatlari
│   └── stateManager.js    # Holat boshqaruvi
└── utils/
    ├── auth.js            # Autentifikatsiya
    ├── helpers.js         # Yordamchi funksiyalar
    ├── constants.js       # Konstantalar
    └── admin.js           # Admin tekshiruvi
\`\`\`

## Foydalanish

1. Telegram botingizni toping
2. `/start` buyrug'ini bosing
3. Telefon raqamingizni ulashing
4. Botdan foydalanishni boshlang!

## Roller

- **Client**: Mahsulot sotib olish, izoh qoldirish
- **Seller**: Mahsulot qo'shish, buyurtmalarni boshqarish
- **Admin**: Barcha funksiyalar, foydalanuvchilarni boshqarish

## Texnologiyalar

- Node.js
- Express.js
- MongoDB (Mongoose)
- Socket.IO
- node-telegram-bot-api
- JWT
- Validator

## Litsenziya

MIT
