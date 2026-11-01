# Pollwise — Personal Account Onboarding Documentation

**Scope:** Personal Account only  
**Product:** Pollwise  
**Purpose:** Allow an individual to create a Pollwise account, secure it, complete basic setup, and access their personal voter dashboard.

This document defines the onboarding screens, fields, validation rules, system behavior, navigation, error states, and how each step connects to the next.

> **Scope boundary:** Personal accounts are for individuals using Pollwise to access elections they are eligible to participate in. This flow does not create an institution, configure institutional elections, or onboard institutional administrators.

---

## 1. Personal Account Onboarding Overview

### Main flow

```
Create Account — Personal Account
        ↓
Validate Registration Form
        ↓
Create Account
        ↓
Verify Email Address
        ↓
Account Activated
        ↓
Welcome to Pollwise
        ↓
Complete Personal Profile
        ↓
Set Up Account Security
        ↓
Join an Institution / Enter Invitation Code / Skip
        ↓
Personal Dashboard
        ↓
View Available Elections
```

Some steps may be skipped when the required information has already been provided or verified.

### Onboarding goals

- Create a valid personal account.
- Verify the user's email address.
- Explain what a personal Pollwise account can do.
- Collect only necessary profile information.
- Allow users to join an institution or connect to an election when invited.
- Guide users to their personal dashboard without forcing them through institutional setup.

---

# 2. Create Account — Personal Account

This is the registration screen shown in the current design.

## 2.1 Account Type Selector

The page contains two account types:

- Personal Account
- Institution Account

When **Personal Account** is selected:

- Display the personal registration fields.
- Set the registration flow type to `personal`.
- Show the button label **Create Personal Account**.
- Do not display institution name, institution type, or administrator setup fields.

When **Institution Account** is selected, the user enters the separate institutional flow. That flow is outside this document.

## 2.2 Registration Fields

### First Name

- Required
- Text input
- Trim leading and trailing spaces
- Reject empty or invalid values

### Last Name

- Required
- Text input
- Trim leading and trailing spaces

### Email Address

- Required
- Must be a valid email format
- Normalize case and whitespace
- Must be unique within Pollwise
- Used for account verification and sign-in

### Password

- Required
- Must meet Pollwise password policy
- Show password visibility toggle
- Display password requirements near the field or as helper text

Suggested policy:

- Minimum 12 characters (or system standard >= 8-12)
- Allow long passphrases
- Reject commonly compromised passwords
- Do not require arbitrary character combinations if the password strength policy already provides adequate protection

### Confirm Password

- Required
- Must match the password field
- Show a clear inline error when values differ

### Terms and Privacy Agreement

- Required checkbox
- Links to Terms of Service and Privacy Policy
- Must be explicitly checked before registration

## 2.3 Form Validation

Validation should occur:

- On field blur
- During typing where helpful
- On form submission

Examples:

- “Enter your first name.”
- “Enter a valid email address.”
- “An account with this email already exists.”
- “Your password does not meet the requirements.”
- “Passwords do not match.”
- “You must agree to the Terms of Service and Privacy Policy.”

Avoid showing all errors before the user interacts with the form.

## 2.4 Submit Behavior

When the user selects **Create Personal Account**:

1. Disable the submit button.
2. Display a loading state.
3. Validate all fields on the frontend.
4. Send registration data to the backend over HTTPS.
5. Backend validates the request again.
6. Backend checks whether the email already exists.
7. Backend securely hashes the password.
8. Backend creates the account in an unverified state.
9. Backend sends an email verification message.
10. Frontend routes the user to the Verify Email screen.

Do not create an authenticated session that grants access to protected features before email verification, unless the application uses a tightly restricted verification-only session.

## 2.5 Registration Error States

| Situation                 | User experience                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Email already registered  | Explain that the email is already associated with an account and offer Sign In or Password Reset |
| Weak password             | Show password requirements                                                                       |
| Network failure           | Keep form values and allow retry                                                                 |
| Server error              | Show a friendly error and allow retry                                                            |
| Email service unavailable | Explain that verification delivery is delayed and provide a resend option                        |
| Repeated submissions      | Prevent duplicate account creation                                                               |

