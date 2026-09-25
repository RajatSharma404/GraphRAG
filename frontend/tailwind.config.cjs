// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0ea5e9",
        secondary: "#6366f1",
        background: "#0f172a",
        card: "#1e293b",
      },
      fontFamily: {sans: ["Inter", "system-ui", "sans-serif"]},
      boxShadow: {glass: "0 4px 30px rgba(0,0,0,0.12) inset"},
    },
  },
  plugins: [],
};
