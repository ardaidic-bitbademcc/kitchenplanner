import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fefdf8",
          100: "#fdf8ed",
          200: "#faf0d7",
          300: "#f5e4b8",
          400: "#edd38e",
          500: "#e4be65",
          600: "#d4a03a",
          700: "#b07d2c",
          800: "#8e6227",
          900: "#745125",
        },
        brown: {
          50: "#fdf8f0",
          100: "#f9eedd",
          200: "#f2d9b8",
          300: "#e8be88",
          400: "#dc9b55",
          500: "#d47e33",
          600: "#c56428",
          700: "#a44e23",
          800: "#853f22",
          900: "#6d351f",
          950: "#3a1a0d",
        },
      },
    },
  },
  plugins: [],
};
export default config;
