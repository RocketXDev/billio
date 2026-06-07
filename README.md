![Billio Banner](docs/banner.png)

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)
![Vercel](https://img.shields.io/badge/Vercel-Hosting-black)

# Billio

Billio is a web application designed for coaches, tutors, instructors, and other lesson-based professionals who need a simple way to manage students, lessons, and billing.

The goal is straightforward: spend less time tracking lessons and invoices, and more time teaching.

## Why Billio?

Many independent coaches still rely on spreadsheets, paper notes, text messages, and manual calculations to keep track of their business. While those methods work at first, they quickly become difficult to manage as the number of students grows.

Billio brings everything together in one place:

* Student management
* Lesson tracking
* Scheduling
* Invoicing
* Billing status tracking
* Coaching business analytics

The platform is built mobile-first so coaches can manage their business directly from their phone between lessons.

---

## Features

### Dashboard

The dashboard provides a quick overview of your coaching business.

* Upcoming lessons
* Lessons scheduled for the week
* Weekly earnings
* Unbilled lessons
* Pending invoices

---

### Students

Manage all student information in one place.

Features include:

* Student profiles
* Contact information
* Parent contact information
* Notes
* Active/inactive status
* Student lesson history

---

### Lessons

Track lessons without spreadsheets or manual logs.

Features include:

* Create, edit, and delete lessons
* Track duration and lesson rates
* Assign lessons to students
* View upcoming and completed lessons
* Billing status tracking

---

### Invoices

Generate and manage invoices directly from lesson data.

Features include:

* Invoice creation
* Custom date ranges
* Lesson selection
* Billing status management
* Invoice tracking

---

### Lesson Timer

A built-in coaching timer designed for instructors who prefer tracking lessons in real time.

Features include:

* Start/stop lesson timer
* Student selection
* Automatic lesson duration calculation
* Save lesson directly from timer
* Automatic recovery if the page is refreshed

---

## Free vs Pro

### Free

* Up to 5 active students
* Manual lesson tracking
* Basic student profiles
* Email invoice sending
* Manual invoice management
* Weekly calendar view

### Pro

* Unlimited active students
* Full lesson scheduling
* Advanced student details
* Automated invoice creation
* Automated billing workflow
* Email and text invoice delivery
* Text message reminders
* Unlimited calendar access

---

## Technology Stack

### Frontend

* React
* TypeScript
* React Router
* CSS

### Backend

* Supabase

  * PostgreSQL
  * Authentication
  * Row Level Security (RLS)
  * Storage

### Deployment

* Vercel

---

## Project Structure

```text
src/
├── pages/
│   ├── Dashboard/
│   ├── Lessons/
│   ├── Students/
│   ├── Invoices/
│   ├── Timer/
│   ├── More/
│   └── Settings/
│
├── components/
│
├── lib/
│   └── supabaseClient.ts
│
└── styles/
```

---

## Security

Billio uses Supabase Authentication and Row Level Security (RLS) to ensure users can only access their own data.

Protected resources include:

* Students
* Lessons
* Invoices
* Invoice lessons
* Coach/student relationships

---

## Roadmap

Planned improvements include:

* Stripe subscription management
* Automated recurring billing
* PDF invoice generation
* SMS reminders
* Attendance tracking
* Student progress tracking
* Mobile app support
* Data export tools
* Business reporting

---

## Status

Billio is actively being developed and used in real coaching environments. New features and improvements are added regularly based on feedback from coaches and instructors.

---

## Author

Created by Artem Markelov.

Billio was built to solve the challenges faced by independent coaches who manage lessons, students, and billing on their own.
