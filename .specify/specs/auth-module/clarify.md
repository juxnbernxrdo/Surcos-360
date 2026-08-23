# Clarification Log — `/auth` Backend Module

## 1. Ambiguity Analysis & Resolution Log

### Q1: How is Supabase Auth user creation handled during token registration?
* **Context:** When a user registers via `/auth/register` using a `RegistrationToken`, does the frontend call Supabase directly or does NestJS orchestrate user creation?
* **Resolution:** **NestJS orchestrates registration on the backend.** The client submits `{ token, email, password, firstName, lastName }` to NestJS `POST /auth/register`. NestJS validates the token in a Prisma transaction, creates the Supabase Auth user via Supabase Admin SDK (`auth.admin.createUser`), links `userId` to the target `InstitutionalPerson`, marks the token as used, and records an `AuditLog` entry—all atomically. This prevents partial registrations and token replay attacks.

---

### Q2: Who has authority to generate `RegistrationToken`s?
* **Context:** Can any user issue registration tokens?
* **Resolution:**
  1. **Global Admins (Surcos Saving):** Can generate tokens for any `TokenType` (`STUDENT`, `TEACHER`, `AUTHORITY`, `REPRESENTATIVE`, `PYME_MEMBER`).
  2. **PYME Owners / Admins:** Can generate tokens only of `TokenType = PYME_MEMBER` for their specific `organizationId`.
  3. **Students / Teachers / Unprivileged users:** Cannot generate tokens under any circumstances (`403 Forbidden`).

---

### Q3: How is Anti-User Enumeration enforced on authentication endpoints?
* **Context:** Should `/auth/login` or `/auth/tokens/verify` indicate whether an email or token ID exists?
* **Resolution:**
  * `POST /auth/login`: Returns generic `401 Unauthorized` (`"Invalid email or password"`) regardless of whether the email exists or password was wrong.
  * `POST /auth/recover`: Returns `200 OK` (`"If an account with that email exists, password reset instructions have been sent."`) regardless of email existence.
  * `POST /auth/tokens/verify`: Returns `400 Bad Request` (`"Invalid or expired registration token"`) for non-existent, expired, revoked, or fully used tokens without differentiating internal status to external unauthenticated callers.

---

### Q4: How is token hash validation executed securely?
* **Context:** Storing raw tokens in database is a security hazard if the database is compromised.
* **Resolution:** Plaintext tokens (e.g., 32-byte hex strings `st_tok_abc123...`) are sent to the user. The database stores `tokenHash = SHA256(token)`. When redeeming, NestJS computes `SHA256(receivedToken)` and queries Prisma for `tokenHash`. This ensures token hashes cannot be reversed even if DB read access is compromised.

---

### Q5: How are sessions invalidated on logout?
* **Context:** JWT tokens are stateless by default.
* **Resolution:** On `POST /auth/logout`, NestJS invokes Supabase Auth `auth.admin.signOut(jwt)` to revoke the session server-side in Supabase, and logs the logout in `AuditLog`. Client applications must discard local tokens.
