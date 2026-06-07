export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        amber:   { DEFAULT: '#C8861A', dark: '#A06A0E', light: '#E8A030' },
        nav:     '#0E0E0E',
        page:    '#F4F4F2',
        card:    '#FFFFFF',
        heading: '#111111',
        sub:     '#555555',
        body:    '#666666',
        border:  '#E5E5E5',
      },
      fontFamily: {
        barlow:    ['"Barlow"', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
