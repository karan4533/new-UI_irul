/**
 * Master Services Barrel Export
 * Central entry point for all API abstraction, mock adapter, domain services, and models.
 */

// API Infrastructure
export { apiClient } from './api/apiClient.js';
export { mockAdapter } from './api/mockAdapter.js';
export {
  createSuccessResponse,
  createErrorResponse,
  isApiResponse,
  paginateResults,
} from './api/responseEnvelope.js';
export {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  isLiveApiEnabled,
} from './api/tokenStore.js';
export {
  loginWithBackend,
  logoutFromBackend,
  fetchCurrentUser,
  checkBackendHealth,
  BACKEND_SEED_DIRECTORY,
} from './api/authService.js';
export {
  BACKEND_ANNOUNCEMENT_CATEGORIES,
  mapApiAnnouncement,
  listAnnouncements,
  getAnnouncement,
  listAnnouncementCategories,
  createAnnouncement,
  acknowledgeAnnouncement,
  replyToAnnouncement,
} from './api/announcementApiService.js';
export {
  listEmployees,
  listPortalEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  mapEmployeeOutToUi,
  mapPortalEmployeeToUi,
  HR_COLLECTIONS,
  listHrCollection,
  replaceHrCollection,
  createHrItem,
  patchHrItem,
  getHrLeaveBundle,
  saveHrLeaveBundle,
  getHrPayrollBundle,
  saveHrPayrollBundle,
} from './api/hrApiService.js';
export {
  listAdminUsers,
  getAdminUser,
  listCreatableRoles,
  createAdminUserApi,
  updateAdminUserApi,
  resetAdminUserPassword,
  mapAdminUserToUi,
  uiFormToUserCreate,
} from './api/adminUsersApiService.js';
export {
  listStudents,
  getStudent,
  mapStudentToUi,
} from './api/studentApiService.js';
export { getAdminDashboard } from './api/adminDashboardApiService.js';
export {
  listAdmissionEnquiries,
  getAdmissionEnquiry,
  createAdmissionEnquiry,
  updateAdmissionEnquiry,
  listAdmissions,
  getAdmission,
  mapEnquiryToUi,
  mapAdmissionToUi,
} from './api/admissionsApiService.js';
export {
  listLeaveRequests,
  getLeaveRequest,
  decideLeaveRequest,
  mapLeaveRequestToUi,
} from './api/leaveApiService.js';
export {
  listAttendance,
  upsertAttendance,
  mapAttendanceRowToUi,
} from './api/attendanceApiService.js';
export {
  listLessonPlans,
  createLessonPlan,
} from './api/lessonPlanApiService.js';
export {
  getFinanceState,
  saveFinanceStateApi,
  resetFinanceStateApi,
  listFinanceCollection,
  collectPaymentApi,
  settleChequeApi,
  sendReceiptApi,
  decideFinanceApprovalApi,
  applyHrConcessionsApi,
  createGatewayIntentApi,
} from './api/financeApiService.js';
export {
  listTcRequests,
  getTcRequest,
  decideTcRequest,
  mapTcRequestToUi,
} from './api/tcApiService.js';
export {
  listLibraryBooks,
  replaceLibraryBooks,
  listLibraryIssues,
  replaceLibraryIssues,
  listLibraryMembers,
  replaceLibraryMembers,
  loadLibraryWorkspace,
  mapBookToUi,
  mapIssueToUi,
  mapMemberToUi,
} from './api/libraryApiService.js';
export {
  listPendingPlacement,
  getMyGradeBand,
  getPlacementOptions,
  placeStudent,
  listPlacedForBand,
  getPromoteOptions,
  promoteStudent,
} from './api/studentApiService.js';

// Domain Models & Validation
export {
  CONFIDENTIALITY_TIERS,
  FILE_STATUS,
  CCTV_CAMERA_STATUS,
  CCTV_APPROVAL_TIER,
  REFUND_STATUS,
  PO_STATUS,
  CBSE_GRADE_SCALE,
  validateRequired,
  isValidDate,
  isNonNegativeNumber,
  isValidEmail,
  isValidEnum,
  createStorageLocation,
  generateUniqueId,
  computeGrade,
  calculateGst,
} from './models/index.js';

// Seed Data
export * from './data/seedData.js';

// Domain Services
export { proService } from './modules/proService.js';
export { fileRoomService } from './modules/fileRoomService.js';
export { cctvService } from './modules/cctvService.js';
export { hostelService } from './modules/hostelService.js';
export { feeService } from './modules/feeService.js';
export { academicService } from './modules/academicService.js';
export { purchaseService } from './modules/purchaseService.js';
export { inventoryService } from './modules/inventoryService.js';
export { lostFoundService } from './modules/lostFoundService.js';
export { awardsService } from './modules/awardsService.js';
export { transportService } from './modules/transportService.js';
