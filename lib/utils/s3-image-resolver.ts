/**
 * AWS S3 Image URL Resolver
 * Генерує правильні URLs для зображень з AWS S3
 */

export interface S3ImageObject {
  url?: string;
  key?: string;
  location?: string;
}

/**
 * Розв'язує URL зображення з різних форматів AWS S3
 * @param imageData - може бути URL або об'єктом з key/location
 * @returns повний URL до зображення
 */
export function resolveImageURL(imageData: string | S3ImageObject | null | undefined): string {
  if (!imageData) return '/images/placeholder.svg';

  // Якщо це вже string URL
  if (typeof imageData === 'string') {
    // Перевіряємо чи це вже повний URL
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return imageData;
    }
    // Якщо це відносний шлях, будуємо S3 URL
    if (imageData.includes('/')) {
      const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'profixter-uploads';
      const region = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${imageData}`;
    }
    return imageData;
  }

  // Якщо об'єкт з AWS S3
  if (typeof imageData === 'object') {
    // Спробувати location (повний S3 URL)
    if (imageData.location) {
      if (imageData.location.startsWith('http://') || imageData.location.startsWith('https://')) {
        return imageData.location;
      }
    }
    
    // Спробувати url
    if (imageData.url) {
      // Якщо це вже повний URL
      if (imageData.url.startsWith('http://') || imageData.url.startsWith('https://')) {
        return imageData.url;
      }
      // Якщо це відносний шлях або key, будуємо S3 URL
      const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'profixter-uploads';
      const region = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${imageData.url}`;
    }
    
    // Спробувати key і побудувати URL
    if (imageData.key) {
      const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || 'profixter-uploads';
      const region = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${imageData.key}`;
    }
  }

  return '/images/placeholder.svg';
}

/**
 * Генерує імена файлів для завантаження
 */
export function generateDownloadFilename(
  bookingNumber: string | number,
  index: number,
  extension = 'jpg'
): string {
  return `booking-${bookingNumber}-${index + 1}.${extension}`;
}

/**
 * Перевіряє чи є валідний URL зображення
 */
export function isValidImageURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Перевіряє чи це HEIC/HEIF файл
 */
export function isHEICFile(url: string): boolean {
  return /\.(heic|heif)$/i.test(url);
}

/**
 * Конвертує HEIC blob в JPEG blob
 * Примітка: деякі HEIC файли можуть не підтримуватись через обмеження libheif
 */
export async function convertHEICtoJPEG(blob: Blob): Promise<Blob> {
  try {
    const heic2any = (await import('heic2any')).default;
    
    const convertedBlob = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    
    // heic2any може повертати масив блобів або один blob
    return Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  } catch (error: any) {
    console.error('❌ HEIC conversion failed:', error);
    throw error;
  }
}

/**
 * Завантажує та конвертує HEIC зображення в data URL
 */
export async function fetchAndConvertHEIC(url: string): Promise<string> {
  try {
    console.log('🔄 Converting HEIC image:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('📦 Fetched blob type:', blob.type, 'size:', blob.size);
    
    const convertedBlob = await convertHEICtoJPEG(blob);
    console.log('✅ Converted to JPEG, size:', convertedBlob.size);
    
    // Конвертуємо blob в data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('✅ Data URL created');
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(convertedBlob);
    });
  } catch (error) {
    console.error('❌ Failed to fetch and convert HEIC:', error);
    return '/images/placeholder.svg';
  }
}