---

# 3. Email Verification

## 3.1 Verify Email Screen

After successful registration, display:

**Title:** Verify your email address  
**Message:** We sent a verification link to the email address you entered. Verify your email to activate your Pollwise account.

### Screen contents

- Email address, partially masked where appropriate
- Instructions to check inbox and spam folder
- **Resend Verification Email** button
- **Change Email Address** action
- Back to Sign In link
- Loading and success states

## 3.2 Verification Flow

1. User opens the verification email.
2. User clicks the verification link.
3. Backend validates the single-use, time-limited token.
4. Backend marks the email as verified.
5. Account status changes from `pending_verification` to `active`.
6. User is redirected to the onboarding welcome screen.

Verification tokens must be single-use, expire after a defined period, and be stored securely.

## 3.3 Resend Verification

- Enforce rate limits.
- Invalidate or expire old tokens as appropriate.
- Show confirmation when a new email is sent.
- Do not reveal whether arbitrary email addresses have accounts.

## 3.4 Expired or Invalid Link

Display:

- “This verification link is expired or invalid.”
- **Send a New Verification Link**
- **Return to Sign In**

---

# 4. Welcome to Pollwise

This is the first screen after successful email verification.

## 4.1 Purpose

Introduce the user to their personal Pollwise account and explain the next steps without overwhelming them.

## 4.2 Screen Contents

- Pollwise logo
- Welcome message using the user's first name
- Short explanation of the personal account
- Progress indicator, such as “Step 1 of 3”
- **Get Started** button

Suggested copy:

**Welcome to Pollwise**

Your personal account is ready. Complete a few quick steps to prepare your account for secure and convenient voting.

## 4.3 Behavior

- Get Started opens Personal Profile Setup.
- The user can leave onboarding and resume later.
- Onboarding progress is saved server-side.
- Returning users resume from the last incomplete step.

---

# 5. Personal Profile Setup

## 5.1 Purpose

Collect basic profile details that help identify the user within Pollwise. This profile is not an institutional membership record and does not automatically establish election eligibility.

## 5.2 Profile Fields

### Required

- First name
- Last name

These may already be populated from registration.

### Optional

- Profile photo
- Display name
- Phone number
- Country or region
- Preferred language

Do not request sensitive identity documents during general personal onboarding unless a specific institution or election requires a verified identity process.

## 5.3 Profile Photo

If supported:

- Upload an image
- Preview the image
- Crop or reposition
- Remove or replace the image

Validate file type and size on both client and server.

## 5.4 Behavior

- Save profile changes.
- Show field-level validation.
- Allow the user to skip optional fields.
- Continue to Account Security Setup.

---

# 6. Account Security Setup

## 6.1 Purpose

Help users secure their account before they participate in elections.

## 6.2 Screen Contents

- Security introduction
- Password status
- Multi-factor authentication setup, if supported
- Recovery options
- **Set Up Security** and **Do This Later** actions

## 6.3 Multi-Factor Authentication

If Pollwise supports MFA, users may configure:

- Authenticator app
- Email verification challenge
- Other institution-approved methods

### MFA setup flow

1. User selects an MFA method.
2. Pollwise displays setup instructions.
3. User completes verification.
4. Backend confirms setup.
5. Recovery codes are displayed once, if applicable.
6. User confirms they have saved the recovery codes.

MFA setup may be optional for ordinary personal accounts but can become mandatory for specific institutions or elections.

## 6.4 Security Rules

- Never display passwords after submission.
- Do not store recovery codes in plaintext.
- Provide session management in account settings.
- Allow users to revoke active sessions.
- Require re-authentication for sensitive account changes.

---

# 7. Join an Institution or Connect to an Election

## 7.1 Purpose

A personal account may need to be associated with an institution to access elections. This step should be optional unless the user arrived through an institution-issued invitation.

## 7.2 Screen Contents

**Title:** Connect to your institution

Options:

- **Enter an Invitation Code**
- **Use an Invitation Link**
- **Find My Institution**, if supported
- **Skip for Now**

Supporting copy should explain that users can complete their personal account now and connect to an institution later.

