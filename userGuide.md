# User Guide - New Features

This guide covers how to use and test the new features added to NodeBB.

---

## User-Specific Post Pinning

### Overview
Users can now pin individual posts to the top of a topic for their own view. Pinned posts are user-specific and do not affect other users' views of the topic.

### How to Use

#### Pinning a Post
1. **Log in** to your NodeBB account (this feature is only available to logged-in users)
2. Navigate to any topic with multiple posts
3. Locate the post you want to pin
4. Click the **pin button** (thumbtack icon) in the post's action bar (next to upvote/downvote buttons)
5. The post will immediately move to the top of the topic
6. A **"Pinned"** badge will appear on the post

#### Unpinning a Post
1. Locate the pinned post (it will be at the top with a "Pinned" badge)
2. Click the **pin button** (thumbtack icon) again - it will be highlighted/active
3. The post will return to its original position in the topic
4. The "Pinned" badge will be removed

#### Key Behaviors
- Pinned posts remain at the top even after page refresh
- Your pinned posts are only visible to you; other users see posts in normal order
- You can pin multiple posts within a topic
- Pinned posts appear at the top in the order they were pinned, followed by regular posts in their original order

### Testing Instructions
#### Test Case 1: Basic Pin/Unpin
1. Open a topic with multiple posts
2. Pin a post in the topic, try one that's not already on the top
3. **Expected**: Post moves to the top, pin button becomes active, "Pinned" badge appears
4. Refresh the page
5. **Expected**: Post remains at the top with badge
6. Click the pin button again to unpin
7. **Expected**: Post returns to its original position, badge disappears
#### Test Case 2: Multiple Pins
1. Open a topic with multiple posts
2. Pin a few posts
3. **Expected**: Posts appear at top in the order they were pinned in
4. Unpin one of them
5. **Expected**: Order of pinned post stayed, unpinned post goes back to original position
#### Test Case 3: User Isolation
1. Log in as User A and pin a post in a topic
2. Log out and log in as User B
3. View the same topic
4. **Expected**: User B sees posts in normal order, nothing pinned
5. User B pins post #2
6. Log back in as User A
7. **Expected**: User A still sees their post pinned, but not the one that user B pinned
#### Test Case 4: Permissions
1. Log out and view as guest
2. Open any topic
3. **Expected**: No pin buttons visible on any posts

---

## Upvote/Downvote Display

### Feature Overview
Users can now see a detailed breakdown of upvotes and downvotes when hovering over a post's vote score, providing transparency into the actual vote distribution rather than just the net difference.

### How to Use

#### Viewing Vote Breakdown
1. Navigate to any topic with posts that have votes
2. Locate the vote count number between the up/down arrow buttons
3. **Hover your mouse** over the vote count
4. A tooltip will appear showing:
   - Number of upvotes (with up arrow ↑)
   - Number of downvotes (with down arrow ↓)

#### Key Behaviors
- Vote counts update immediately when you or others vote, without page refresh
- Vote breakdown respects existing visibility settings (admin/moderator privileges, upvote/downvote visibility settings)

### Testing Instructions
#### Test Case 1: Basic Vote Display
1. Navigate to a topic with posts
2. Upvote a post
3. Hover over the vote count
4. **Expected**: Tooltip shows "↑ 1 upvote" and "↓ 0 downvotes"
5. Downvote the same post (click the down arrow)
6. Hover over the vote count
7. **Expected**: Tooltip shows "↑ 0 upvotes" and "↓ 1 downvote"
#### Test Case 2: Multiple Voters
1. As User A, upvote a post
2. Log in as User B and upvote the same post
3. Log in as User C and downvote the same post
4. Hover over the vote count
5. **Expected**: Tooltip shows "↑ 2 upvotes" and "↓ 1 downvote"
6. **Expected**: Net vote count displays as "1"
#### Test Case 3: Real-time Updates
1. Open a topic in two browser windows
2. In window 1, hover over a post's vote count and note the values
3. In window 2, upvote the same post
4. Return to window 1 without refreshing and hover again
5. **Expected**: Tooltip shows updated vote counts reflecting the new vote

---

## Automated Tests

### User-Specific Post Pinning Tests
**Location**: `test/pins_spec.js`
**What is Tested**:
- **Authorization**: Verifies that only privileged users (admins, instructors) can pin/unpin posts
- **Pin Limit**: Tests that users cannot exceed the maximum number of pins (5)
- **Idempotency**: Ensures pinning the same post twice doesn't create duplicates
- **Data Validation**: Validates that only numeric topic IDs are accepted
- **Persistence**: Confirms pinned posts are stored and retrieved correctly from Redis
- **Edge Cases**: Tests behavior with invalid UIDs (≤0) and non-numeric values
**Why Tests are Sufficient**:
- **Comprehensive Coverage**: Tests cover all major code paths including success cases, error cases, and edge cases
- **Isolation**: Uses mocked database and dependencies (via `proxyquire` and `sinon`) to test logic in isolation
- **Business Logic**: Validates all business rules (authorization, limits, validation)
- **Data Integrity**: Ensures database operations (add, remove, retrieve) work correctly
- **Security**: Verifies authorization checks prevent unauthorized access

**Running the Tests**:
npm test -- test/pins_spec.js

