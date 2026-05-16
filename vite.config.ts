import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // excel.js 入口会读 process.versions.node，浏览器中会异常；使用官方 browser 打包产物
      exceljs: path.resolve(__dirname, "node_modules/exceljs/dist/exceljs.min.js"),
    },
  },
});
