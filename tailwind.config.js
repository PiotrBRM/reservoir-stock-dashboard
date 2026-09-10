/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Region identity — validated CVD-safe categorical pair (blue/orange).
        // Always paired with a text label; color never carries meaning alone.
        proper: { DEFAULT: "#2a78d6", soft: "#e8f0fc" },
        amped: { DEFAULT: "#eb6834", soft: "#fdece3" },
        // Fixed status palette — never themed, never reused for identity.
        good: { DEFAULT: "#0ca30c", soft: "#e6f6e6" },
        warning: { DEFAULT: "#fab219", soft: "#fef3da" },
        serious: { DEFAULT: "#ec835a", soft: "#fce6dd" },
        critical: { DEFAULT: "#d03b3b", soft: "#fbe6e6" },
      },
    },
  },
  plugins: [],
}