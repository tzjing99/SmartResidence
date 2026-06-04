const preset = require('@smartresidence/ui-web/tailwind.preset.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui-web/src/**/*.{js,jsx,ts,tsx}',
  ],
};
