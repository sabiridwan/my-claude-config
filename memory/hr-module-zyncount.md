---
name: hr-module-zyncount
description: Complete technical reference for the HR module in zyncount-be (NestJS + GraphQL + MongoDB). Use when building, replicating, or updating the HR module in any Zyncount-family project.
metadata:
  type: reference
---

# HR Module — Zyncount BE Reference

**Source repo:** `/Users/sabiridwan/Projects/zyncount/zyncount-be/src/modules/hr/`
**Stack:** NestJS 9, Apollo GraphQL code-first, MongoDB/Mongoose 6, `zync-nest-data-module`
**Last audited:** 2026-05-17

> To replicate this module in another project, follow the zync-nestjs standard (see global CLAUDE.md) and use the file layouts, schema fields, and GraphQL contracts below as the canonical spec.

---

## Sub-modules (16 total)

| Sub-module | Folder | Collection(s) | Purpose |
|---|---|---|---|
| Employee | `employee/` | `employees` | Master employee records — hub for all HR refs |
| Department | `department/` | `departments` | Org structure; head-of-department |
| Leave | `leave/`, `leave/group/` | `leaves`, `leave_groups` | Leave requests + type allocation per group |
| Attendance | `attendance/` + `shift/` + `group/` + `timetable/` | `attendances`, `shifts`, `attendance_groups`, `timetables` | Clock in/out; shift patterns; attendance rules |
| Timesheet | `timesheet/` | `hr_timesheets` | Work hour entries with approval workflow |
| Payroll | `payroll/` + 7 sub-components | `payroll`, `payroll_employee`, `payroll_contribution`, `payroll_contribution_groups`, `payroll_item_groups`, `payroll_item_settings`, `payroll_tax_brackets`, `employee_salaries` | Full salary calculation, disbursement, journal posting |
| Claim | `claim/` + `group/` + `type/` | `claims`, `claim_groups`, `claim_types` | Expense claims with approval routing |
| Advance | `advance/` + `transaction/` | `advances`, `advance_transactions` | Salary advances + disbursement/repayment transactions |
| Loan | `loan/` + `repayment/` | `loans`, `loan_repayments` | Employee loans with installment scheduling |
| Approval | `approval/` | `approvals` | Unified approval workflow for Leave/Claim/Advance/Loan |
| Calendar | `calendar/` | `calendars` | Holiday and working day definitions |
| Training | `training/` + `group/` + `assignment/` + `progress/` + `certificate/` | `trainings`, `training_groups`, `training_assignments`, `training_progress`, `training_certificates` | Training programs, assignments, progress, certificates |
| Dashboard | `dashboard/` | — (aggregates) | HR analytics: headcount, attendance, payroll, dept breakdown |
| Org Chart | `org-chart/` | — (computed) | Hierarchical reporting tree from `Employee.reportingTo` |
| ESS | `ess/` | — | Employee Self-Service: PIN auth, QR clock-in, profile |

---

## Module composition (hr.module.ts)

All 23 sub-modules are imported and re-exported:
`EmployeeModule`, `DepartmentModule`, `CalendarModule`, `AttendanceModule` (includes Shift + AttendanceGroup + Timetable), `TimesheetModule`, `LeaveGroupModule`, `LeaveModule`, `ApprovalModule`, `ClaimModule`, `ClaimGroupModule`, `ClaimTypeModule`, `AdvanceModule`, `LoanModule`, `LoanRepaymentModule`, `PayrollModule`, `PayrollContributionGroupModule`, `PayrollItemSettingModule`, `TaxBracketModule`, `HrDashboardModule`, `EssModule`, `TrainingModule`, `OrgChartModule`.

---

## GraphQL API — complete operation list

### Employee
- `findOneEmployee(employee: EmployeeQueryInput)` → Employee
- `employeePage(page: EmployeePageInput)` → EmployeePageResult
- `createEmployee(employee: CreateEmployeeInput)` → Employee
- `inviteEmployee(employee: CreateEmployeeInput)` → Employee
- `updateEmployee(id, employee: UpdateEmployeeInput)` → Employee
- `deleteEmployee(id)` → Boolean

### Department
- `findOneDepartment(department: DepartmentQueryInput)` → Department
- `departmentPage(page: DepartmentPageInput)` → DepartmentPageResult
- `createDepartment` / `updateDepartment` / `deleteDepartment`

### Leave
- `leaveById(id)` → Leave
- `leavePage(page: LeavePageInput)` → LeavePageResult
- `myLeaves(page)` → LeavePageResult
- `myLeaveBalance` → [LeaveBalanceItem]
- `createLeave(leave: CreateLeaveInput)` → Leave
- `cancelLeave(id)` → Leave

