# Database Schema Overview

This document summarizes the Mongoose schemas under `backend/models`. Each section lists fields, key constraints, indexes, and notable hooks or statics.

---

**User**

**Collection** `users` (Mongoose default)

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `firstName` | String | Required |
| `lastName` | String | Required |
| `birthday` | Date | Optional |
| `email` | String | Required, unique |
| `isVerified` | Boolean | Default `false` |
| `otp` | String | |
| `otpExpires` | Date | |
| `otpAttempts` | Number | Default `0` |
| `otpLastSentAt` | Date | |
| `inviteToken` | String | |
| `inviteExpires` | Date | |
| `invitedBy` | ObjectId | Ref `User` |
| `password` | String | Optional for OAuth |
| `googleId` | String | Sparse, indexed |
| `authProvider` | String | Enum `local` \| `google`, default `local` |
| `lastLoginProvider` | String | Enum `local` \| `google`, default `local` |
| `role` | String | Enum `resident` \| `barangay_official` \| `administrator` \| `auditor`, default `resident` |
| `position` | String | |
| `isActive` | Boolean | Default `true` |
| `lastSeenAt` | Date | Default `null` |
| `lastLogoutAt` | Date | Default `null` |
| `twoFactorSecret` | String | Encrypted, `select: false` |
| `twoFactorEnabled` | Boolean | Default `false` |
| `recoveryCodes` | [String] | Hashed, `select: false` |
| `mustChangePassword` | Boolean | Default `false` |
| `mustSetup2FA` | Boolean | Default `false` |
| `passwordChangedAt` | Date | |
| `resetPasswordToken` | String | SHA-256 hash |
| `resetPasswordExpires` | Date | |
| `failedLoginAttempts` | Number | Default `0` |
| `lockUntil` | Date | |
| `pendingEmail` | String | |
| `emailChangeOtpOld` | String | |
| `emailChangeOtpNew` | String | |
| `emailChangeExpires` | Date | |
| `profilePicture` | String | Default `null` |

**Virtuals**

| Name | Type | Notes |
| --- | --- | --- |
| `username` | String | `${firstName} ${lastName}` |

**Hooks**

| Hook | Trigger | Notes |
| --- | --- | --- |
| `pre('save')` | password change | Hash password, set `passwordChangedAt` |
| `pre('save')` | role -> administrator | Requires `_allowAdminChange`, forces `mustSetup2FA` if `twoFactorEnabled` is false |

**Methods**

| Method | Purpose |
| --- | --- |
| `comparePassword(candidatePassword)` | bcrypt compare |
| `setTwoFactorSecret(secret)` | AES-256 encrypt and store |
| `getTwoFactorSecret()` | AES-256 decrypt |
| `generateRecoveryCodes()` | Create 8 one-time codes |
| `useRecoveryCode(code)` | Validate and consume |

---

**TrustedDevice**

**Collection** `trusteddevices`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | Ref `User`, required, indexed |
| `deviceHash` | String | Required |
| `ipHash` | String | Required |
| `userAgent` | String | |
| `label` | String | Device label |
| `lastUsed` | Date | Default `Date.now` |
| `expiresAt` | Date | Required, TTL |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ userId: 1, deviceHash: 1, ipHash: 1 }` | Compound lookup |
| `expiresAt` | TTL `expireAfterSeconds: 0` |

**Statics**

| Method | Purpose |
| --- | --- |
| `generateDeviceHash(userAgent)` | SHA-256 hash |
| `generateIpHash(ip)` | SHA-256 hash |
| `isDeviceTrusted(userId, userAgent, ip)` | Verify or update device |
| `addTrustedDevice(userId, userAgent, ip)` | Upsert trusted device |
| `removeAllForUser(userId)` | Delete all devices |

---

**BlacklistedToken**

**Collection** `blacklistedtokens`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `token` | String | Required, unique, indexed |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ createdAt: 1 }` | TTL 24 hours (`expireAfterSeconds: 86400`) |

---

**Feedback**

**Collection** `feedbacks`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `author` | ObjectId | Ref `User`, required |
| `transactionRef` | ObjectId | Ref `Transaction`, optional |
| `transactionMeta` | Object | Denormalized snapshot |
| `transactionMeta.transactionId` | String | |
| `transactionMeta.amount` | Number | |
| `transactionMeta.agency` | String | |
| `transactionMeta.programName` | String | |
| `transactionMeta.transactionType` | String | |
| `transactionMeta.timestamp` | Date | |
| `content` | String | Required, max 1000 |
| `pendingEditContent` | String | Optional, max 1000 |
| `actionStatus` | String | Enum `none` \| `pending_approval` \| `pending_edit` \| `pending_delete` \| `rejected`, default `pending_approval` |
| `replies` | [Reply] | Embedded |

