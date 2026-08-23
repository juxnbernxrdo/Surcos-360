# Users & Identity Module — Surcos 360

## Overview
The `/users` module governs the institutional identity lifecycle, profile management, status transitions (`ACTIVE`, `INACTIVE`, `SUSPENDED`), and identity linking.

## Endpoints
- `GET /users/me`: Current user profile.
- `PATCH /users/me`: Update self contact information.
- `GET /users`: (Admin/Teacher) List all users with pagination and search.
- `GET /users/:id`: (Admin/Teacher) Lookup specific user.
- `PATCH /users/:id/status`: (Admin only) Update status (`ACTIVE`, `SUSPENDED`, `INACTIVE`).
- `POST /users/link-identity`: (Admin only) Link unlinked `InstitutionalPerson` to `userId`.
