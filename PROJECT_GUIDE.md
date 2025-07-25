# Project Guide: Job Portal Web Platform

## Table of Contents

- [Project Overview](#project-overview)
- [User Roles](#user-roles)
- [Main Features](#main-features)
- [Backend Development Guidelines](#backend-development-guidelines)
- [Frontend Development Guidelines](#frontend-development-guidelines)
- [Collaboration & Best Practices](#collaboration--best-practices)

---

## Project Overview

A web-based platform connecting job seekers with employers. The system allows job seekers to register and manage their profiles, while employers can browse anonymized profiles and request candidates. Admins manage the platform, job seekers, and employer interactions. The platform supports English and Kinyarwanda.

---

## User Roles

### 1. Job Seeker (Employee)

- Registers and manages their profile (bio-data, skills, photo, etc.)
- Cannot view or message employers

### 2. Admin

- Manages job seekers (add/edit/delete)
- Views employer requests and communicates with employers
- Adds job categories
- Receives email notifications

### 3. Employer

- No registration required
- Browses public job seeker list (limited info)
- Submits requests for candidates
- Communicates with admin after request

---

## Main Features

- **Public Homepage**: Service intro, CTAs (Register, Login, View Job Seekers)
- **Registration System**: Separate flows for job seekers and admin
- **Job Seeker Profile**: Editable, with public/private fields
- **Admin Dashboard**: Manage job seekers, view requests, messaging
- **Employer Interface**: Browse, request, communicate (no login)
- **Internal Messaging**: Admin ↔ Employer, with email notifications
- **Email Notifications**: For key actions (registrations, requests, replies)
- **Language Support**: English & Kinyarwanda
- **Mobile Responsive Design**

---

## Backend Development Guidelines

### 1. API Design

- RESTful endpoints for:
  - Job seeker registration, login, profile CRUD
  - Admin authentication, job seeker management, employer requests
  - Employer request submission (no auth)
  - Messaging (admin ↔ employer)
- Use JWT or session-based authentication for job seekers and admin
- Protect sensitive endpoints (admin, job seeker profile edit)

### 2. Database Schema

- Tables/collections for:
  - Users (job seekers, admin)
  - Job seeker profiles
  - Employer requests
  - Messages
  - Job categories
- Store photos securely; only show obscured/thumbnail versions publicly

### 3. Email Notifications

- Trigger emails on:
  - New job seeker registration (to admin)
  - Employer request submission (to admin)
  - Admin reply to employer (to employer)
- Use a transactional email service (e.g., SendGrid, Mailgun)

### 4. Language Support

- Store translatable fields (e.g., job categories) with language codes
- Provide API endpoints for fetching translations

### 5. Security

- Hash passwords (bcrypt or similar)
- Validate and sanitize all inputs
- Hide sensitive info in public APIs

---

## Frontend Development Guidelines

### 1. UI/UX

- Responsive design (mobile-first)
- Clear navigation: Home, Register, Login, View Job Seekers
- Obscure job seeker photos and hide contact info on public views
- Accessible forms with validation and helpful error messages

### 2. Routing

- Public routes: Home, Register (Job Seeker), Login, View Job Seekers, Employer Request
- Protected routes: Admin dashboard, Job seeker profile edit

### 3. Forms

- Registration and login forms for job seekers and admin
- Profile edit form (job seeker)
- Employer request form (name, email, message)
- Messaging interface (admin ↔ employer)

### 4. Language Translation

- Use i18n library (e.g., react-i18next, vue-i18n)
- All UI text must be translatable (English/Kinyarwanda)
- Language switcher in UI

### 5. Notifications

- Show in-app notifications for key actions (e.g., request sent, message received)
- Indicate when email notifications are sent

---

## Collaboration & Best Practices

- Use version control (Git) with clear commit messages
- Follow code style guides (ESLint, Prettier, etc.)
- Document APIs (Swagger/OpenAPI)
- Use environment variables for secrets/config
- Write clear README and user/admin guides
- Communicate regularly messaging

---

**For questions or clarifications, refer to this guide or contact the project lead.**
