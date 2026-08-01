const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

const SEQUENTIAL_BLUE_LIGHT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
const SEQUENTIAL_BLUE_DARK = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];

interface ChartTheme {
  categorical: string[];
  sequential: string[];
  statusGood: string;
  statusWarning: string;
  statusSerious: string;
  statusCritical: string;
  grid: string;
  axis: string;
  mutedText: string;
  secondaryText: string;
  primaryText: string;
  surface: string;
}

export function getChartTheme(isDark: boolean): ChartTheme {
  return {
    categorical: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    sequential: isDark ? SEQUENTIAL_BLUE_DARK : SEQUENTIAL_BLUE_LIGHT,
    statusGood: "#0ca30c",
    statusWarning: "#fab219",
    statusSerious: "#ec835a",
    statusCritical: "#d03b3b",
    grid: isDark ? "#2c2c2a" : "#e1e0d9",
    axis: isDark ? "#383835" : "#c3c2b7",
    mutedText: "#898781",
    secondaryText: isDark ? "#c3c2b7" : "#52514e",
    primaryText: isDark ? "#ffffff" : "#0b0b0b",
    surface: isDark ? "#1a1a19" : "#fcfcfb",
  };
}
