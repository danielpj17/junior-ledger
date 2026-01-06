'use client';

import { useState, useEffect } from 'react';

export default function DaysUntilExam() {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);

  useEffect(() => {
    // Set exam date to a future date (e.g., end of semester)
    // You can customize this date
    const examDate = new Date('2024-12-15');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    setDaysUntil(Math.max(0, diffDays));
  }, []);

  if (daysUntil === null) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#002E5D] to-[#004080] text-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Days Until Exam</h2>
          <p className="text-white/80 text-sm">Final exams approaching</p>
        </div>
        <div className="text-6xl font-bold text-[#FFD700]">
          {daysUntil}
        </div>
      </div>
    </div>
  );
}