### Leave Group
- `findOneLeaveGroup(id)` / `findLeaveGroup(query)` / `leaveGroupPage`
- `createLeaveGroup` / `updateLeaveGroup` / `deleteLeaveGroup`

### Attendance
- `attendancePage(page)` → AttendancePageResult
- `attendanceByDayPage(page)` → AttendanceByDayPageResult
- `clockIn(attendance: CreateAttendanceInput)` → Attendance
- `adminClockIn(input: AdminClockInInput)` → Boolean
- `updateAttendance` / `deleteAttendance`
- `importAttendance(input: AttendanceImportInput)` → AttendanceImportResult

### Shift
- `shiftPage` / `shifts(keyword)` → [Shift]
- `createShift` / `updateShift` / `deleteShift`

### Attendance Group
- `attendanceGroupPage` / `attendanceGroups(keyword)` → [AttendanceGroup]
- `createAttendanceGroup` / `updateAttendanceGroup` / `deleteAttendanceGroup`

### Timesheet
- `timesheetPage` → TimesheetPageResult
- `createTimesheet` / `updateTimesheet` / `deleteTimesheet`
- `submitTimesheets(input: TimesheetIdsInput)` → Boolean
- `approveTimesheets(input: ApproveTimesheetInput)` → Boolean
- `rejectTimesheets(input: RejectTimesheetInput)` → Boolean

### Payroll
- `findPayroll(query)` → Payroll
- `payrollPage(page)` → PayrollPageResult
- `previewPayrollJournal(payrollId)` → PayrollJournalPreview
- `createPayroll` / `updatePayroll` / `deletePayroll`
- `runPayroll(input: RunPayrollInput)` → Boolean
- `approvePayroll(payrollId)` / `rejectPayroll(payrollId)` → Boolean
- `markPayrollAsPaid(payrollId, paymentAccountId)` → Boolean
- `cancelPayroll(payrollId)` → Boolean
- `postPayrollJournal(payrollId, liabilityAccountId)` → Boolean

### Payroll Employee
- `findPayrollEmployee` / `payrollEmployeePage`
- `addPayrollEmployees(input: AddPayrollEmployeesInput)` → Boolean
- `updatePayrollEmployee` / `deletePayrollEmployee` / `deleteAllPayrollEmployees(payrollId)`
- `resyncPayrollEmployeeData(payrollId, fromDate, toDate)` → Boolean

### Payroll Contribution
- `findPayrollContribution` / `payrollContributionPage`
- `createPayrollContribution` / `updatePayrollContribution` / `deletePayrollContribution`

### Contribution Group
- `contributionGroupPage`
- `createContributionGroup` / `updateContributionGroup` / `deleteContributionGroup`

### Payroll Item Settings
- `payrollItemSettingPage`
- `createPayrollItemSetting` / `updatePayrollItemSetting` / `deletePayrollItemSetting`

### Tax Bracket
- `taxBracketPage`
- `createTaxBracket` / `updateTaxBracket` / `deleteTaxBracket`

### Claim
- `claimById` / `claimPage` / `myClaims` / `myClaimSummary(employeeId)` → MyClaimSummary
- `createClaim` / `updateClaim` / `cancelClaim`

### Claim Group
- `findOneClaimGroup` / `claimGroupPage`
- `createClaimGroup` / `updateClaimGroup` / `deleteClaimGroup`

### Advance
- `advanceById` / `advancePage` / `myAdvances` / `myAdvanceSummary(employeeId)` → MyAdvanceSummary
- `createAdvance` / `cancelAdvance`
- `recordAdvanceTransaction(input: CreateAdvanceTransactionInput)` → AdvanceTransaction

### Loan
- `loanById` / `loanPage` / `loanSummary(employeeId)` → LoanSummary
- `createLoan` / `cancelLoan`
- `loanRepayments(loanId)` / `loanRepaymentPage`
- `recordLoanRepayment` / `markRepaymentPaid(id)`

### Approval
- `approvalPage` / `myPendingApprovals` → [Approval] / `findApproval(query)`
- `actionApproval(id, action: ApprovalActionInput)` → Approval

### Calendar
- `calendarPage` / `calendarEvents(fromDate, toDate)` → [Calendar]
- `createCalendar` / `updateCalendar` / `deleteCalendar`

### Training
- `trainingPage` / `trainingById` / `trainingGroupPage` / `trainingGroupById`
- `createTraining` / `updateTraining` / `deleteTraining`
- `addTrainingContentBlock(trainingId, block)` / `removeTrainingContentBlock(trainingId, blockId)`
- `createTrainingGroup` / `updateTrainingGroup` / `deleteTrainingGroup`
- `trainingAssignmentPage` / `createTrainingAssignment` / `updateTrainingAssignment` / `deleteTrainingAssignment`
- `trainingProgressPage` / `recordTrainingCompletion(input)`

