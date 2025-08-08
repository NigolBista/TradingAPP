/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          light: "#0B1220",
          dark: "#0A0F1C",
        },
        primary: {
          DEFAULT: "#4F46E5",
          600: "#4338CA",
          700: "#3730A3",
        },
        success: "#16A34A",
        danger: "#DC2626",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};
