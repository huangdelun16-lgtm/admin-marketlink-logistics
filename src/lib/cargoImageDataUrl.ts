/** 每条货物可选的商品参考图（存 base64 data URL，导出 Excel 时嵌入） */

const MAX_LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 0.88;

/** 单张插入 Excel 的展示尺寸（96dpi 像素，与纸质 cm 对应） */
export const GOODS_EXCEL_IMAGE_WIDTH_CM = 3.21 as const;
export const GOODS_EXCEL_IMAGE_HEIGHT_CM = 2.86 as const;

export function cmToExcelImagePx(cm: number): number {
  return Math.round((cm / 2.54) * 96);
}

/** Excel 行高（磅），使单元格能容纳嵌入图高度 */
export function goodsExcelImageRowHeightPt(): number {
  return Math.ceil((GOODS_EXCEL_IMAGE_HEIGHT_CM / 2.54) * 72);
}

/** 浏览器持久化建议上限（字符）；超限拒绝写入以免撑爆 localStorage */
export const MAX_CARGO_IMAGE_DATA_URL_CHARS = 2_800_000;

export async function compressImageFileToJpegDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件（JPG / PNG / WebP / GIF 等）");
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }

  let drawW: number;
  let drawH: number;

  if (bitmap) {
    drawW = bitmap.width;
    drawH = bitmap.height;
  } else {
    const img = await loadImageFromFile(file);
    drawW = img.naturalWidth || img.width;
    drawH = img.naturalHeight || img.height;
    const canvasBmp = document.createElement("canvas");
    canvasBmp.width = drawW;
    canvasBmp.height = drawH;
    const ctxBmp = canvasBmp.getContext("2d");
    if (!ctxBmp) throw new Error("无法处理图片");
    ctxBmp.drawImage(img, 0, 0);
    bitmap = await createImageBitmap(canvasBmp);
  }

  const scale = Math.min(1, MAX_LONG_EDGE_PX / Math.max(drawW, drawH));
  const cw = Math.max(1, Math.round(drawW * scale));
  const ch = Math.max(1, Math.round(drawH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("无法处理图片");
  }
  ctx.drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close?.();

  const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (url.length > MAX_CARGO_IMAGE_DATA_URL_CHARS) {
    throw new Error("图片过大，请换一张分辨率更低的图片");
  }
  return url;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("无法读取图片"));
    };
    img.src = objUrl;
  });
}
