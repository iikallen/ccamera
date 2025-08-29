import Link from 'next/link';

const Logo = () => {
  return (
    <Link href="/" className="flex items-center">
      <div className="bg-blue-600 rounded-lg w-10 h-10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="ml-3">
        <span className="text-xl font-bold text-gray-900 dark:text-white">Secure</span>
        <span className="text-xl font-bold text-blue-600">Vision</span>
      </div>
    </Link>
  );
};

export default Logo;