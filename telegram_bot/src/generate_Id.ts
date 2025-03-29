import { createCanvas, loadImage, registerFont } from "canvas";
import JsBarcode from "jsbarcode";
import * as fs from "fs";
import * as path from "path";

const templatesDir = path.join(__dirname, 'templates');
const outputDir = path.join(__dirname, '../temp_ids');
const fontsDir = path.join(__dirname, 'fonts');

try {
  registerFont(path.join(fontsDir, 'NotoSansEthiopic.ttf'), {
    family: 'Noto Sans Ethiopic',
    weight: 'normal'
  });
} catch (err) {
  console.warn('Could not register Noto Sans Ethiopic font:', (err as Error).message);
}

try {
  registerFont(path.join(fontsDir, 'Arial.ttf'), {
    family: 'Arial',
    weight: 'normal'
  });
} catch (err) {
  console.warn('Could not register Arial font:', (err as Error).message);
}

export async function generateID(
  userId: string,
  name: string,
  religiousName: string,
  phone: string,
  email: string,
  photoUrl: string,
  language: 'en' | 'am'
): Promise<string> {
  try {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext("2d");
    
    const templatePath = path.join(templatesDir, 'id.png');
    const template = await loadImage(templatePath);
    ctx.drawImage(template, 0, 0, 1000, 600);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = "#000";

    const amharicFonts = '"Noto Sans Ethiopic", "Abyssinica SIL", "Nyala", sans-serif';
    const englishFonts = 'Arial, Helvetica, sans-serif';
    
    const mainFont = language === 'am' 
      ? `bold 22px ${amharicFonts}`
      : `bold 20px ${englishFonts}`;
    
    const secondaryFont = `bold 20px ${englishFonts}`;

    ctx.font = mainFont;
    ctx.fillText(name, 473, 240);
    ctx.fillText(religiousName, 559, 285);
    
    ctx.font = secondaryFont;
    ctx.fillText(phone, 470, 337);
    ctx.fillText(email, 470, 375);

    const photo = await loadImage(photoUrl);
    ctx.drawImage(photo, 120, 230, 200, 200);

    const barcodeCanvas = createCanvas(300, 100);
    JsBarcode(barcodeCanvas, phone, {
      format: "CODE128",
      displayValue: false,
      width: 2,
      height: 60,
      margin: 0
    });
    ctx.drawImage(barcodeCanvas, 400, 430, 250, 50);

    const outputPath = path.join(outputDir, `${userId}_${Date.now()}.png`);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (error) {
    console.error("Error generating ID:", error);
    throw error;
  }
}