# Frontend Developer Guide: Job Portal Web Platform

## Table of Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [Frontend Development Guidelines](#frontend-development-guidelines)

---

## Project Overview

A web-based platform connecting job seekers with employers. The system allows job seekers to register and manage their profiles, while employers can browse anonymized profiles and request candidates. Admins manage the platform, job seekers, and employer interactions. The platform supports English and Kinyarwanda.

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
