import React from 'react';
import { CheckCircle, Clock, Circle, User, CreditCard, Eye, FileText, UserCheck, XCircle } from 'lucide-react';

const WorkflowProgress = ({ currentStatus, className = '' }) => {
  const steps = [
    {
      id: 'pending',
      label: 'Request Submitted',
      icon: <User className="w-5 h-5" />,
      description: 'Request submitted and waiting for admin review'
    },
    {
      id: 'approved',
      label: 'Request Approved',
      icon: <CheckCircle className="w-5 h-5" />,
      description: 'Admin approved the request'
    },
    {
      id: 'first_payment_required',
      label: 'First Payment',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Pay 5,000 RWF for photo access'
    },
    {
      id: 'photo_access_granted',
      label: 'Photo Access',
      icon: <Eye className="w-5 h-5" />,
      description: 'View candidate photo and basic info'
    },
    {
      id: 'second_payment_required',
      label: 'Second Payment',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Pay for full details access'
    },
    {
      id: 'full_access_granted',
      label: 'Full Access',
      icon: <FileText className="w-5 h-5" />,
      description: 'View all candidate details'
    },
    {
      id: 'hiring_decision_made',
      label: 'Hiring Decision',
      icon: <UserCheck className="w-5 h-5" />,
      description: 'Mark candidate as hired or not hired'
    },
    {
      id: 'completed',
      label: 'Completed',
      icon: <CheckCircle className="w-5 h-5" />,
      description: 'Request completed successfully'
    }
  ];

  const getStepStatus = (stepId) => {
    const statusOrder = [
      'pending', 'approved', 'first_payment_required', 'first_payment_confirmed',
      'photo_access_granted', 'full_details_requested', 'second_payment_required',
      'second_payment_confirmed', 'full_access_granted', 'hiring_decision_made', 'completed'
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepId);

    if (currentIndex === -1 || stepIndex === -1) return 'pending';

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const getStepIcon = (step, status) => {
    if (status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (status === 'current') {
      return <Clock className="w-5 h-5 text-blue-600" />;
    } else {
      return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'current':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Progress</h3>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-start gap-4">
              {/* Step Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${getStepColor(status)}`}>
                {getStepIcon(step, status)}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-medium ${status === 'current' ? 'text-blue-900' : status === 'completed' ? 'text-green-900' : 'text-gray-500'}`}>
                    {step.label}
                  </h4>
                  {status === 'current' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Current
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${status === 'current' ? 'text-blue-700' : status === 'completed' ? 'text-green-700' : 'text-gray-400'}`}>
                  {step.description}
                </p>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className="absolute left-5 top-10 w-0.5 h-8 bg-gray-200"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowProgress;