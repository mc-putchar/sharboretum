// Tailwind CSS configuration for Sharboretum (Vite pipeline)
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx,html}',
  ],
  theme: {
    extend: {
      // Customize serene low-poly vibes here if needed
      colors: {
        // example: 'sharbor-green': '#4ade80'
      },
    },
  },
  plugins: [],
};
