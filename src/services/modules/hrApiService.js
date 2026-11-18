/** Re-export live HR employees API (single source under services/api). */
export {
  mapEmployeeOutToUi,
  mapPortalEmployeeToUi,
  splitFullName,
  uiFormToEmployeeCreate,
  uiFormToPortalRow,
  listEmployees,
  listPortalEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
} from '../api/hrApiService.js'
