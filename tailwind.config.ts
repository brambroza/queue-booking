import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9f1',
          100: '#dcf2e3',
          500: '#73c088',
          700: '#5ea875',
          900: '#3c7750'
        }
      }
    }
  },
  plugins: []
};

export default config;
