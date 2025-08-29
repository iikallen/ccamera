"use client";

import React from 'react';
import { motion } from 'framer-motion';

const SurveillancePreview = () => {
  return (
    <div className="relative w-full max-w-lg">
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-8 border-gray-900"
      >
        <div className="bg-gray-900 py-3 px-4 flex items-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="text-white text-sm font-medium mx-auto">
            Система видеонаблюдения
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 p-4">
          {[1, 2, 3, 4].map((item) => (
            <motion.div 
              key={item}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: item * 0.1 }}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 aspect-video rounded-lg overflow-hidden relative"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-white border-dashed rounded-full animate-ping opacity-20"></div>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                Камера {item}
              </div>
              <div className="absolute top-2 right-2 flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
                <span className="text-xs text-white">LIVE</span>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="bg-gray-900 py-3 px-4 flex justify-between items-center">
          <div className="text-xs text-gray-400">Подключено 4 камеры</div>
          <div className="flex space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <div className="w-3 h-0.5 bg-gray-400"></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SurveillancePreview;