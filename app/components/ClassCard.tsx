'use client';

import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface ClassCardProps {
  name: string;
  courseCode?: string;
  index: number;
}

export default function ClassCard({ name, courseCode, index }: ClassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#002E5D]/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-[#002E5D]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#002E5D] text-lg">{name}</h3>
            {courseCode && (
              <p className="text-sm text-gray-500 mt-1">{courseCode}</p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500 mb-1">Next Deadline</p>
        <p className="text-gray-400 text-sm italic">No upcoming deadlines</p>
      </div>
    </motion.div>
  );
}
