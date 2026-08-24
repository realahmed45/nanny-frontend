/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black surfaces from the design: page → panel → raised.
        ink: {
          600: '#3a4358', 700: '#2a3244', 800: '#1a2030',
          900: '#121826', 950: '#0a0e18',
        },
        brand: {
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb',
          700: '#1d4ed8', 900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
