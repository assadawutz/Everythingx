
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { X, Github, AlertCircle, ShieldAlert, ZapOff, Key } from 'lucide-react';

const ErrorModal = ({ isOpen, onClose, errorInfo }) => {
  if (!isOpen) return null;

  const getErrorContent = () => {
    const defaultInfo = {
      title: "Something went wrong",
      message: errorInfo?.message || "An unexpected error occurred during generation.",
      advice: "Try refreshing the page or checking your connection.",
      icon: <AlertCircle size={48} className="text-red-500 mb-4" />
    };

    if (!errorInfo) return defaultInfo;

    const msg = errorInfo.message?.toLowerCase() || "";
    
    if (msg.includes("429") || msg.includes("quota")) {
      return {
        title: "Quota Exceeded",
        message: "You've reached the rate limit for this model.",
        advice: "Wait a minute before trying again, or switch to a lower tier model.",
        icon: <ZapOff size={48} className="text-amber-500 mb-4" />
      };
    }

    if (msg.includes("403") || msg.includes("api_key") || msg.includes("not found")) {
      return {
        title: "API Key Issue",
        message: "There was a problem with your API authentication.",
        advice: "Ensure your API key is valid and from a project with billing enabled for advanced models.",
        icon: <Key size={48} className="text-blue-500 mb-4" />
      };
    }

    if (msg.includes("safety") || msg.includes("blocked")) {
      return {
        title: "Content Blocked",
        message: "The request was flagged by safety filters.",
        advice: "Try rephrasing your prompt or using a different image that complies with safety guidelines.",
        icon: <ShieldAlert size={48} className="text-purple-500 mb-4" />
      };
    }

    return defaultInfo;
  };

  const content = getErrorContent();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
      />

      <div className="relative bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 max-w-lg w-full z-10 animate-in fade-in zoom-in duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          {content.icon}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {content.title}
          </h2>
          <p className="text-gray-600 mb-2 font-medium">
            {content.message}
          </p>
          <p className="text-gray-500 mb-8 text-sm italic">
            💡 Advice: {content.advice}
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="https://ai.google.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold"
          >
            Check API Status at ai.google.dev
          </a>
          
          <div className="flex gap-3">
            <a
              href="https://github.com/googlecreativelab/gemini-demos/tree/main/image-to-code"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              <Github size={18} />
              <span>GitHub</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