### Upvote/Downvote Display Tests
**Location**: `test/vote-differentiation.js`
**What is Tested**:
- **Separate Tracking**: Verifies upvotes and downvotes are tracked independently
- **Vote Switching**: Tests that switching from upvote to downvote updates both counts correctly
- **Unvoting**: Ensures removing a vote decrements the appropriate counter
- **Multiple Voters**: Validates correct counting when multiple users vote on the same post
- **Data Consistency**: Confirms vote counts are persisted and retrievable from database
- **Net Score Calculation**: Verifies that the net vote score (upvotes - downvotes) is calculated correctly
**Why Tests are Sufficient**:
- **Core Functionality**: Tests all critical vote operations (upvote, downvote, unvote, switch)
- **Data Accuracy**: Validates that counts are accurate across all scenarios
- **Integration Testing**: Tests the full stack from API calls through database operations
- **Real Database**: Uses actual database mock to ensure data persistence works
- **Edge Cases**: Covers scenarios with 0 votes, multiple voters, and vote changes
- **Cleanup**: Includes proper test cleanup to prevent side effects
**Running the Tests**:
npm test -- test/vote-differentiation.js

# User Guide – Anonymous Replies

## Overview
The **Anonymous Replies** feature lets any logged-in user post replies anonymously within existing discussion threads. When enabled, your display name is hidden and an anonymous handle is shown instead, allowing you to ask questions or share feedback without revealing your identity.

---

## How to Use

### Enabling Anonymous Mode in Quick Reply
1. **Log in** to your account.
2. Open any topic and scroll to the **Quick Reply** area.
3. Use the **Anonymous** toggle (checkbox) to switch between:
   - **OFF (Public):** posts as your user.
   - **ON (Anonymous):** posts using an anonymous handle.
4. Start typing your reply and submit as usual.

### What You’ll See
- When toggled **ON**, the UI shows an anonymous state (e.g., a badge/label) and a status message such as **“Anonymous mode ON.”**
- When toggled **OFF**, the UI returns to normal and may show **“Anonymous mode OFF.”**

### Posting
- **Anonymous ON:** Your reply publishes as **Anonymous** (UID swapped to system anonymous user).
- **Anonymous OFF:** Your reply publishes as **you** (normal behavior).

---

## Key Behaviors
- The toggle state is reflected in a hidden input (`"1"` for ON, `"0"` for OFF`) and used at submit time.
- Anonymous replies show a deterministic handle (e.g., `Anonymous_XXXX`) rather than your username.
- Server configuration must allow anonymous posting for the option to appear.
- This feature applies to **replies** in Quick Reply; creating topics may follow separate rules depending on configuration.

---

## Limitations & Notes
- Forum administrators can disable anonymous posting globally; if disabled, the toggle will not appear.
- Moderators/admins may still have tools to audit content as permitted by forum policy.
- Anonymous mode does **not** retroactively anonymize previously posted content.

---

## Troubleshooting
- **I don’t see the Anonymous toggle:** It may be disabled by configuration or you’re viewing as a guest. Log in and check with an admin if needed.
- **My reply posted as me even though I toggled ON:** Ensure the toggle reads **ON** right before submitting (hidden value should be `"1"`). Refresh and try again.
- **Status messages not showing:** Custom themes or ad-blockers may interfere with UI scripts; try disabling extensions or testing in a default theme.

---

## User Testing Instructions

### Test Case 1: Toggle Behavior
1. Open a topic and locate **Quick Reply**.
2. Toggle **Anonymous ON**.
3. **Expected:** UI indicates anonymous mode (badge/label) and shows **“Anonymous mode ON.”**
4. Toggle **Anonymous OFF**.
5. **Expected:** UI returns to public state and shows **“Anonymous mode OFF.”**

### Test Case 2: Post Anonymously vs Public
1. Toggle **Anonymous ON** and submit a short reply.
2. **Expected:** Reply appears as **Anonymous** with anonymous handle.
3. Toggle **Anonymous OFF** and submit another reply.
4. **Expected:** Reply appears under your normal username.

### Test Case 3: Page Reload / Initialization
1. Set the toggle to **ON**, then **reload** the page.
2. **Expected:** Initial UI matches the underlying state; submitting while **ON** still posts anonymously.

### Test Case 4: Permissions / Config Off
1. Ask an admin to disable the “allow anonymous posts” setting (or use a test env).
2. **Expected:** Anonymous option is hidden or disabled; you cannot post anonymously.

---

## Automated Tests

### Backend Tests
**Location:** `test/anonymous_backend.js`

**What is Tested & Why it’s Sufficient**
- **Configuration toggles & constants:** Verifies feature gates (on/off) and special constants to ensure the system respects admin settings.
- **Deterministic handle generation:** Same user/thread consistently maps to the same anonymous handle—crucial for coherent discussion while preserving anonymity.
- **Permission checks:** Ensures only authorized scenarios permit anonymous posting (category privileges, valid UIDs).
- **Anonymization on create:** Validates that creating **topics/replies** with `anonymous: true` swaps to the anonymous UID and assigns a handle.
- **Mapping storage & retrieval:** Confirms original UID ↔ anonymous post linkage is stored correctly for internal bookkeeping and moderation workflows.
- **User history retrieval:** Fetches anonymous posts associated with a user (internal/admin use cases).
- **Composer build filtering:** Populates `showAnonymousOption` and `canPostAnonymously` flags to drive the client UI correctly.

**Run:**
```bash
npm test -- test/anonymous_backend.js
# or
npm run test
