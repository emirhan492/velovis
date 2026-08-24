# 🛍️ Velovis Wear - Backend API

This repository contains the backend application for **Velovis Wear**, an e-commerce platform. Built with NestJS and Prisma, it provides a robust, scalable, and secure API to handle product management, order processing, user authentication, and authorization.

## ✨ Features

- **Robust Architecture:** Developed using NestJS for a modular and maintainable codebase.
- **Data Modeling:** Utilizes Prisma ORM for type-safe database interactions with PostgreSQL.
- **Authentication & Authorization:** Secure user management with role-based access control (RBAC) using JWT and refresh tokens.
- **E-commerce Capabilities:** Dedicated modules for handling products, categories, shopping carts, orders, and payments.
- **Media Management:** Support for uploading and managing product photos.
- **Email Services:** Integrated mailing module for notifications and transactional emails (e.g., account activation).

## 🛠️ Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **Database ORM:** Prisma
- **Database:** PostgreSQL (implied by typical Prisma usage, see schema for details)
- **Authentication:** Passport, JWT (JSON Web Tokens)
- **Testing:** Jest (e2e and unit tests)

## 📂 Project Structure

```text
velovis/
├── prisma/             # Prisma schema, migrations, and database seed scripts
├── src/                # Main application source code
│   ├── auth/           # Authentication and strategy logic
│   ├── authorization/  # Role-based access control and guards
│   ├── cart-items/     # Shopping cart management
│   ├── categories/     # Product category management
│   ├── comments/       # User reviews and comments
│   ├── mail/           # Email service integration
│   ├── orders/         # Order processing and tracking
│   ├── payment/        # Payment gateway integration
│   ├── product-photos/ # Product image handling
│   ├── products/       # Product catalog management
│   ├── roles/          # User role definitions
│   └── users/          # User profile and account management
├── test/               # End-to-end (e2e) tests
├── nest-cli.json       # NestJS CLI configuration
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## 🚀 Setup and Installation

Follow these steps to run the backend application locally:

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (or your configured database)
- Prisma CLI installed globally or via npx

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/velovis.git
cd velovis/velovis
```

### 3. Install Dependencies
```bash
npm install
# or yarn / pnpm / bun
```

### 4. Environment Variables
Create a `.env` file in the root directory. You will need to define your database connection and secret keys:
```env
# Database connection string
DATABASE_URL="postgresql://user:password@localhost:5432/velovis?schema=public"

# JWT Secrets
JWT_SECRET="your_jwt_secret_key"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"

# Mail Configuration (e.g., Brevo/Sendinblue or SMTP)
MAIL_HOST="smtp.example.com"
MAIL_USER="your_email@example.com"
MAIL_PASS="your_email_password"
```

### 5. Database Setup
Run the Prisma migrations to set up your database schema:
```bash
npx prisma migrate dev
```
*(Optional)* Seed the database with initial data:
```bash
npx prisma db seed
```

### 6. Start the Server
Start the development server:
```bash
npm run start:dev
```
The API will typically be available at `http://localhost:4000` (or the port defined in your configuration).

## 🧪 Testing

Run unit tests:
```bash
npm run test
```

Run end-to-end tests:
```bash
npm run test:e2e
