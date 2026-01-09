'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatMessage, FileContext } from '../actions/chat';
import { getCourseChatMessages, saveCourseChatMessages, ChatMessage, getCourseFiles, getCanvasToken, getCachedCanvasFiles, cacheCanvasFile, getCachedCanvasFile, CachedCanvasFile, getCachedExtractedText, saveCachedExtractedText, CachedExtractedText } from '../lib/courseStorage';
import { extractTextFromFiles, canvasFileToExtractionFormat, isFileTypeSupported } from '../lib/fileExtraction';
import { fetchCourseFiles, fetchCourseFolders, fetchFolderFiles, downloadCanvasFileAsBase64, CanvasFile } from '../actions/canvas';
import MessageContent from './MessageContent';

interface JuniorAssistantProps {
  courseId?: number;
  courseNickname?: string;
}

export default function JuniorAssistant({ courseId, courseNickname }: JuniorAssistantProps = {}) {
  const getInitialMessages = (): ChatMessage[] => {
    if (courseId) {
      const savedMessages = getCourseChatMessages(courseId);
      if (savedMessages.length > 0) {
        return savedMessages;
      }
      return [{
        id: '1',
        text: `Hi! I'm your ${courseNickname || 'Course'} Junior Assistant. How can I help you today?`,
        sender: 'assistant'
      }];
    }
    return [{ id: '1', text: "Hi! I'm your Junior Assistant. How can I help you today?", sender: 'assistant' }];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [inputValue, setInputValue] = useState('');
  const [tutorMode, setTutorMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(2);
  
  // Store extracted file contexts
  const [fileContexts, setFileContexts] = useState<FileContext[]>([]);
  const [isExtractingFiles, setIsExtractingFiles] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string>('');

  // Extract text from course files when courseId changes
  useEffect(() => {
    if (courseId) {
      extractCourseFiles();
    } else {
      setFileContexts([]);
    }
  }, [courseId]);

  const extractCourseFiles = async () => {
    if (!courseId) return;
    
    setIsExtractingFiles(true);
    setExtractionStatus('Loading files...');
    try {
      // Check for cached extracted text first
      const cachedExtractedText = getCachedExtractedText(courseId);
      const cachedTextMap = new Map<string, CachedExtractedText>();
      
      if (cachedExtractedText) {
        cachedExtractedText.texts.forEach(text => {
          const key = text.canvasId ? `canvas-${text.canvasId}` : `uploaded-${text.fileName}`;
          cachedTextMap.set(key, text);
        });
      }
      
      // Get user-uploaded files
      const uploadedFiles = getCourseFiles(courseId);
      
      // Get cached Canvas files
      const cachedCanvasFiles = getCachedCanvasFiles(courseId);
      const cachedFilesMap = new Map<number, CachedCanvasFile>();
      cachedCanvasFiles.forEach(file => {
        cachedFilesMap.set(file.canvasId, file);
      });
      
      // Fetch Canvas files metadata
      const token = getCanvasToken();
      let canvasFiles: CanvasFile[] = [];
      
      if (token) {
        try {
          // Fetch root-level files
          const rootFiles = await fetchCourseFiles(token, courseId).catch(() => []);
          canvasFiles = [...rootFiles];
          
          // Fetch files from folders
          const folders = await fetchCourseFolders(token, courseId).catch(() => []);
          const folderFilesPromises = folders
            .filter(folder => !folder.hidden && folder.name !== 'course files' && folder.files_count > 0)
            .map(folder => fetchFolderFiles(token, folder.id).catch(() => []));
          
          const folderFilesArrays = await Promise.all(folderFilesPromises);
          folderFilesArrays.forEach(files => {
            canvasFiles.push(...files);
          });
          
          // Filter out duplicates and locked/hidden files
          const seenIds = new Set<number>();
          canvasFiles = canvasFiles.filter(file => {
            if (file.locked || file.hidden || seenIds.has(file.id)) {
              return false;
            }
            seenIds.add(file.id);
            return true;
          });
          
          // Filter to only supported file types
          const supportedCanvasFiles = canvasFiles.filter(file => 
            isFileTypeSupported(file.display_name || file.filename, file.content_type)
          );
          
          // Check which files need to be downloaded (new or updated)
          const filesToDownload: CanvasFile[] = [];
          const filesToUse: CachedCanvasFile[] = [];
          
          supportedCanvasFiles.forEach(canvasFile => {
            const cachedFile = cachedFilesMap.get(canvasFile.id);
            const fileModifiedAt = new Date(canvasFile.modified_at || canvasFile.updated_at).getTime();
            
            if (!cachedFile) {
              // New file - needs to be downloaded
              filesToDownload.push(canvasFile);
            } else {
              // Check if file has been updated
              const cachedModifiedAt = new Date(cachedFile.modifiedAt).getTime();
              if (fileModifiedAt > cachedModifiedAt) {
                // File has been updated - needs to be re-downloaded
                filesToDownload.push(canvasFile);
              } else {
                // File is up to date - use cached version
                filesToUse.push(cachedFile);
              }
            }
          });
          
          // Download new or updated files
          if (filesToDownload.length > 0) {
            console.log(`Downloading ${filesToDownload.length} new/updated Canvas files...`);
            setExtractionStatus(`Downloading ${filesToDownload.length} new/updated files...`);
            
            // Download files in batches to avoid overwhelming the system
            const BATCH_SIZE = 10;
            for (let i = 0; i < filesToDownload.length; i += BATCH_SIZE) {
              const batch = filesToDownload.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              const totalBatches = Math.ceil(filesToDownload.length / BATCH_SIZE);
              
              setExtractionStatus(`Downloading batch ${batchNum}/${totalBatches}...`);
              
              const downloadedBase64Data = await Promise.all(
                batch.map(file => 
                  downloadCanvasFileAsBase64(
                    file.url, 
                    file.display_name || file.filename, 
                    token
                  )
                )
              );
              
              // Cache downloaded files
              downloadedBase64Data.forEach((base64Data, index) => {
                const file = batch[index];
                if (base64Data) {
                  const cachedFile: CachedCanvasFile = {
                    canvasId: file.id,
                    name: file.display_name || file.filename,
                    type: file.content_type,
                    size: file.size,
                    data: base64Data,
                    url: file.url,
                    modifiedAt: file.modified_at || file.updated_at,
                    cachedAt: new Date().toISOString(),
                    courseId: courseId
                  };
                  cacheCanvasFile(courseId, cachedFile);
                  filesToUse.push(cachedFile);
                }
              });
            }
          } else {
            setExtractionStatus('Checking cached files...');
          }
          
          // Update cached files map with all files (both existing and newly downloaded)
          filesToUse.forEach(file => {
            cachedFilesMap.set(file.canvasId, file);
          });
        } catch (error) {
          console.error('Error fetching Canvas files:', error);
          // Continue with cached files and uploaded files if Canvas fetch fails
        }
      }
      
      // Determine which files need text extraction
      const filesToExtract: Array<{ name: string; type: string; data: string; canvasId?: number; fileModifiedAt?: string }> = [];
      const contextsFromCache: FileContext[] = [];
      
      // Check user-uploaded files
      uploadedFiles.forEach(file => {
        const key = `uploaded-${file.name}`;
        const cachedText = cachedTextMap.get(key);
        
        if (cachedText && cachedText.extractedAt) {
          // Use cached extracted text
          contextsFromCache.push({
            fileName: file.name,
            text: cachedText.text
          });
        } else {
          // Need to extract text
          filesToExtract.push({
            name: file.name,
            type: file.type,
            data: file.data
          });
        }
      });
      
      // Check Canvas files
      if (token) {
        const allCachedFiles = Array.from(cachedFilesMap.values());
        allCachedFiles.forEach(cachedFile => {
          const key = `canvas-${cachedFile.canvasId}`;
          const cachedText = cachedTextMap.get(key);
          
          // Check if we have cached text for this file and if it's still valid
          if (cachedText && cachedText.canvasId === cachedFile.canvasId && cachedText.fileModifiedAt) {
            const cachedTextFileModifiedAt = new Date(cachedText.fileModifiedAt).getTime();
            const currentFileModifiedAt = new Date(cachedFile.modifiedAt).getTime();
            
            // If the cached text was extracted for a file with the same modification time, use it
            if (cachedTextFileModifiedAt === currentFileModifiedAt) {
              // Use cached extracted text (file hasn't been updated since extraction)
              contextsFromCache.push({
                fileName: cachedFile.name,
                text: cachedText.text
              });
              return;
            }
          }
          
          // Need to extract text (new file or file was updated)
          filesToExtract.push({
            name: cachedFile.name,
            type: cachedFile.type,
            data: cachedFile.data,
            canvasId: cachedFile.canvasId,
            fileModifiedAt: cachedFile.modifiedAt
          });
        });
      }
      
      // Extract text from files that need it
      let extractedTexts: Array<{ fileName: string; text: string; canvasId?: number; fileModifiedAt?: string }> = [];
      
      if (filesToExtract.length > 0) {
        setExtractionStatus(`Extracting text from ${filesToExtract.length} file${filesToExtract.length !== 1 ? 's' : ''}...`);
        
        // Extract text from files that need it
        const extractionResults = await extractTextFromFiles(
          filesToExtract.map(f => ({ name: f.name, type: f.type, data: f.data }))
        );
        
        extractedTexts = extractionResults
          .map((result, index) => ({
            fileName: result.fileName,
            text: result.text,
            canvasId: filesToExtract[index].canvasId,
            fileModifiedAt: filesToExtract[index].fileModifiedAt
          }))
          .filter(result => result.text.trim().length > 0);
        
        // Cache the newly extracted text and preserve valid cached texts
        const cachedTexts: CachedExtractedText[] = extractedTexts.map(result => ({
          canvasId: result.canvasId,
          fileName: result.fileName,
          text: result.text,
          fileModifiedAt: result.fileModifiedAt,
          extractedAt: new Date().toISOString()
        }));
        
        // Also include cached texts that are still valid (from contextsFromCache)
        contextsFromCache.forEach(context => {
          // Find the corresponding cached text
          let foundCachedText: CachedExtractedText | undefined;
          
          // Check uploaded files
          for (const [key, cachedText] of cachedTextMap.entries()) {
            if (key.startsWith('uploaded-') && cachedText.fileName === context.fileName) {
              foundCachedText = cachedText;
              break;
            }
          }
          
          // Check Canvas files
          if (!foundCachedText) {
            const allCachedFiles = Array.from(cachedFilesMap.values());
            const matchingFile = allCachedFiles.find(f => f.name === context.fileName);
            if (matchingFile) {
              const key = `canvas-${matchingFile.canvasId}`;
              foundCachedText = cachedTextMap.get(key);
            }
          }
          
          if (foundCachedText) {
            cachedTexts.push(foundCachedText);
          }
        });
        
        // Save all cached texts
        saveCachedExtractedText(courseId, cachedTexts);
      } else {
        // All texts are from cache, but we still need to save them to ensure cache is maintained
        const allCachedTexts: CachedExtractedText[] = [];
        contextsFromCache.forEach(context => {
          // Find the corresponding cached text
          for (const [key, cachedText] of cachedTextMap.entries()) {
            if (cachedText.fileName === context.fileName) {
              allCachedTexts.push(cachedText);
              break;
            }
          }
        });
        if (allCachedTexts.length > 0) {
          saveCachedExtractedText(courseId, allCachedTexts);
        }
        setExtractionStatus('Using cached extracted text...');
      }
      
      // Combine cached and newly extracted contexts
      const allContexts: FileContext[] = [
        ...contextsFromCache,
        ...extractedTexts.map(result => ({
          fileName: result.fileName,
          text: result.text
        }))
      ];
      
      setFileContexts(allContexts);
      setExtractionStatus('');
    } catch (error) {
      console.error('Error extracting file content:', error);
      setFileContexts([]);
      setExtractionStatus('');
    } finally {
      setIsExtractingFiles(false);
    }
  };

  // Load messages from storage when courseId changes
  useEffect(() => {
    if (courseId) {
      const savedMessages = getCourseChatMessages(courseId);
      if (savedMessages.length > 0) {
        setMessages(savedMessages);
        // Update messageIdCounter to avoid collisions
        const maxId = savedMessages.reduce((max, msg) => {
          const numMatch = msg.id.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0]);
            return Math.max(max, num);
          }
          return max;
        }, 1);
        messageIdCounter.current = maxId + 1;
      } else {
        // Initialize with course-specific greeting
        const initialMessage: ChatMessage = {
          id: '1',
          text: `Hi! I'm your ${courseNickname || 'Course'} Junior Assistant. How can I help you today?`,
          sender: 'assistant'
        };
        setMessages([initialMessage]);
        if (courseId) {
          saveCourseChatMessages(courseId, [initialMessage]);
        }
      }
    }
  }, [courseId, courseNickname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save messages to storage whenever they change (if courseId is provided)
  useEffect(() => {
    if (courseId && messages.length > 0) {
      saveCourseChatMessages(courseId, messages);
    }
  }, [messages, courseId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const userMessageId = `msg-${Date.now()}-${messageIdCounter.current++}`;
    const newMessage: ChatMessage = {
      id: userMessageId,
      text: userMessage,
      sender: 'user',
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Pass file contexts only if we have a courseId (course-specific assistant)
      const contextsToUse = courseId ? fileContexts : undefined;
      const response = await sendChatMessage(
        userMessage, 
        tutorMode, 
        courseId, 
        courseNickname,
        contextsToUse
      );
      const assistantMessageId = `msg-${Date.now()}-${messageIdCounter.current++}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        text: response,
        sender: 'assistant'
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessageId = `msg-${Date.now()}-${messageIdCounter.current++}`;
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        text: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        sender: 'assistant'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const assistantName = courseId && courseNickname 
    ? `${courseNickname} Junior Assistant`
    : 'Junior Assistant';
  
  const fileCount = fileContexts.length;

  return (
    <div className="h-[calc(100vh-8rem)] max-h-[800px] flex flex-col bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#002E5D] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <div className="flex flex-col">
            <h3 className="font-semibold">{assistantName}</h3>
            {courseId && fileCount > 0 && (
              <p className="text-xs text-blue-200">
                {fileCount} document{fileCount !== 1 ? 's' : ''} available
              </p>
            )}
            {isExtractingFiles && extractionStatus && (
              <p className="text-xs text-blue-200">{extractionStatus}</p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={tutorMode}
            onChange={(e) => setTutorMode(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span>Tutor Mode</span>
        </label>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.sender === 'user'
                    ? 'bg-[#002E5D] text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.sender === 'assistant' ? (
                  <MessageContent text={message.text} fileContexts={courseId ? fileContexts : undefined} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002E5D] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || isExtractingFiles}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim() || isExtractingFiles}
            className="px-4 py-2 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