**Reply (Embedded)**

| Field | Type | Notes |
| --- | --- | --- |
| `author` | ObjectId | Ref `User`, required |
| `content` | String | Required, max 300 |
| `pendingEditContent` | String | Optional, max 300 |
| `actionStatus` | String | Enum `none` \| `pending_approval` \| `pending_edit` \| `pending_delete` \| `rejected`, default `none` |

---

**Complaint**

**Collection** `complaints`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | Ref `User`, optional |
| `userEmail` | String | Optional |
| `trackingNumber` | String | Unique, generated |
| `category` | String | Enum list |
| `subject` | String | Required |
| `description` | String | Required |
| `location` | String | Default `''` |
| `anonymous` | Boolean | Default `false` |
| `attachments` | [String] | File paths |
| `status` | String | Enum `pending` \| `under_review` \| `in_progress` \| `resolved` \| `closed`, default `pending` |
| `response` | String | Default `''` |
| `respondedBy` | ObjectId | Ref `User` |
| `respondedAt` | Date | |
| `submittedAt` | Date | Default `Date.now` |

**Hooks**

| Hook | Trigger | Notes |
| --- | --- | --- |
| `pre('save')` | missing `trackingNumber` | Generates `CMP-YYYY-#####` |

---

**AuditLog**

**Collection** `auditlogs`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `action` | String | Enum list, indexed |
| `userId` | ObjectId | Ref `User`, indexed |
| `userRole` | String | |
| `username` | String | |
| `feedbackId` | ObjectId | Ref `Feedback`, indexed |
| `transactionId` | ObjectId | Ref `Transaction` |
| `details` | Mixed | Arbitrary metadata |
| `ipAddress` | String | |
| `userAgent` | String | |
| `isSuspicious` | Boolean | Default `false`, indexed |
| `suspiciousReason` | String | |
| `reviewedBy` | ObjectId | Ref `User` |
| `reviewedAt` | Date | |
| `reviewNotes` | String | |
| `hash` | String | Indexed |
| `previousHash` | String | |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ createdAt: -1 }` | |
| `{ userId: 1, createdAt: -1 }` | |
| `{ action: 1, createdAt: -1 }` | |
| `{ isSuspicious: 1, createdAt: -1 }` | |

**Statics**

| Method | Purpose |
| --- | --- |
| `logAction(data)` | Append tamper-chained log entry |
| `getUserActivity(userId, days)` | Recent activity |
| `getSuspiciousActivity(days)` | Suspicious activity |

---

**Alert**

**Collection** `alerts`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `transactionId` | ObjectId | Ref `Transaction`, required |
| `txHash` | String | Required |
| `severity` | String | Enum `low` \| `medium` \| `high` \| `critical` |
| `anomalyCategory` | String | Enum list |
| `riskScore` | Number | 0-100 |
| `reasons` | [String] | |
| `features` | Map | Mixed values |
| `shapValues` | Map | Number values |
| `status` | String | Enum `open` \| `under_review` \| `closed` \| `false_positive`, default `open` |
| `assignedTo` | ObjectId | Ref `User` |
| `caseId` | ObjectId | Ref `Case` |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ status: 1, severity: -1, createdAt: -1 }` | |

---

**ModelVersion**

