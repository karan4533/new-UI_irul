/** Re-export live announcements API (single source under services/api). */
export {
  BACKEND_ANNOUNCEMENT_CATEGORIES,
  mapApiAnnouncement,
  listAnnouncements,
  getAnnouncement,
  listAnnouncementCategories,
  createAnnouncement,
  acknowledgeAnnouncement,
  replyToAnnouncement,
} from '../api/announcementApiService.js'
