// Shared types mirroring the backend's Prisma models & API response shapes.
// Kept intentionally close to the DB field names (camelCase) so a value
// can be passed between API calls without remapping.

export type UserRole = 'ADMIN' | 'MANAGEMENT' | 'FINANCE' | 'OT_COORDINATOR' | 'SURGEON' | 'ANAESTHETIST' | 'OT_NURSE' | 'OT_TECHNICIAN' | 'OT_STORE' | 'VIEWER';

export type SurgeryStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'SENT_FOR_BUDGET_APPROVAL'
  | 'BUDGET_APPROVED'
  | 'REVISE_BUDGET'
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'POSTPONED'
  | 'SURGERY_COMPLETED'
  | 'PARTIALLY_RECONCILED'
  | 'FULLY_RECONCILED'
  | 'CLOSED'
  | 'CANCELLED'
  // Legacy (backward compat with existing data)
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELETED';

export interface BloodGroupOption {
  bloodGroupId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export type AlertSeverity = 'GREEN' | 'YELLOW' | 'RED';

export type AlertType =
  | 'SURGEON_FEE_HIGH'
  | 'ASSISTANT_COST_HIGH'
  | 'OT_DURATION_LONG'
  | 'OT_COST_HIGH'
  | 'CONSUMABLES_HIGH'
  | 'MARGIN_BELOW_TARGET'
  | 'QUOTE_TOO_LOW'
  | 'NEGATIVE_PROFIT'
  | 'BUDGET_EXCEEDED'
  | 'ACTUAL_COST_MISSING'
  | 'COLLECTION_PENDING';

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface User {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string | null;
  permissions?: string[];
}

export interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  city?: string | null;
  isActive: boolean;
}

export interface Department {
  departmentId: string;
  branchId: string;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
}

export interface Surgeon {
  surgeonId: string;
  branchId: string;
  departmentId?: string | null;
  employeeCode?: string | null;
  fullName: string;
  specialization?: string | null;
  isActive: boolean;
}

export interface Anaesthetist {
  anaesthetistId: string;
  branchId: string;
  fullName: string;
  employeeCode?: string | null;
  isActive: boolean;
}

export interface Assistant {
  assistantId: string;
  branchId: string;
  fullName: string;
  employeeCode?: string | null;
  roleTitle?: string | null;
  isActive: boolean;
}

export interface SurgeryType {
  surgeryTypeId: string;
  departmentId?: string | null;
  code: string;
  name: string;
  packageName?: string | null;
  specialty?: string | null;
  indicativePackageAmount?: number | null;
  typicalOtType?: 'Major' | 'Minor' | 'Cath Lab' | null;
  standardDurationMinutes?: number | null;
  defaultDurationMin?: number | null;
  isActive: boolean;
}

export interface OtRoom {
  otRoomId: string;
  branchId: string;
  roomCode: string;
  roomName: string;
  costPerMinute: number;
  roomType?: 'Major' | 'Minor' | 'Cath Lab' | null;
  turnaroundMin?: number;
  otStatus?: 'AVAILABLE' | 'IN_USE' | 'UNDER_FUMIGATION' | 'AWAITING_CLEARANCE' | 'MAINTENANCE';
  location?: string | null;
  isActive: boolean;
}

export interface Staff {
  staffId: string;
  branchId?: string | null;
  name: string;
  staffType: 'Surgeon' | 'Anaesthetist' | 'Assistant' | 'Technician' | 'Nurse' | 'Visiting Specialist' | 'Other';
  employeeCode?: string | null;
  qualification?: string | null;
  registrationNo?: string | null;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  isExternal?: boolean;
  legacySurgeonId?: string | null;
  legacyAnaesthetistId?: string | null;
  legacyAssistantId?: string | null;
  isActive: boolean;
}