### Dashboard
- `headcountMetrics` / `attendanceMetrics` / `timesheetMetrics` / `approvalsMetrics`
- `departmentBreakdown` → [DepartmentMetrics]
- `payrollMetrics` / `dashboardSummary` → HrDashboardSummary

### Org Chart
- `orgChartTree` → [OrgChartDepartmentNode]
- `orgChartSubtree(employeeId)` → OrgChartEmployeeNode
- `orgChartSearch(input)` → [OrgChartEmployeeNode]

### ESS
- `essMe` → EssProfileResult
- `attendanceQrToken` → AttendanceQrResult
- `essSignIn(input)` / `essRefreshToken(input)` → EssAuthResult
- `essSetPin(input)` / `adminSetEmployeePin(input)` → Boolean
- `qrClockIn(token)` → QrClockInResult

---

## Key schema fields

### Employee
```
ref, groupId, userId, reportingTo(self-ref), departmentId, leaveGroupId,
attendanceGroupId, payrollContributionGroupId, payrollItemGroupId, claimGroupId,
calenderId, jobId, categoryId, pin(hidden), idNumber, dateOfBirth, gender,
nationality, maritalStatus, joinDate, confirmDate, resignDate,
employmentType(FULL_TIME|PART_TIME|CONTRACT|INTERN), position, basicSalary,
taxResidencyStatus(RESIDENT|NON_RESIDENT), annualPersonalRelief
```

### Attendance
```
employeeId(req), time(ms timestamp, req), date(start-of-day, req),
kind(CLOCK_IN|CLOCK_OUT), status(REGULAR|LATE|EARLY_LEAVE|OVERTIME),
submitType(QR|LOCATION|DEVICE|MANUAL, default MANUAL), note
```

### Shift
```
name(req), description, repeatMode(Week|Month|Day, default Week),
repeatCycle(default 1)
```

### Attendance Group
```
name(req), shiftId, locationClockinEnabled, qrClockinEnabled,
checkInNotRequired, checkOutNotRequired, workingHoursPerDay(default 8),
workingDaysPerMonth(default 30)
```

### Timesheet
```
employeeId(req), date(start-of-day, req), regularHours(default 0),
overtimeHours(default 0), description, status(DRAFT|SUBMITTED|APPROVED|REJECTED),
approverId, approvedById, approvedAt, rejectionReason
```

### Payroll
```
name(req), payDate(req), fromDate, toDate,
status(DRAFT|PENDING_APPROVAL|APPROVED|PAID|CANCELLED),
totalGrossSalary, totalNetSalary, totalEmployeeContributions,
totalEmployerContributions, totalEmployerCost, totalTaxDeduction,
calculatedAt, paymentAccountId, journalEntryId, journalLiabilityAccountId
```

### Payroll Employee
```
employeeId(req), payrollId(req), salary(req),
totalClaimAmount, totalUnpaidLeaveAmount, totalOvertimeAmount, totalAbsenceDeductionAmount,
claimIds[], leaveIds[], grossSalary, totalDeductions, netSalary, employerCost,
taxDeduction, taxRelief, totalAllowances, isCalculated(default false),
taxYear, ytdTaxDeducted
```

### Payroll Contribution
```
payrollId(req), employeeId(req), statutoryTypeId,
paidBy(EMPLOYEE|EMPLOYER|BOTH, req), contributionKind,
employeePaymentAmount(default 0), employerPaymentAmount(default 0)
```

### Payroll Contribution Group
```
name(req),
types[]: { statutoryTypeId, accountId, paidBy,
  employeePayment: { mandatory, voluntary, valueType(PERCENTAGE|FIXED) },
  employerPayment: { mandatory, voluntary, valueType } }
```

### Payroll Item Setting
```
name(req), statutoryTypes[], type(ALLOWANCE|DEDUCTION|OVERTIME|TAX_EXEMPTION),
accountId, isBasicSalary(default false), isTaxable(default false),
taxReliefType(AMOUNT|PERCENTAGE), taxRelief(default 0), maxTaxRelief(default 0),
frequency(MONTHLY|ANNUALLY, default MONTHLY)
```

### Tax Bracket
```
taxYear(req), name(req), countryId,
bands[]: { minAmount, maxAmount, baseTax, ratePercentage },
statutoryReliefs[]: { statutoryTypeId, annualLimit },
nonResidentFlatRate(default 0)
```

### Leave
```
employeeId(req), leaveTypeId(req), leaveGroupId, approvalId,
status(PENDING|APPROVED|REJECTED|CANCELLED),
fromDate(req), toDate(req), duration, isHalfDay, isPaid,
reasonForLeave, files[]
```

