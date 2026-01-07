'use client';

import { useState, useEffect } from 'react';
import { Info, CheckCircle2, Loader2, Link as LinkIcon, Eye, EyeOff, Upload, File, Trash2, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveCanvasToken, getCanvasToken, getHiddenCourses, showCourse } from '../lib/courseStorage';
import { fetchCanvasCourses, CanvasCourse } from '../actions/canvas';
import { useCourses } from '../components/CoursesProvider';
import { getCourseFiles, addCourseFile, deleteCourseFile, UploadedFile } from '../lib/courseStorage';

type Tab = 'canvas-sync' | 'files';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('canvas-sync');
  
  // Canvas Sync state
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCourses, setHiddenCourses] = useState<Array<{ id: number; name: string }>>([]);
  const { refreshCourses } = useCourses();

  // Files state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null | 'semester'>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { courses } = useCourses();

  useEffect(() => {
    // Load saved token if it exists
    const savedToken = getCanvasToken();
    if (savedToken) {
      setToken(savedToken);
    }
    loadHiddenCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId !== null) {
      // Convert 'semester' to null for storage functions
      const courseIdForStorage = selectedCourseId === 'semester' ? null : selectedCourseId;
      const files = getCourseFiles(courseIdForStorage);
      setUploadedFiles(files);
    } else {
      setUploadedFiles([]);
    }
  }, [selectedCourseId]);

  const loadHiddenCourses = async () => {
    const token = getCanvasToken();
    if (!token) return;

    try {
      const response = await fetch(`https://byu.instructure.com/api/v1/courses?enrollment_type=student&enrollment_state=active&per_page=100&include[]=all_courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const allCourses = await response.json();
        const hiddenIds = getHiddenCourses();
        const hidden = allCourses
          .filter((course: CanvasCourse) => hiddenIds.includes(course.id))
          .map((course: CanvasCourse) => ({ id: course.id, name: course.name || course.course_code || 'Unnamed Course' }));
        setHiddenCourses(hidden);
      }
    } catch (err) {
      // Silently fail - hidden courses are optional
    }
  };

  const handleRestoreCourse = (courseId: number) => {
    showCourse(courseId);
    setHiddenCourses(prev => prev.filter(c => c.id !== courseId));
    refreshCourses();
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter a Canvas access token');
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);

    try {
      await fetchCanvasCourses(token);
      saveCanvasToken(token);
      await refreshCourses();
      await loadHiddenCourses();
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Canvas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || selectedCourseId === null) return;

    setIsUploading(true);
    setFileError(null);

    try {
      // Convert 'semester' to null for storage functions
      const courseIdForStorage = selectedCourseId === 'semester' ? null : selectedCourseId;
      
      for (const file of Array.from(files)) {
        // Check file size (warn if over 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setFileError(`File "${file.name}" is too large (max 5MB). Files are stored locally in your browser.`);
          continue;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const base64Data = event.target?.result as string;
            const uploadedFile: UploadedFile = {
              id: `file-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              data: base64Data,
              uploadDate: new Date().toISOString(),
              courseId: courseIdForStorage,
            };

            addCourseFile(courseIdForStorage, uploadedFile);
            setUploadedFiles(prev => [...prev, uploadedFile]);
          } catch (err) {
            setFileError(err instanceof Error ? err.message : 'Failed to process file');
          }
        };

        reader.onerror = () => {
          setFileError('Failed to read file');
        };

        reader.readAsDataURL(file);
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (selectedCourseId === null) return;
    // Convert 'semester' to null for storage functions
    const courseIdForStorage = selectedCourseId === 'semester' ? null : selectedCourseId;
    deleteCourseFile(courseIdForStorage, fileId);
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleDownloadFile = (file: UploadedFile) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[#002E5D] mb-2">
          Settings
        </h1>
        <p className="text-lg text-gray-600">
          Manage your Canvas sync and course files
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('canvas-sync')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'canvas-sync'
                ? 'border-[#002E5D] text-[#002E5D]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Canvas Sync
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'files'
                ? 'border-[#002E5D] text-[#002E5D]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Files
          </button>
        </nav>
      </div>

      {/* Canvas Sync Tab */}
      {activeTab === 'canvas-sync' && (
        <div className="space-y-6">
          {/* Settings Form */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <form onSubmit={handleSync} className="space-y-6">
              {/* Token Input */}
              <div>
                <label
                  htmlFor="canvas-token"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Canvas Personal Access Token
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="canvas-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter your Canvas access token"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002E5D] focus:border-transparent pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002E5D] transition-colors"
                    aria-label="Show token information"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Info Box */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-2">
                          How to get your token
                        </h3>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                          <li>Go to BYU Canvas and log in to your account</li>
                          <li>Click on your profile picture in the top right</li>
                          <li>Select "Settings" from the dropdown menu</li>
                          <li>Scroll down to "Approved Integrations"</li>
                          <li>Click on "+ New Access Token"</li>
                          <li>Enter a purpose (e.g., "Junior Ledger Sync")</li>
                          <li>Click "Generate Token" and copy it</li>
                          <li>Paste the token in the field above</li>
                        </ol>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-blue-700">
                            <strong>Note:</strong> Your token will only be shown once. Keep it secure and don't share it with anyone.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
                  >
                    <Info className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Message */}
              <AnimatePresence>
                {isSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-green-800 font-medium">
                      Connected to BYU Canvas
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sync Button */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={!token.trim() || isLoading}
                  className="px-6 py-3 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2 font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#002E5D]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-5 h-5" />
                      Sync Assignments
                    </>
                  )}
                </button>
                {token && !isLoading && !isSuccess && (
                  <p className="text-sm text-gray-500">
                    Ready to sync your assignments
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Hidden Courses Section */}
          {hiddenCourses.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-[#002E5D] mb-3 flex items-center gap-2">
                <EyeOff className="w-5 h-5" />
                Hidden Courses
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                These courses are hidden from your sidebar and dashboard. Click "Show" to restore them.
              </p>
              <div className="space-y-2">
                {hiddenCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                  >
                    <span className="text-gray-800">{course.name}</span>
                    <button
                      onClick={() => handleRestoreCourse(course.id)}
                      className="px-3 py-1.5 text-sm bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Show
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug: Show All Courses Section */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h2 className="text-xl font-semibold text-[#002E5D] mb-3">
              Debug: Check All Courses
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              If ACC 409 is missing, click this button to see all courses in the browser console. Look for courses with "409" in the name or course_code.
            </p>
            <button
              onClick={async () => {
                const token = getCanvasToken();
                if (!token) {
                  alert('Please sync your Canvas token first');
                  return;
                }
                try {
                  const response = await fetch(`https://byu.instructure.com/api/v1/courses?enrollment_type=student&per_page=100`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                    },
                  });
                  if (response.ok) {
                    const allCourses = await response.json();
                    console.log('All Canvas Courses:', allCourses);
                    const acc409 = allCourses.find((c: any) => 
                      c.name?.includes('409') || 
                      c.course_code?.includes('409') ||
                      c.name?.includes('Integrated Topics')
                    );
                    if (acc409) {
                      alert(`Found ACC 409! Name: ${acc409.name}, Code: ${acc409.course_code}, State: ${acc409.workflow_state}, ID: ${acc409.id}\n\nCheck console (F12) for full list.`);
                    } else {
                      alert(`Checked ${allCourses.length} courses. ACC 409 not found. Check the browser console (F12) to see all courses.`);
                    }
                  }
                } catch (err) {
                  console.error('Error fetching all courses:', err);
                  alert('Error fetching courses. Check console for details.');
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Check All Courses in Console
            </button>
          </div>

          {/* Additional Info Section */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-[#002E5D] mb-3">
              What gets synced?
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Assignment due dates and deadlines</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Course information and schedules</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Assignment details and descriptions</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Course Selector */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Course or Semester Documents
            </label>
            <select
              value={selectedCourseId === null ? '' : selectedCourseId === 'semester' ? 'semester' : selectedCourseId.toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setSelectedCourseId(null);
                } else if (value === 'semester') {
                  setSelectedCourseId('semester');
                } else {
                  setSelectedCourseId(parseInt(value));
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002E5D] focus:border-transparent"
            >
              <option value="">-- Select a course or semester documents --</option>
              <option value="semester">📅 Semester Documents (All Classes)</option>
              {courses.map((course) => (
                <option key={course.canvasId} value={course.canvasId}>
                  {course.nickname} ({course.courseCode})
                </option>
              ))}
            </select>
          </div>

          {selectedCourseId !== null && (
            <>
              {/* File Upload */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-[#002E5D] mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  {selectedCourseId === 'semester' ? 'Upload Semester Documents' : 'Upload Files'}
                </h2>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#002E5D] transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    <span className="text-gray-600 font-medium">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedCourseId === 'semester' 
                        ? 'Upload semester schedules or other documents for all classes (max 5MB per file)'
                        : 'Upload syllabus, schedules, or other course files (max 5MB per file)'}
                    </span>
                  </label>
                </div>
                {fileError && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 text-sm">{fileError}</p>
                  </div>
                )}
                {isUploading && (
                  <div className="mt-4 flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Uploading files...</span>
                  </div>
                )}
                <p className="mt-4 text-xs text-gray-500">
                  Files are stored locally in your browser. Large files may affect performance.
                </p>
              </div>

              {/* File List */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-[#002E5D] mb-4 flex items-center gap-2">
                  <File className="w-5 h-5" />
                  Uploaded Files
                </h2>
                {uploadedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-[#002E5D] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.uploadDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="p-2 text-[#002E5D] hover:bg-blue-50 rounded-lg transition-colors"
                            aria-label="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <File className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No files uploaded yet</p>
                    <p className="text-sm mt-1">Upload files using the form above</p>
                  </div>
                )}
              </div>
            </>
          )}

          {selectedCourseId === null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <Info className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-blue-800">Please select a course or semester documents to view or upload files</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