export interface Patient {
  patientId: string;
  branchId: string;
  mrNumber: string;
  fullName: string;
  dateOfBirth?: string | null;
  gender: Gender;
  phone?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface AppUser {
  userId: string;
  branchId?: string | null;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface Surgery {
  surgeryId: string;
  branchId: string;
  departmentId?: string | null;
  patientId: string;
  surgeonId: string;
  anaesthetistId?: string | null;
  surgeryTypeId: string;
  otRoomId?: string | null;
  status: SurgeryStatus;

  patientAgeYears?: number | null;
  patientGender?: Gender | null;
  anaesthesiaType?: string | null;

  scheduledDate?: string | null;
  surgeryDate?: string | null;
  durationMinutes?: number | null;

  budgetSurgeonFee: number;
  budgetAssistantCost: number;
  budgetAnaesthetistFee: number;
  budgetOtCost: number;
  budgetConsumables: number;
  budgetPharmacy: number;
  budgetMiscellaneous: number;
  budgetTotal: number;

  actualSurgeonFee?: number | null;
  actualAssistantCost?: number | null;
  actualAnaesthetistFee?: number | null;
  actualOtCost?: number | null;
  actualConsumables?: number | null;
  actualPharmacy?: number | null;
  actualMiscellaneous?: number | null;
  actualTotal?: number | null;

  quotedPrice?: number | null;
  collectedAmount: number;
  profitAmount?: number | null;

  surgeryNumber?: string | null;
  ipOp?: 'IP' | 'OP' | null;
  admissionNumber?: string | null;
  diagnosis?: string | null;
  plannedProcedure?: string | null;
  sideSite?: string | null;
  clinicalNotes?: string | null;
  planDate?: string | null;
  cancelReason?: string | null;
  comments?: string | null;
  asaGrade?: number | null;
  asaEmergency?: boolean;
  comorbidities?: string | null;
  pacDate?: string | null;
  pacByStaffId?: string | null;
  fitnessRemark?: string | null;
  specialPrecautions?: string | null;
  plannedOtType?: 'Major' | 'Minor' | 'Cath Lab' | null;
  payerType?: 'SELF' | 'INSURANCE' | 'SCHEME' | 'CORPORATE';
  payerName?: string | null;
  payerReference?: string | null;
  preauthAmount?: number | null;
  hisUhid?: string | null;
  warnings?: string[];

  isOutlier: boolean;
  budgetLocked?: boolean;

  // OT Schedule fields (readonly, fetched from surgery_schedules)
  otScheduleId?: string | null;
  otPlannedStartTime?: string | null;
  otExpectedDurationMin?: number | null;
  otPlannedDate?: string | null;
  otPlannedEndTime?: string | null;
  otScheduleStatus?: string | null;
  otScheduleRoom?: OtRoom | null;

  patient?: Patient;
  surgeon?: Surgeon;
  anaesthetist?: Anaesthetist;
  surgeryType?: SurgeryType;
  department?: Department;
  otRoom?: OtRoom;
  assistants?: Array<{ assistantId: string; feeAmount: number; assistant?: Assistant }>;
  consumables?: Array<{ itemId: string; quantity: number; unitCost: number; totalCost: number; item?: { itemName: string } }>;
  pharmacy?: Array<{ pharmacyItemId: string; quantity: number; unitCost: number; totalCost: number }>;
}

export interface ComponentStats {
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
  sampleSize: number;
}

export interface RecommendationResult {
  sampleSize: number;
  outliersExcluded: boolean;
  outlierCount: number;
  warning?: string;
  components?: {
    surgeonFee: ComponentStats & { lastFee: number | null; avgProfit: number | null; avgMarginPct: number | null; avgDurationMinutes: number | null; recommendedFee: number | null };
    assistant: ComponentStats & { avgAssistantCount: number | null; avgCostPerAssistant: number | null; recommendedBudget: number | null };
    anaesthetist: ComponentStats & { mostFrequentAnaesthetist: { name: string; count: number } | null; avgFeeByAnaesthesiaType: Record<string, number | null>; recommendedBudget: number | null };
    ot: { expectedDurationMinutes: number | null; durationStats: ComponentStats; costStats: ComponentStats; avgCostPerMinute: number | null; recommendedBudget: number | null };
    consumables: ComponentStats & { topCostDrivers: Array<{ itemName: string; totalCost: number }>; recommendedBudget: number | null };
    pharmacy: ComponentStats & { recommendedBudget: number | null };
    miscellaneous: ComponentStats & { recommendedBudget: number | null };
  };
  overall?: {
    recommendedSurgeonFee: number | null;
    recommendedAssistantBudget: number | null;
    recommendedAnaesthetistBudget: number | null;
    recommendedOTBudget: number | null;
    recommendedOTDurationMinutes: number | null;
    recommendedConsumables: number | null;
    recommendedPharmacy: number | null;
    recommendedMiscellaneous: number | null;
    recommendedTotalCost: number | null;
    recommendedMarginPct: number | null;
    recommendedPatientQuote: number | null;
    recommendedProfit: number | null;
    recommendedProfitPct: number | null;
    recommendedCollectionTarget: number | null;
  };
  last10SimilarSurgeries?: SimilarSurgeryRow[];
  recommendationId?: string;
  surgeryId?: string;
}

export interface SimilarSurgeryRow {
  surgeryId: string;
  similarityScore: number;
  surgeryDate: string;
  mrNumber: string;
  patientName: string;
  patientAgeYears?: number;
  patientGender?: Gender;
  surgeonName: string;
  surgeryTypeName: string;
  anaesthetistName?: string;
  durationMinutes?: number;
  surgeonFee: number;
  assistantCost: number;
  otCost: number;
  consumablesCost: number;
  miscCost: number;
  actualTotal: number;
  quotedPrice: number;
  collectedAmount: number;
  profit: number;
  marginPct: number;
}

export interface SurgeryAlert {
  alertId: string;
  surgeryId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metricValue?: number | null;
  thresholdValue?: number | null;
  isAcknowledged: boolean;
  createdAt: string;
  surgery?: {
    patient?: Patient;
    surgeon?: Surgeon;
    surgeryType?: SurgeryType;
  };
}

export interface AlertThreshold {
  thresholdId: string;
  branchId: string | null;
  alertType: AlertType;
  yellowThresholdPct: number;
  redThresholdPct: number;
  isActive: boolean;
}

export interface SurgeonBenchmarkRow {
  surgeon_id: string;
  surgeon_name: string;
  surgery_type_id: string;
  surgery_type_name: string;
  case_count: number;
  avg_fee: number;
  median_fee: number;
  min_fee: number;
  max_fee: number;
  stddev_fee: number;
  avg_profit: number;
  avg_margin_pct: number;
  avg_duration_minutes: number;
  last_surgery_date: string;
}

export interface DashboardSummary {
  monthlyTrend: Array<{
    month: string;
    case_count: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    avg_margin_pct: number;
    total_collected: number;
  }>;
  kpis: {
    caseCount: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalCollected: number;
    overallMarginPct: number | null;
    pendingCollection: number;
  };
}

// ── Pre-Op Checklist Template ─────────────────────────────────────────────────

export interface PreOpChecklistItem {
  itemId: string;
  templateId: string;
  checklistItem: string;
  sortOrder: number;
}

export interface PreOpChecklistTemplate {
  templateId: string;
  procedureId: string;
  procedureName: string;
  procedureCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: PreOpChecklistItem[];
}

export interface SurgeryPreOpChecklist {
  surgeryId: string;
  procedureId: string;
  template: PreOpChecklistTemplate | null;
  items: PreOpChecklistItem[];
  message?: string;
}

// ── Surgery Checklist (snapshot) ─────────────────────────────────────────────

export type ChecklistItemStatus = 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE';

export interface SurgeryChecklistItem {
  checklistId: string;
  surgeryId: string;
  templateItemId: string;
  itemLabel: string;
  sortOrder: number;
  status: ChecklistItemStatus;
  completedByName?: string | null;
  completedAt?: string | null;
  remarks?: string | null;
}

// ── Surgery Documents ─────────────────────────────────────────────────────────

export type DocumentType = 'CONSENT_FORM' | 'PAC_REPORT' | 'INVESTIGATION_REPORT' | 'OTHER';

export interface SurgeryDocument {
  documentId: string;
  surgeryId: string;
  documentType: DocumentType;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  notes?: string | null;
  uploadedAt: string;
  uploadedByName?: string | null;
}

export interface ForecastResult {
  metric: string;
  historical: Array<{ month: string; value: number }>;
  trend: { slope: number; intercept: number; direction: 'UP' | 'DOWN' | 'FLAT'; r2: number } | null;
  forecast: Array<{ periodsAhead: number; projectedValue: number }>;
}

export interface SurgeryActualTeamMember {
  id: string;
  surgeryId: string;
  teamRole: 'PRIMARY_SURGEON' | 'CO_SURGEON' | 'ASSISTANT' | 'ANAESTHETIST' | 'OT_ASSISTANT' | 'OTHER';
  staffId: string;
  staffName?: string | null;
  staffType?: string | null;
}

export interface SurgeryTimelineEvent {
  eventId: string;
  surgeryId: string;
  eventType: string;
  eventDatetime: string;
  recordedBy?: string | null;
  recordedByName?: string | null;
  remarks?: string | null;
}

export interface SurgeryActuals {
  surgery: {
    surgeryId: string;
    surgeryNumber?: string | null;
    status: string;
    patientName?: string | null;
    mrNumber?: string | null;
    surgeryDate?: string | null;
    plannedDate?: string | null;
    plannedStartTime?: string | null;
    expectedDurationMin?: number | null;
    otRoomId?: string | null;
    roomName?: string | null;
    roomCode?: string | null;
  };
  actual: {
    actualId: string;
    actualSurgeryDate?: string | null;
    otRoomId?: string | null;
    actualStartTime?: string | null;
    procedurePerformedText?: string | null;
    procedureModifiedFlag: boolean;
    additionalProcedureText?: string | null;
    emergencyUnplannedFlag: boolean;
    anaesthesiaType?: string | null;
    complications?: string | null;
    equipmentUsed?: string | null;
    implantsUsed?: string | null;
    suturesUsed?: string | null;
    staplersStaplesUsed?: string | null;
    otherMaterialsUsed?: string | null;
    specialInstructions?: string | null;
    postOpInstructions?: string | null;
    remarks?: string | null;
  } | null;
  team: SurgeryActualTeamMember[];
  events: SurgeryTimelineEvent[];
  actualDurationMinutes: number | null;
}
