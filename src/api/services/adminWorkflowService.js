import { API_CONFIG } from '../config/apiConfig';

/**
 * Admin Workflow Service for new workflow management
 */
class AdminWorkflowService {
  /**
   * Approve employer request
   * @param {number} requestId - Employer request ID
   * @param {string} notes - Optional notes
   */
  static async approveEmployerRequest(requestId, notes = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/employer-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error approving employer request:', error);
      throw error;
    }
  }

  /**
   * Reject employer request
   * @param {number} requestId - Employer request ID
   * @param {string} reason - Rejection reason
   */
  static async rejectEmployerRequest(requestId, reason = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/employer-requests/${requestId}/reject`, {
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
      console.error('Error rejecting employer request:', error);
      throw error;
    }
  }

  /**
   * Approve payment
   * @param {number} paymentId - Payment ID
   * @param {string} notes - Optional notes
   */
  static async approvePayment(paymentId, notes = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error approving payment:', error);
      throw error;
    }
  }

  /**
   * Reject payment
   * @param {number} paymentId - Payment ID
   * @param {string} reason - Rejection reason
   */
  static async rejectPayment(paymentId, reason = '') {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/payments/${paymentId}/reject`, {
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
      console.error('Error rejecting payment:', error);
      throw error;
    }
  }

  /**
   * Request second payment (admin initiated)
   * @param {number} requestId - Employer request ID
   * @param {number} amount - Payment amount
   */
  static async requestSecondPayment(requestId, amount) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/employer-requests/${requestId}/request-second-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ amount })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error requesting second payment:', error);
      throw error;
    }
  }

  /**
   * Approve/Reject full details request from employer
   * @param {number} requestId - Employer request ID
   * @param {string} action - 'approve' or 'reject'
   * @param {number} amount - Payment amount (if approving)
   * @param {string} notes - Notes (if rejecting)
   */
  static async approveFullDetailsRequest(requestId, action, amount = null, notes = '') {
    try {
      const body = { action };
      if (action === 'approve' && amount) {
        body.amount = amount;
      } else if (action === 'reject' && notes) {
        body.notes = notes;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/employer-requests/${requestId}/approve-full-details-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error processing full details request:', error);
      throw error;
    }
  }

  /**
   * Update candidate availability after hiring decision
   * @param {number} requestId - Employer request ID
   * @param {string} action - 'mark_unavailable' or 'keep_available'
   */
  static async updateCandidateAvailability(requestId, action) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/employer-requests/${requestId}/update-candidate-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.AUTH_CONFIG.tokenKey)}`
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating candidate availability:', error);
      throw error;
    }
  }
}

export default AdminWorkflowService;