## 7.3 Invitation Code Flow

1. User enters an invitation code.
2. Backend validates the code.
3. Pollwise displays the institution name and invitation details.
4. User confirms joining.
5. Backend creates the appropriate membership or invitation acceptance record.
6. User receives a confirmation.
7. The institution appears in the user's account.

The code must be scoped to the correct institution and invitation purpose, expire when appropriate, and be protected against guessing.

## 7.4 Invitation Link Flow

1. User opens an institution-issued invitation link.
2. If not signed in, Pollwise asks them to register or sign in.
3. After authentication, Pollwise validates the invitation.
4. User confirms acceptance if required.
5. Membership or election access is established.
6. User is redirected to the relevant institution or election page.

## 7.5 Skip Behavior

If the user skips:

- Do not create an institution membership.
- Do not mark the user as eligible for any election.
- Continue to the Personal Dashboard.
- Provide a later option to join using an invitation code or link.

---

# 8. Onboarding Completion

## 8.1 Completion Screen

Display a concise success screen:

**You're all set**

Your Pollwise personal account is ready.

Actions:

- **Go to My Dashboard**
- Optional: **View How Voting Works**

## 8.2 Completion Conditions

The onboarding process is complete when:

- Account exists.
- Email is verified.
- Required profile fields are valid.
- Required security steps are complete.
- Institution connection is either completed or skipped.

Store an onboarding status such as:

- `not_started`
- `in_progress`
- `completed`

The backend should be the source of truth for onboarding status.

---

# 9. Personal Dashboard

After onboarding, the user enters the Personal Dashboard.

## 9.1 Dashboard Sections

### Welcome Header

- User's display name
- Short welcome message
- Profile completion prompt, if relevant

### My Elections

- Active elections the user is eligible for
- Upcoming elections
- Completed elections
- Elections requiring action

### Election Status Cards

- Not Open Yet
- Voting Open
- Vote Submitted
- Election Closed
- Results Published

### Join Election / Institution

- Enter invitation code
- Accept invitation link
- Connect to institution, if supported

### Recent Activity

- Account verification
- Institution joined
- Election invitation received
- Vote participation confirmation
- Results published

### Account Security

- Email verification status
- MFA status
- Security settings shortcut

## 9.2 Dashboard Empty State

If the user has no institution or eligible elections, show:

**No elections available yet**

You can join an institution using an invitation link or code. When you become eligible for an election, it will appear here.

Actions:

- **Enter Invitation Code**
- **Learn How Pollwise Works**

Do not show fake elections or misleading eligibility status.

---

# 10. Sign-In and Returning User Flow

After onboarding, the normal returning-user flow is:

```
Sign In
   ↓
Validate Credentials
   ↓
Check Account Status
   ↓
Complete MFA, if enabled
   ↓
Check Onboarding Status
   ↓
If Incomplete → Resume Onboarding
If Complete   → Personal Dashboard
```

### Important behavior

- Unverified accounts return to Verify Email.
- Suspended accounts receive an appropriate access message.
- Users with incomplete onboarding resume at the last unfinished step.
- Users with completed onboarding go directly to the dashboard.
- Password reset must not erase onboarding progress.

---

# 11. Account Settings After Onboarding

The personal account should provide these settings after onboarding.

## 11.1 Personal Information

- First name
- Last name
- Display name
- Profile photo
- Phone number
- Country or region

## 11.2 Login and Security

- Change password
- MFA setup
- Active sessions
- Sign out of other sessions
- Recovery options

## 11.3 Connected Institutions

- Institution memberships
- Pending invitations
- Join institution
- Leave institution, subject to election and institutional rules

## 11.4 Notifications

- Election invitations
- Voting reminders
- Election closure notices
- Results publication
- Security notifications

Required election and security notifications may not be fully disabled if institutional policy requires them.

## 11.5 Privacy and Account

- Privacy settings
- Data access request
- Account deactivation request
- Account deletion request, subject to legal and institutional retention requirements

---

# 12. Backend and Data Requirements

Suggested personal-account fields:

### User

