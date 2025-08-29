import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Загрузка...',
  fullScreen = true
}) => {
  return (
    <div className={`
      ${fullScreen ? 'fixed inset-0' : 'absolute inset-0'} 
      flex items-center justify-center 
      bg-black/70 z-50 backdrop-blur-sm
    `}>
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
        <p className="mt-4 text-white text-lg font-medium">{message}</p>

        <div className="w-64 h-1 bg-gray-700 mt-4 rounded-full overflow-hidden">
  <div 
    className="h-full bg-blue-500 animate-progress" 
    style={{ animationDuration: '2s' }}
  ></div>
</div>
        
        {/* Дополнительная информация для длительных загрузок */}
        <p className="mt-2 text-gray-300 text-sm max-w-md text-center">
          Это может занять несколько секунд. Пожалуйста, подождите...
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;