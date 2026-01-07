'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatMessage } from '../actions/chat';
import { getCourseChatMessages, saveCourseChatMessages, ChatMessage } from '../lib/courseStorage';

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
      const response = await sendChatMessage(userMessage, tutorMode, courseId, courseNickname);
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

  return (
    <div className="h-[calc(100vh-8rem)] max-h-[800px] flex flex-col bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#002E5D] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="font-semibold">{assistantName}</h3>
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
                <p className="text-sm">{message.text}</p>
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
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
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
