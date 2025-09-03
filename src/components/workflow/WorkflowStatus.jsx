import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle, User, CreditCard, Eye, FileText, UserCheck } from 'lucide-react';

const WorkflowStatus = ({ status, className = '' }) => {
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: 'Pending Review',
          description: 'Request is waiting for admin approval'
        };
      case 'approved':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Approved',
          description: 'Request approved, payment required'
        };
      case 'first_payment_required':
        return {
          icon: <CreditCard className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: 'First Payment Required',
          description: 'Pay 5,000 RWF for photo access'
        };
      case 'first_payment_confirmed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: 'Payment Confirmed',
          description: 'Waiting for admin approval'
        };
      case 'photo_access_granted':
        return {
          icon: <Eye className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Photo Access Granted',
          description: 'You can view candidate photo'
        };
      case 'full_details_requested':
        return {
          icon: <FileText className="w-5 h-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          label: 'Full Details Requested',
          description: 'Waiting for admin approval'
        };
      case 'second_payment_required':
        return {
          icon: <CreditCard className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: 'Second Payment Required',
          description: 'Pay for full details access'
        };
      case 'second_payment_confirmed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: 'Second Payment Confirmed',
          description: 'Waiting for admin approval'
        };
      case 'full_access_granted':
        return {
          icon: <FileText className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Full Access Granted',
          description: 'You can view all candidate details'
        };
      case 'hiring_decision_made':
        return {
          icon: <UserCheck className="w-5 h-5" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          label: 'Hiring Decision Made',
          description: 'Waiting for admin to update availability'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Completed',
          description: 'Request completed successfully'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-5 h-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          label: 'Cancelled',
          description: 'Request was cancelled'
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: 'Unknown Status',
          description: 'Status not recognized'
        };
    }
  };

  const statusInfo = getStatusInfo(status);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color} ${className}`}>
      {statusInfo.icon}
      <span>{statusInfo.label}</span>
    </div>
  );
};

export default WorkflowStatus;