### Leave Group
```
name(req), types[]: { leaveTypeId, numberOfDays }
```

### Claim
```
employeeId(req), companyId, approverId, approvalId, amount(req),
description(req), claimDate(req), attachments[], note,
status(PENDING|APPROVED|REJECTED|CANCELLED)
```

### Claim Group
```
name(req), types[]: { claimTypeId, limit }
```

### Advance
```
employeeId(req), companyId, approverId, approvalId, amount(req),
purpose(req), attachments[], status(PENDING|APPROVED|REJECTED|CANCELLED)
```

### Advance Transaction
```
advanceId(req), employeeId, companyId, amount(req), date(req),
description, attachments[], type(DISBURSEMENT|REPAYMENT, default REPAYMENT)
```

### Loan
```
employeeId(req), companyId, approverId, approvalId, amount(req),
purpose(req), attachments[], numberOfInstallments(req),
installmentAmount(req), startDate(req), remainingBalance(default 0),
status(PENDING|APPROVED|REJECTED|CANCELLED)
```

### Loan Repayment
```
loanId(req), companyId, employeeId, installmentNumber(req), amount(req),
dueDate(req), paidDate, note, attachments[],
status(PENDING|PAID|OVERDUE)
```

### Approval
```
approverId(req), requesterId, refId(req),
status(PENDING|APPROVED|REJECTED|CANCELLED),
kind(LEAVE|CLAIM|ADVANCE|LOAN, req), remark
```

### Calendar
```
title(req), date(req), isHoliday(default false)
```

### Training
```
name(req), description(req), trainingGroupId,
contentBlocks[]: { id, type(DOCUMENT|VIDEO|QUIZ|EXTERNAL_LINK|TEXT),
  title, order, content(object), isRequired, duration },
completionRequirement(VIEW_ONLY|TIMED_VIEW|QUIZ_BASED|COMBINATION|EXTERNAL),
quizPassingScore, timedViewMinutes, certificateTemplate, isActive(default true)
```

### Training Assignment
```
trainingId(req, indexed), employeeIds[], departmentIds[], employmentTypes[],
jobIds[], assignAll(default false), deadline(req, indexed),
requiresManagerApproval(default false), reminderSchedule[],
isActive(default true), notificationStatuses[](default ["ASSIGNED","IN_PROGRESS"]),
createdBy
```

---

## Key relationships

```
Employee (central hub)
 ├── Department
 ├── LeaveGroup → Leave
 ├── AttendanceGroup → Shift
 ├── PayrollContributionGroup → PayrollContribution
 ├── PayrollItemGroup → PayrollEmployee items
 ├── ClaimGroup → Claim
 ├── Calendar
 └── reportingTo (self-ref → OrgChart)

Payroll
 ├── PayrollEmployee (1:M) → [Claims, Leaves referenced]
 ├── PayrollContribution (1:M)
 └── postPayrollJournal → Finance module (journalEntryId, paymentAccountId)

Leave / Claim / Advance / Loan
 └── all reference Approval (kind discriminator)

Training
 ├── TrainingAssignment (1:M) → targets Employees/Departments/Jobs
 └── TrainingProgress (1:M) → per-employee completion

Dashboard & OrgChart → read-only aggregations across modules
ESS → public PIN-protected view of Employee + Attendance
```

---

## System-wide patterns in HR

1. **Soft deletes** — all collections use `mongoose-delete` (`deletedAt`, `deletedBy`)
2. **BaseSchema** — all docs extend it: `companyId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `ref` (12-char public ID)
3. **Unified approval pattern** — Leave/Claim/Advance/Loan store `approverId` + `approvalId`; `Approval` is source of truth with `ApprovalKind` discriminator
4. **Denormalization** — request entities duplicate `approverId` for lookup speed
5. **Aggregation pagination** — `page()` + `handlePageFacet()` + `handlePageResult()` from `AbstractBaseRepository`
6. **No business logic in resolvers** — strictly Service layer
7. **No raw Mongoose outside repositories**
8. **Multi-tenant** — always `contextSvc.companyId` / `contextSvc.branchId`; never hardcode

---

## Database collections index

`employees`, `departments`, `leaves`, `leave_groups`, `attendances`, `shifts`, `attendance_groups`, `timetables`, `hr_timesheets`, `payroll`, `payroll_employee`, `payroll_contribution`, `payroll_contribution_groups`, `payroll_item_groups`, `payroll_item_settings`, `payroll_tax_brackets`, `employee_salaries`, `claims`, `claim_groups`, `claim_types`, `advances`, `advance_transactions`, `loans`, `loan_repayments`, `approvals`, `calendars`, `trainings`, `training_groups`, `training_assignments`, `training_progress`, `training_certificates`
