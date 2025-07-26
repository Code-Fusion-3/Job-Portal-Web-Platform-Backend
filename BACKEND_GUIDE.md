# Backend Developer Guide: Job Portal Web Platform

## Table of Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [Backend Development Guidelines](#backend-development-guidelines)

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
 