- `id`
- `first_name`
- `last_name`
- `display_name`
- `email`
- `email_verified_at`
- `password_hash`
- `phone_number`
- `profile_image_url`
- `account_status`
- `mfa_enabled`
- `created_at`
- `updated_at`

### Personal Onboarding

- `user_id`
- `onboarding_status`
- `current_step`
- `profile_completed_at`
- `security_setup_completed_at`
- `institution_step_completed_at`
- `completed_at`

### Institution Membership

- `id`
- `user_id`
- `institution_id`
- `membership_status`
- `joined_at`

### Invitation

- `id`
- `institution_id`
- `invitation_type`
- `token_hash`
- `expires_at`
- `accepted_at`
- `status`

The final schema should align with the institution and election data models, but personal onboarding must not create institutional records unless the user explicitly joins an institution.

---

# 13. API Endpoint Suggestions

| Endpoint                                  | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `POST /auth/register/personal`            | Create personal account           |
| `POST /auth/verify-email`                 | Verify email token                |
| `POST /auth/resend-verification`          | Resend verification email         |
| `POST /auth/login`                        | Sign in                           |
| `POST /auth/logout`                       | End current session               |
| `POST /auth/forgot-password`              | Request password reset            |
| `POST /auth/reset-password`               | Reset password                    |
| `GET /users/me`                           | Get current user's profile        |
| `PATCH /users/me`                         | Update personal profile           |
| `GET /users/me/onboarding`                | Get onboarding status             |
| `PATCH /users/me/onboarding`              | Save onboarding progress          |
| `POST /users/me/mfa/setup`                | Start MFA setup                   |
| `POST /users/me/mfa/verify`               | Confirm MFA setup                 |
| `POST /institutions/invitations/validate` | Validate invitation code or token |
| `POST /institutions/invitations/accept`   | Accept institution invitation     |
| `GET /users/me/elections`                 | Get elections the user may access |

All endpoints must authenticate and authorize requests as appropriate, validate input, rate-limit sensitive operations, and return consistent error responses.

---

# 14. UI States and UX Requirements

Every onboarding screen should support:

### Loading

- Disable duplicate submissions.
- Show a clear progress indicator.
- Preserve entered values where safe.

### Success

- Confirm the completed action.
- Continue to the next step.

### Error

- Show a human-readable message.
- Identify the field or action that needs attention.
- Provide a recovery action.

### Empty State

- Explain why there is no content.
- Offer a useful next step.

### Responsive Behavior

- Desktop: centered onboarding card or two-column layout where appropriate.
- Tablet: reduced spacing and stacked form sections.
- Mobile: single-column layout, full-width actions, readable labels, and accessible touch targets.

### Accessibility

- Labels associated with every field.
- Keyboard navigation.
- Visible focus states.
- Screen-reader-friendly error messages.
- Sufficient contrast.
- No reliance on color alone to communicate status.

---

# 15. Personal Account Flow Summary

```
Create Account
   ↓
Select Personal Account
   ↓
Enter Name, Email, Password
   ↓
Confirm Password and Accept Terms
   ↓
Submit Registration
   ↓
Verify Email
   ↓
Welcome Screen
   ↓
Personal Profile Setup
   ↓
Account Security Setup
   ↓
Join Institution / Use Invitation / Skip
   ↓
Onboarding Complete
   ↓
Personal Dashboard
   ↓
View Eligible Elections
   ↓
Participate When an Election Opens
```

---

# 16. Definition of Done

The personal onboarding flow is ready when:

- Personal Account registration works independently of institution registration.
- Form validation works on frontend and backend.
- Passwords are securely hashed.
- Email verification is required before protected access.
- Verification tokens expire and cannot be reused.
- Users can recover from expired links and email delivery issues.
- Onboarding progress is saved and resumable.
- Profile fields can be edited later.
- Security setup is available and enforced when required.
- Institution joining is optional unless required by an invitation flow.
- Skipping institution connection does not grant election eligibility.
- Users reach the Personal Dashboard after completion.
- Returning users resume incomplete onboarding or go directly to the dashboard.
- Error, loading, empty, and responsive states are implemented.
- Personal account data is isolated from institutional administration features.

**End of Personal Account Onboarding Specification.**
