/** Build-time only: bundle the CSS required by WorkTime's Android APK. */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./pro-ui.js", "./wt-i18n.js", "./wt-widget.js"],
  theme: {
    extend: { colors: { brand: "#3b82f6" } }
  },
  safelist: [
    "hidden","flex","block","inline-flex","grid",
    "bg-blue-600","bg-blue-500","bg-slate-800","bg-slate-900",
    "text-slate-300","text-slate-400","text-blue-400","text-amber-300",
    "text-emerald-400","text-rose-400","border-slate-700"
  ]
};
