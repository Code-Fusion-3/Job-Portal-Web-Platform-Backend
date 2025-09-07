flowchart TD
    %% Initial employer request
    A["Employer submits request"] --> B["Status: pending"]
    B --> C["Candidate notified (request received, employer hidden)"]

    C --> D{"Admin Review"}
    D -->|Approve| E["Status: approved"]
    D -->|Reject| F["Status: cancelled"]

    E --> G["Candidate notified (approved, employer hidden)"]
    G --> H["First payment requested (5,000 RWF)"]
    H --> I["Status: first_payment_required"]

    %% First payment flow
    I --> J["Employer pays & confirms"]
    J --> K["Status: first_payment_confirmed"]

    K --> L{"Admin Payment Review"}
    L -->|Approve| M["Status: photo_access_granted"]
    L -->|Reject| F

    M --> N["Employer can view & download photo"]

    %% Employer decision
    N --> O{"Employer Decision"}
    O -->|Request Full Details| P["Status: full_details_requested"]
    O -->|Stop Here| Q["Status: process_complete"]

    %% Full details request flow
    P --> R{"Admin Review Full Details"}
    R -->|Approve| S["Admin sets request amount → Second payment requested"]
    R -->|Reject| M

    S --> T["Status: second_payment_required"]
    T --> U["Employer pays second installment"]
    U --> V["Status: second_payment_confirmed"]

    %% Second payment approval
    V --> W{"Admin Second Payment Review"}
    W -->|Approve| X["Status: full_access_granted"]
    W -->|Reject| F

    %% Hiring decision
    X --> Y["Employer accesses full details"]
    Y --> Z{"Employer Hiring Decision"}
    Z -->|Hires Candidate| AA["Status: hiring_decision_made"]
    Z -->|Does Not Hire| AB["Status: hiring_decision_not_made"]

    AA --> AC["Candidate notified (hired, employer shown)"]
    AB --> AD["No notification"]

    AC --> AE{"Admin Candidate Availability Update"}
    AB --> AE

    AE -->|Mark Hired| AF["Status: hired (unrequestable)"]
    AE -->|Keep Available| AG["Status: available"]

    AF --> AH["Process Complete"]
    AG --> AH


Analysis of Proposed Workflow vs Current
Aspect	Current Implementation	Proposed Workflow
Candidate Notifications	❌ None	✅ Candidate notified at request, approval, and hiring
Employer Privacy	❌ Always visible	✅ Hidden until hire stage
Payment Flow	❌ Fixed for both	✅ First fixed (5,000 RWF), second admin-set
Status Management	❌ Generic approved/cancelled/completed	✅ More granular: pending, first_payment_required, first_payment_confirmed, photo_access_granted, full_details_requested, second_payment_required, full_access_granted, hiring_decision_made, hiring_decision_not_made, hired, available
Process Exit Points	❌ Must follow full pipeline	✅ Employer can stop at photo access (process_complete)
Admin Control	❌ Only approve/reject	✅ Approve/reject + set second payment + manage availability
🔧 Implementation Work Breakdown
1. Database Schema Updates

Add new statuses (pending, hiring_decision_not_made, etc.).

Add notification logs (who was notified, when, type).

Add employer visibility flag (whether candidate sees employer identity).

2. Backend Changes

Workflow engine / status transition logic:
Update the service that manages status changes.

Notification service:
Send candidate emails at:

Request received (pending)

Request approved (approved)

Hired (hiring_decision_made)

Admin payment control:

First payment fixed at 5,000 RWF (system-triggered).

Second payment → admin sets amount at approval.

3. Frontend Updates

Candidate side:

Show notifications (in-app + email).

Hide employer details until hiring.

Employer side:

Dashboard showing payment steps (photo access, full details).

Admin side:

Approve/reject requests.

Set second payment amount.

Manage candidate availability.

View candidate status timeline.

🚀 Suggested Implementation Order

Since this is a workflow refactor, you want to start with core logic and then layer on features:

Status Management (Backend + DB first)

Add all new statuses into your workflow engine.

Update transitions (pending → approved → first_payment_required, etc.).

Candidate Notification System (Backend + Emails)

Hook into status changes to trigger candidate notifications.

Add templates for pending, approved, hired.

Admin Controls (Frontend + Backend)

Add “Set second payment amount” UI + backend endpoint.

Add candidate availability management.

Frontend Updates (Employer & Candidate Dashboards)

Update UI to reflect new statuses.

Add new flows (download photo, view details, etc.).


Decisions taken (defaults I applied)

Migrate existing requests: yes — with an explicit mapping table (see migration script). Any ambiguous mappings are logged for manual review.

Notification preferences: candidates are opted-in by default, but we add a notification_preferences JSON field so candidates can opt-out of specific types (email/in-app/SMS) later.

Admin payment control: admin sets the second payment amount during the full-details approval flow (this is when we create the second_payment_amount and second_payment_required status).

Employer visibility: employer identity is only revealed when the candidate is hired (hired status) — not on not_hired.