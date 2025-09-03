import { API_CONFIG } from '../config/apiConfig';

/**
 * Employer Request Service for new workflow
 */
class EmployerRequestService {
  /**
   * Request full details for a candidate
   * @param {number} requestId - Employer request ID
   * @param {string} reason - Optional reason for requesting full details
   */
  static async requestFullDetails(requestId, reason = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/employer/requests/${requestId}/request-full-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error requesting full details:', error);
      throw error;
    }
  }

  /**
   * Mark hiring decision
   * @param {number} requestId - Employer request ID
   * @param {string} decision - 'hired' or 'not_hired'
   * @param {string} notes - Optional notes
   */
  static async markHiringDecision(requestId, decision, notes = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/employer/requests/${requestId}/mark-${decision}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ decision, notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error marking hiring decision:', error);
      throw error;
    }
  }

  /**
   * Get photo access for candidate
   * @param {number} requestId - Employer request ID
   */
  static async getPhotoAccess(requestId) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/employer/requests/${requestId}/photo-access`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting photo access:', error);
      throw error;
    }
  }

  /**
   * Get full details for candidate
   * @param {number} requestId - Employer request ID
   */
  static async getFullDetails(requestId) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/employer/requests/${requestId}/full-details`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting full details:', error);
      throw error;
    }
  }
}

export default EmployerRequestService;