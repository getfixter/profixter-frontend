'use client';

import React from 'react';

interface BookingStatusSelectProps {
  bookingId: string;
  currentStatus: string;
  onUpdate: (bookingId: string, status: string) => Promise<void>;
}

const statusConfig = {
  Pending: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: '⏳',
    label: 'Pending',
  },
  Confirmed: {
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: '✓',
    label: 'Confirmed',
  },
  Completed: {
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '✔',
    label: 'Completed',
  },
  Canceled: {
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: '✕',
    label: 'Canceled',
  },
};

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  onUpdate,
}: BookingStatusSelectProps) {
  const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.Pending;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    try {
      await onUpdate(bookingId, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="status-select-wrapper">
      <div className={`status-indicator ${config.color}`}>
        <span className="status-icon">{config.icon}</span>
        <span className="status-label">{config.label}</span>
      </div>
      <select
        className={`status-select ${config.color}`}
        value={currentStatus}
        onChange={handleChange}
      >
        <option value="Pending">⏳ Pending</option>
        <option value="Confirmed">✓ Confirmed</option>
        <option value="Completed">✔ Completed</option>
        <option value="Canceled">✕ Canceled</option>
      </select>

      <style jsx>{`
        .status-select-wrapper {
          position: relative;
          min-width: 140px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid;
          font-weight: 600;
          font-size: 0.875rem;
          pointer-events: none;
        }

        .status-icon {
          font-size: 1rem;
        }

        .status-label {
          flex: 1;
        }

        .status-select {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          border-radius: 8px;
          border: 1px solid;
          padding: 8px 12px;
        }

        .status-select:hover + .status-indicator,
        .status-select:focus + .status-indicator {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .status-select option {
          background: white;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
}
