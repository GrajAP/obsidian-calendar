/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ctp: {
          base: '#1e1e2e',
          mantle: '#181825',
          crust: '#11111b',
          text: '#cdd6f4',
          subtext1: '#bac2de',
          subtext0: '#a6adc8',
          overlay2: '#9399b2',
          overlay1: '#7f849e',
          overlay0: '#6c7086',
          surface2: '#585b70',
          surface1: '#45475a',
          surface0: '#313244',
          blue: '#89b4fa',
          lavender: '#b4befe',
          mauve: '#cba6f7',
          red: '#f38ba8',
          peach: '#fab387',
          yellow: '#f9e2af',
          green: '#a6e3a1',
          teal: '#94e2d5',
          sky: '#89dceb',
          pink: '#f5c2e7',
          flame: '#fda4af',
          overlay: '#6c7086',
        }
      }
    },
  },
  plugins: [],
}