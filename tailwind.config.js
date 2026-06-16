/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/styles/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        bgWarm: 'var(--bg-warm)',
        cardBg: 'var(--card-bg)',
        borderDark: 'var(--border-dark)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        bauhaus: {
          red: 'var(--bauhaus-red)',
          yellow: 'var(--bauhaus-yellow)',
          blue: 'var(--bauhaus-blue)',
          green: 'var(--bauhaus-green)',
          grey: 'var(--bauhaus-grey)'
        }
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)'
      },
      boxShadow: {
        bauhaus: 'var(--bauhaus-shadow)',
        'bauhaus-hover': '6px 6px 0px 0px var(--border-dark)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)'
      },
      borderWidth: {
        '1': '1px'
      }
    }
  },
  plugins: []
}
