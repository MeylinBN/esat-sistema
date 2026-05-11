/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        azul:   { DEFAULT: '#002F6C', 2: '#1249A0', 3: '#2563C8', lt: '#EFF6FF', lt2: '#DBEAFE' },
        rojo:   { DEFAULT: '#B91C1C', 2: '#DC2626', lt: '#FEE2E2' },
        dorado: { DEFAULT: '#B45309', 2: '#D97706', lt: '#FEF3C7' },
        verde:  { DEFAULT: '#15803D', lt: '#DCFCE7' },
      },
      fontFamily: {
        sans:  ['Sora', 'sans-serif'],
        serif: ['Lora', 'serif'],
      },
      borderRadius: { DEFAULT: '12px', sm: '8px' },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)',
        card2: '0 4px 24px rgba(0,47,108,.12)',
      },
    },
  },
  plugins: [],
}
