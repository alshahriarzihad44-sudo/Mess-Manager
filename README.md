# 🍽️ MessManager

**A Web-Based Mess & Meal Management System**

MessManager is a web application designed to simplify the daily management of bachelor messes and shared living arrangements. It helps mess members manage deposits, expenses, meals, and monthly financial records in one place.

## ✨ Features

- **User Authentication** – Sign in using Google authentication through Supabase.
- **Mess Management** – Create a mess or join an existing mess using an invite code.
- **Dashboard** – View important mess information in one place.
- **Deposit Management** – Record and track member deposits.
- **Expense Management** – Add and manage shared mess expenses.
- **Meal Tracking** – Track meal counts for individual members.
- **Automatic Daily Meals** – Generate daily meal entries automatically based on configured meal sessions.
- **Monthly Records** – Filter and review records month by month.
- **Settlement** – View monthly financial calculations and member balances.
- **Member Management** – View members and manage member information.
- **Admin Controls** – Transfer admin privileges, manage mess settings, and leave a mess.
- **Activity History** – Keep track of mess activities.

## 🛠️ Technologies Used

- React
- Vite
- JavaScript
- CSS
- Supabase
- PostgreSQL

## 🚀 Getting Started

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/alshahriarzihad44-sudo/Mess-Manager.git
```

### 2. Navigate to the Web Application

```bash
cd Mess-Manager/web
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env.local` file inside the `web` directory and add your own Supabase project credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

**Important:** Never upload your `.env.local` file or private credentials to GitHub.

### 5. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal to use the application.

## 🗄️ Backend

MessManager uses Supabase for authentication and database services.

To run your own instance, you need to configure a Supabase project and set up the required database tables, functions, Row Level Security policies, and scheduled tasks.

## 🎯 Project Purpose

This project was developed to solve common problems in bachelor mess management, including tracking individual meals, managing shared expenses, calculating monthly costs, and maintaining transparent financial records.

## 👨‍💻 Developer

**Al Shahriar Zihad**  
Software Engineering Student  
Daffodil International University

## 📌 Project Status

Under Development 🚧

---

*Built with the goal of making shared living management simpler and more organized.*