**Collection** `modelversions`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `version` | String | Required, unique, indexed |
| `trainedAt` | Date | Default `Date.now` |
| `trainingDataSize` | Number | Required |
| `trainingDuration` | Number | Seconds, required |
| `accuracy` | Number | 0-1 |
| `precision` | Number | 0-1 |
| `recall` | Number | 0-1 |
| `f1Score` | Number | 0-1 |
| `performanceMetrics` | Object | AUC + confusion matrix + report |
| `isActive` | Boolean | Default `false`, indexed |
| `deployedAt` | Date | |
| `deploymentStrategy` | String | Enum `immediate` \| `canary` \| `blue-green` \| `rolling`, default `canary` |
| `canaryPercentage` | Number | 0-100, default 10 |
| `previousVersion` | String | Ref `ModelVersion` |
| `rollbackVersion` | String | Ref `ModelVersion` |
| `modelPath` | String | Required |
| `modelSize` | Number | Bytes |
| `modelHash` | String | SHA-256 |
| `validationResults` | Object | Validation booleans |
| `liveMetrics` | Object | Totals + live accuracy |
| `description` | String | |
| `trainingConfig` | Mixed | |
| `createdBy` | ObjectId | Ref `User` |
| `deactivatedAt` | Date | |
| `deactivationReason` | String | |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ isActive: 1, deployedAt: -1 }` | |
| `{ version: 1 }` | |

**Hooks**

| Hook | Trigger | Notes |
| --- | --- | --- |
| `pre('save')` | `isActive` set to true | Deactivate other models |

**Statics**

| Method | Purpose |
| --- | --- |
| `getActiveModel()` | Fetch active version |
| `updateLiveMetrics(version, isCorrect)` | Update totals |
| `deployModel(version, strategy)` | Validate + activate |
| `rollback(toVersion)` | Switch active model |

---

**InflationRate**

**Collection** `inflationrates`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `month` | Date | Required, unique, indexed |
| `rate` | Number | Range -100 to 1000 |
| `source` | String | Enum `worldbank` \| `manual` \| `psa`, default `worldbank` |
| `metadata` | Object | API response and fetch time |

**Statics**

| Method | Purpose |
| --- | --- |
| `getCurrentRate()` | Latest `rate` |
| `getRateForMonth(date)` | Rate for month |

---

**RateLimit**

**Collection** `ratelimits`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | Ref `User`, required, indexed |
| `limitType` | String | Enum `feedback_submission` \| `api_call` \| `login_attempt` |
| `date` | String | `YYYY-MM-DD`, indexed |
| `count` | Number | Default `0` |
| `limit` | Number | Default `50` |
| `limitReachedAt` | Date | |
| `resetsAt` | Date | Required |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ userId: 1, limitType: 1, date: 1 }` | Unique |

**Statics**

| Method | Purpose |
| --- | --- |
| `checkAndIncrement(userId, limitType, limit)` | Increment and return status |
| `getStatus(userId, limitType)` | Current counters |
| `resetUserLimit(userId, limitType)` | Admin reset |
| `cleanup(daysToKeep)` | Prune old records |

---

**Transaction**

**Collection** `transactions`

**Timestamps** `createdAt`, `updatedAt`

**Fields**

| Field | Type | Notes |
| --- | --- | --- |
| `transactionId` | String | Unique, indexed |
| `txHash` | String | Required, unique, indexed |
| `blockHash` | String | |
| `blockNumber` | Number | |
| `blockchainTxId` | String | |
| `gasUsed` | Number | |
| `transactionType` | String | Enum list, required, indexed |
| `programName` | String | |
| `agency` | String | |
| `fromAddress` | String | Required, indexed |
| `toAddress` | String | Required, indexed |
| `amount` | Number | Required |
| `currency` | String | Default `PHP` |
| `beneficiaryId` | String | Hashed/anonymized |
| `beneficiaryType` | String | Enum list |
| `timestamp` | Date | Default `Date.now`, indexed |
| `staged` | Boolean | Default `false`, indexed |
| `description` | String | Trimmed |
| `verificationStatus` | String | Enum list, default `Pending`, indexed |
| `verifiedBy` | String | |
| `metadata` | Map | Mixed values |
| `flagged` | Boolean | Default `false`, indexed |
| `riskScore` | Number | 0-100, indexed |
| `zScore` | Number | |
| `riskLevel` | String | Enum `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`, indexed |
| `velocityFlag` | Boolean | Default `false` |
| `receiverPatternFlag` | Boolean | Default `false` |
| `amountSpikeFlag` | Boolean | Default `false` |
| `mlUsed` | Boolean | Default `false` |
| `mlScore` | Number | 0-100 |
| `graphNodeId` | String | |
| `networkFeatures` | Object | Graph metrics |
| `fraudPatterns` | [Object] | Pattern details |
| `reasons` | [String] | |

**Indexes**

| Index | Notes |
| --- | --- |
| `{ transactionType: 1, timestamp: -1 }` | |
| `{ riskLevel: 1, flagged: 1 }` | |
| `{ agency: 1, programName: 1 }` | |

**Hooks**

| Hook | Trigger | Notes |
| --- | --- | --- |
| `pre('save')` | missing `transactionId` | Generates `PH-GOV-######` |

