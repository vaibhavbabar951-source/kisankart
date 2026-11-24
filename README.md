# KisanKart Backend

Node.js + Express 5 + MongoDB (Mongoose) API for the Agricultural Product Marketplace.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill `MONGO_URI`, `JWT_SECRET` (Razorpay keys are needed only for online payments)
3. `npm run seed:admin` (creates the admin user once)
4. `npm run dev`

Requires Node 20+ (use `nvm install --lts`).

## Image upload
- Send `multipart/form-data` with the file in a field named **image** (JPG/PNG/WEBP, max 2 MB)
- Saved in `uploads/profiles` and `uploads/products`; the API returns a path like `/uploads/products/xyz.jpg`
- Open it in the browser/React as `http://localhost:5000/uploads/products/xyz.jpg`

## Endpoints
Auth header for protected routes: `Authorization: Bearer <token>`

| Method | URL | Access | Notes |
|---|---|---|---|
| POST | /api/auth/signup | public | JSON or multipart (optional `image`) |
| POST | /api/auth/login | public | |
| GET | /api/auth/me | any user | |
| PUT | /api/auth/me | any user | name, phone, address |
| PUT | /api/auth/me/image | any user | multipart, field `image` |
| DELETE | /api/auth/me/image | any user | |
| PUT | /api/auth/me/password | any user | currentPassword, newPassword |
| GET | /api/products | public | ?category, search, minPrice, maxPrice, farmer, page, limit |
| GET | /api/products/my | farmer | |
| GET | /api/products/:id | public | |
| POST | /api/products | farmer | JSON or multipart (optional `image`) |
| PUT | /api/products/:id | owner farmer | JSON or multipart (optional new `image`) |
| DELETE | /api/products/:id/image | owner farmer | |
| DELETE | /api/products/:id | owner farmer, admin | |
| POST | /api/orders | buyer | items, shippingAddress, paymentMethod (cod/online) |
| GET | /api/orders/my | buyer | |
| GET | /api/orders/farmer | farmer | |
| GET | /api/orders/:id | buyer/farmer/admin | |
| PUT | /api/orders/:id/cancel | buyer | only pending/confirmed |
| PUT | /api/orders/:id/status | farmer, admin | pending > confirmed > shipped > delivered |
| POST | /api/payments/create | buyer | body: orderId (online orders) |
| POST | /api/payments/verify | buyer | razorpay_order_id, razorpay_payment_id, razorpay_signature |
| GET | /api/payments/my | buyer | |
| GET | /api/admin/stats | admin | |
| GET | /api/admin/users | admin | ?role, search, page |
| PATCH | /api/admin/users/:id/status | admin | { isActive } |
| DELETE | /api/admin/users/:id | admin | |
| GET | /api/admin/orders | admin | ?status |
| GET | /api/admin/payments | admin | ?status |

## Notes
- Stock is reduced when an order is placed and restored on cancel.
- COD payment is marked paid when the order is delivered.
- Cancelling a paid online order sets `paymentStatus` to `refund_pending`; the refund itself must be done manually from the Razorpay dashboard.
- If one order contains products of several farmers, any of those farmers can update its status.
- Express 5 forwards errors from async handlers automatically, so no try/catch wrappers are needed.
