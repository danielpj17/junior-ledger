'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit2, Save, X, Calendar, FileText, Loader2, AlertCircle, EyeOff, Trash2, Folder, ExternalLink, File } from 'lucide-react';
import { fetchCourseAssignments, fetchCourseFiles, fetchCourseFolders, fetchFolderFiles, testFolderAccess, CanvasFile, CanvasFolder } from '../../actions/canvas';
import { getCanvasToken, getAutoRefreshInterval } from '../../lib/courseStorage';
import { useCourses } from '../../components/CoursesProvider';
import { motion, AnimatePresence } from 'framer-motion';
import JuniorAssistant from '../../components/JuniorAssistant';

export default function CoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.id as string);
  const { courses, updateNickname, hideCourse } = useCourses();
  const course = courses.find(c => c.canvasId === courseId);
  
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [files, setFiles] = useState<CanvasFile[]>([]);
  const [folders, setFolders] = useState<CanvasFolder[]>([]);
  const [folderFiles, setFolderFiles] = useState<Record<number, CanvasFile[]>>({});
  const [restrictedFolders, setRestrictedFolders] = useState<Set<number>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHideConfirm, setShowHideConfirm] = useState(false);

  useEffect(() => {
    if (course) {
      setNicknameValue(course.nickname);
    }
  }, [course]);

  useEffect(() => {
    if (courseId) {
      loadAssignments();
      loadFiles();
    }
  }, [courseId]);

  const loadAssignments = useCallback(async () => {
    const token = getCanvasToken();
    if (!token) {
      setError('Canvas token not found. Please sync in Canvas Sync settings.');
      return;
    }

    setIsLoadingAssignments(true);
    setError(null);

    try {
      const data = await fetchCourseAssignments(token, courseId);
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [courseId]);

  // Auto-refresh assignments on interval
  const assignmentsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const setupAutoRefresh = () => {
    // Clear existing interval
    if (assignmentsIntervalRef.current) {
      clearInterval(assignmentsIntervalRef.current);
      assignmentsIntervalRef.current = null;
    }

    const token = getCanvasToken();
    if (!token || !courseId) return;

    const intervalMinutes = getAutoRefreshInterval();
    if (intervalMinutes <= 0) return; // Auto-refresh disabled

    const intervalMs = intervalMinutes * 60 * 1000;

    // Set up new interval
    assignmentsIntervalRef.current = setInterval(() => {
      loadAssignments();
    }, intervalMs);
  };

  useEffect(() => {
    setupAutoRefresh();

    // Listen for interval changes
    const handleIntervalChange = () => {
      setupAutoRefresh();
    };
    
    window.addEventListener('autoRefreshIntervalChanged', handleIntervalChange);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (assignmentsIntervalRef.current) {
        clearInterval(assignmentsIntervalRef.current);
        assignmentsIntervalRef.current = null;
      }
      window.removeEventListener('autoRefreshIntervalChanged', handleIntervalChange);
    };
  }, [loadAssignments, courseId]);

  const loadFiles = async () => {
    const token = getCanvasToken();
    if (!token) return;

    setIsLoadingFiles(true);

    try {
      // Fetch both files and folders
      const [filesData, foldersData] = await Promise.all([
        fetchCourseFiles(token, courseId).catch(() => []),
        fetchCourseFolders(token, courseId).catch(() => [])
      ]);
      
      setFiles(filesData);
      setFolders(foldersData);

      // Test which folders are accessible immediately (using server action to avoid CORS)
      const restricted = new Set<number>();
      const foldersToTest = foldersData.filter(
        folder => !folder.hidden && folder.name !== 'course files' && folder.files_count > 0
      );

      // Test all folders in parallel using server action
      const testResults = await Promise.allSettled(
        foldersToTest.map(async (folder) => {
          const isAccessible = await testFolderAccess(token, folder.id);
          return { folderId: folder.id, restricted: !isAccessible };
        })
      );

      // Process results and mark restricted folders
      testResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.restricted) {
          restricted.add(result.value.folderId);
        }
      });

      // Set restricted folders immediately
      setRestrictedFolders(restricted);
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const toggleFolder = async (folderId: number) => {
    // Don't allow expanding restricted folders
    if (restrictedFolders.has(folderId)) {
      return;
    }

    if (expandedFolders.has(folderId)) {
      // Collapse
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    } else {
      // Expand - load folder files
      const token = getCanvasToken();
      if (!token) return;

      if (!folderFiles[folderId]) {
        try {
          const folderFilesData = await fetchFolderFiles(token, folderId);
          setFolderFiles(prev => ({ ...prev, [folderId]: folderFilesData }));
          // If we get empty but folder says it has files, mark as restricted
          if (folderFilesData.length === 0) {
            const folder = folders.find(f => f.id === folderId);
            if (folder && folder.files_count > 0) {
              setRestrictedFolders(prev => new Set(prev).add(folderId));
            }
          }
        } catch (err: any) {
          console.error('Error loading folder files:', err);
          // Mark as restricted if we get a 403
          if (err?.message?.includes('403')) {
            setRestrictedFolders(prev => new Set(prev).add(folderId));
          }
          setFolderFiles(prev => ({ ...prev, [folderId]: [] }));
        }
      }

      setExpandedFolders(prev => new Set(prev).add(folderId));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeClass: string, contentType: string) => {
    if (mimeClass === 'image') return '🖼️';
    if (mimeClass === 'pdf') return '📄';
    if (mimeClass === 'video') return '🎥';
    if (mimeClass === 'audio') return '🎵';
    if (contentType?.includes('word') || contentType?.includes('document')) return '📝';
    if (contentType?.includes('excel') || contentType?.includes('spreadsheet')) return '📊';
    if (contentType?.includes('powerpoint') || contentType?.includes('presentation')) return '📽️';
    return '📎';
  };

  const handleSaveNickname = () => {
    if (nicknameValue.trim() && course) {
      updateNickname(course.canvasId, nicknameValue.trim());
      setIsEditingNickname(false);
    }
  };

  const handleCancelEdit = () => {
    if (course) {
      setNicknameValue(course.nickname);
    }
    setIsEditingNickname(false);
  };

  const handleHideCourse = () => {
    if (course) {
      hideCourse(course.canvasId);
      router.push('/');
    }
  };

  if (!course) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800">Course not found. Please sync your courses from Canvas Sync.</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to strip HTML tags
  const stripHtml = (html: string): string => {
    if (typeof window === 'undefined') {
      // Server-side: use regex
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    }
    // Client-side: use DOM
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Helper function to check if assignment is completed/submitted in Canvas
  const isAssignmentSubmitted = (assignment: any): boolean => {
    // Check if assignment has a submission object from Canvas
    if (assignment.submission) {
      const workflowState = assignment.submission.workflow_state;
      // Assignment is considered completed if it's been submitted or graded
      return workflowState === 'submitted' || workflowState === 'graded';
    }
    return false;
  };

  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter(a => {
        // Filter out assignments without due dates
        if (!a.due_at) return false;
        // Filter out past due assignments
        if (new Date(a.due_at) <= new Date()) return false;
        // Filter out assignments that have been submitted/completed in Canvas
        return !isAssignmentSubmitted(a);
      })
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .map(assignment => ({
        ...assignment,
        descriptionText: assignment.description ? stripHtml(assignment.description) : ''
      }))
      .slice(0, 5);
  }, [assignments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditingNickname ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nicknameValue}
                onChange={(e) => setNicknameValue(e.target.value)}
                className="text-4xl font-bold text-[#002E5D] bg-transparent border-b-2 border-[#002E5D] focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveNickname}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                aria-label="Save nickname"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Cancel edit"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-[#002E5D]">{course.nickname}</h1>
              <button
                onClick={() => setIsEditingNickname(true)}
                className="p-2 text-gray-400 hover:text-[#002E5D] hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Edit nickname"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          )}
          <p className="text-lg text-gray-600 mt-2">{course.courseCode}</p>
          {course.name !== course.nickname && (
            <p className="text-sm text-gray-500 mt-1">Original: {course.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHideConfirm(true)}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 border border-red-200"
            aria-label="Hide course"
          >
            <EyeOff className="w-4 h-4" />
            <span className="text-sm">Hide Course</span>
          </button>
        </div>
      </div>

      {/* Hide Confirmation */}
      <AnimatePresence>
        {showHideConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-800 font-medium mb-2">
                  Hide this course?
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  This will remove the course from your sidebar and dashboard. You can restore it later from Canvas Sync.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleHideCourse}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hide Course
                  </button>
                  <button
                    onClick={() => setShowHideConfirm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Section - Course Content */}
        <div className="flex-1 space-y-6">
          {/* Upcoming Assignments */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-[#002E5D] flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Upcoming Assignments
          </h2>
          {isLoadingAssignments && (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          )}
        </div>

        {isLoadingAssignments ? (
          <div className="text-center py-8 text-gray-500">Loading assignments...</div>
        ) : upcomingAssignments.length > 0 ? (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => {
              // Build Canvas URL if html_url is not available
              const canvasUrl = assignment.html_url || `https://byu.instructure.com/courses/${courseId}/assignments/${assignment.id}`;
              
              return (
                <motion.a
                  key={assignment.id}
                  href={canvasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-semibold text-gray-900">{assignment.name}</h3>
                      {assignment.descriptionText && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {assignment.descriptionText}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-sm font-medium text-[#002E5D]">
                        {new Date(assignment.due_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(assignment.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No upcoming assignments</p>
          </div>
        )}
      </div>

          {/* Course Files Section */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-[#002E5D] flex items-center gap-2">
            <Folder className="w-6 h-6" />
            Course Files
          </h2>
          {isLoadingFiles && (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          )}
        </div>

        {isLoadingFiles ? (
          <div className="text-center py-8 text-gray-500">Loading files...</div>
        ) : (
          <div className="space-y-4">
            {/* Root Level Files */}
            {files.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Files
                </h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <motion.a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-[#002E5D] transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl">{getFileIcon(file.mime_class, file.content_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-[#002E5D]">
                            {file.display_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#002E5D] flex-shrink-0 ml-2" />
                    </motion.a>
                  ))}
                </div>
              </div>
            )}

            {/* Folders */}
            {folders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Folders
                </h3>
                <div className="space-y-2">
                  {folders
                    .filter(folder => !folder.hidden && folder.name !== 'course files')
                    .map((folder) => (
                      <div key={folder.id} className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          disabled={restrictedFolders.has(folder.id)}
                          className={`w-full flex items-center justify-between p-3 transition-colors ${
                            restrictedFolders.has(folder.id)
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Folder className="w-5 h-5 text-[#002E5D] flex-shrink-0" />
                            <div className="flex-1 min-w-0 text-left">
                              <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                              <p className="text-xs text-gray-500">
                                {restrictedFolders.has(folder.id) ? (
                                  <span className="text-orange-600 font-medium">Restricted</span>
                                ) : (
                                  <>
                                    {folder.files_count} file{folder.files_count !== 1 ? 's' : ''}
                                    {folder.folders_count > 0 && ` • ${folder.folders_count} folder${folder.folders_count !== 1 ? 's' : ''}`}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {expandedFolders.has(folder.id) ? (
                              <X className="w-4 h-4 text-gray-400" />
                            ) : (
                              <File className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Folder Files */}
                        <AnimatePresence>
                          {expandedFolders.has(folder.id) && folderFiles[folder.id] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3">
                                {folderFiles[folder.id].length > 0 ? (
                                  folderFiles[folder.id].map((file) => (
                                    <a
                                      key={file.id}
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between p-2 pl-8 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-[#002E5D] transition-colors group"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-lg">{getFileIcon(file.mime_class, file.content_type)}</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#002E5D]">
                                            {file.display_name}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatFileSize(file.size)}
                                          </p>
                                        </div>
                                      </div>
                                      <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#002E5D] flex-shrink-0 ml-2" />
                                    </a>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-500 pl-8 py-2">No files in this folder</p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {files.length === 0 && folders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No files available</p>
              </div>
            )}
          </div>
        )}
          </div>
        </div>

        {/* Right Section - Junior Assistant (Sticky) */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="sticky top-8">
            <JuniorAssistant courseId={courseId} courseNickname={course.nickname} />
          </div>
        </div>
      </div>
    </div>
  );
}
