# Awesome Backend (MongoDB, no Docker)

1. Copy `.env.example` → `.env` and edit (set MONGO_URI)

2. Install:
   npm install

3. Run in development:
   npm run dev

(Production) 4. Build:
npm run build
npm start

Notes:

- For local MongoDB: run `mongod` or use MongoDB Atlas and put the connection URI in MONGO_URI.
- Refresh tokens are stored in MongoDB in the `refreshtokens` collection. They auto-expire via a TTL index.
