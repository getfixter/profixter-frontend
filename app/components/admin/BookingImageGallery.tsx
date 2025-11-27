'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  resolveImageURL, 
  generateDownloadFilename, 
  isHEICFile, 
  fetchAndConvertHEIC 
} from '@/lib/utils/s3-image-resolver';
import type { S3ImageObject } from '@/lib/utils/s3-image-resolver';

interface BookingImageGalleryProps {
  images: (string | S3ImageObject)[];
  bookingNumber: string | number;
}

export default function BookingImageGallery({
  images = [],
  bookingNumber,
}: BookingImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set(images.map((_, i) => i)));
  const [convertedImages, setConvertedImages] = useState<Map<number, string>>(new Map());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  if (!images || images.length === 0) {
    return (
      <div className="no-images">
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm text-gray-400">No images</span>
      </div>
    );
  }

  const openLightbox = (index: number) => {
    setCurrentImage(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  // Auto-convert HEIC images on mount
  useEffect(() => {
    const convertHEICImages = async () => {
      for (let i = 0; i < images.length; i++) {
        const url = resolveImageURL(images[i]);
        
        if (isHEICFile(url)) {
          console.log(`🔄 Detected HEIC file at index ${i}:`, url);
          try {
            const convertedUrl = await fetchAndConvertHEIC(url);
            setConvertedImages((prev) => new Map(prev).set(i, convertedUrl));
            setLoadingImages((prev) => {
              const next = new Set(prev);
              next.delete(i);
              return next;
            });
            console.log(`✅ Successfully converted HEIC at index ${i}`);
          } catch (error) {
            console.warn(`⚠️ Could not convert HEIC at index ${i}, will show placeholder:`, error);
            // Не додаємо в errorImages, просто прибираємо loading
            // Показуємо спеціальний HEIC placeholder
            setLoadingImages((prev) => {
              const next = new Set(prev);
              next.delete(i);
              return next;
            });
          }
        }
      }
    };

    convertHEICImages();
  }, [images]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentImage, images.length]);

  return (
    <>
      <div className="image-gallery">
        {images.map((img, index) => {
          const originalUrl = resolveImageURL(img);
          const isHEIC = isHEICFile(originalUrl);
          const hasConverted = convertedImages.has(index);
          // Використовуємо конвертований URL якщо він є
          const displayUrl = hasConverted ? convertedImages.get(index)! : originalUrl;
          
          const isMore = index >= 3;
          if (isMore && index > 3) return null;
          
          const isLoading = loadingImages.has(index);
          const hasError = errorImages.has(index);
          
          // HEIC файл який не вдалось конвертувати - показуємо placeholder
          const isHEICPlaceholder = isHEIC && !hasConverted && !isLoading;
          
          return (
            <div key={index} className="image-item">
              <button
                onClick={() => !isHEICPlaceholder && openLightbox(index)}
                className="image-preview-btn"
                title={
                  hasError ? "Failed to load image" 
                  : isHEICPlaceholder ? "HEIC format - click download to save" 
                  : isLoading && isHEIC ? "Converting HEIC..." 
                  : "View full image"
                }
                disabled={hasError || isHEICPlaceholder}
              >
                <div className="thumbnail-wrapper">
                  {isLoading && !hasError && (
                    <div className="image-loading-spinner">
                      <div className="spinner"></div>
                      {isHEIC && (
                        <p className="text-[10px] mt-2 text-gray-600 font-medium">Converting...</p>
                      )}
                    </div>
                  )}
                  {hasError ? (
                    <div className="image-error">
                      <svg className="w-12 h-12 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs text-red-600 mt-1 font-semibold">Error</span>
                    </div>
                  ) : isHEICPlaceholder ? (
                    <div className="heic-placeholder">
                      <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] text-blue-600 mt-1 font-bold">HEIC</span>
                      <span className="text-[9px] text-gray-500">Apple Photo</span>
                    </div>
                  ) : (
                    <Image
                      src={displayUrl}
                      alt={`Booking ${bookingNumber} - Image ${index + 1}`}
                      width={120}
                      height={120}
                      className="booking-thumbnail"
                      unoptimized
                      onLoad={() => {
                        if (!isHEIC || hasConverted) {
                          setLoadingImages((prev) => {
                            const next = new Set(prev);
                            next.delete(index);
                            return next;
                          });
                        }
                      }}
                      onError={() => {
                        console.error(`❌ Failed to load image at index ${index}:`, displayUrl);
                        setLoadingImages((prev) => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                        setErrorImages((prev) => {
                          const next = new Set(prev);
                          next.add(index);
                          return next;
                        });
                      }}
                    />
                  )}
                  {index === 3 && images.length > 4 && !hasError && (
                    <div className="more-images-overlay">
                      <span className="text-2xl font-bold">+{images.length - 4}</span>
                      <span className="text-xs">more</span>
                    </div>
                  )}
                </div>
              </button>
              <a
                className="icon-btn icon-btn-download"
                href={originalUrl}
                download={generateDownloadFilename(bookingNumber, index, isHEIC ? 'heic' : 'jpg')}
                title={isHEICPlaceholder ? "Download HEIC file" : "Download Image"}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox} title="Close">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {images.length > 1 && (
              <>
                <button className="lightbox-prev" onClick={prevImage} title="Previous">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="lightbox-next" onClick={nextImage} title="Next">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            <div className="lightbox-image-wrapper">
              {errorImages.has(currentImage) ? (
                <div className="lightbox-error">
                  <svg className="w-20 h-20 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-white text-lg mt-4">Failed to load image</p>
                </div>
              ) : (
                <Image
                  src={convertedImages.get(currentImage) || resolveImageURL(images[currentImage])}
                  alt={`Booking ${bookingNumber} - Image ${currentImage + 1}`}
                  width={1200}
                  height={800}
                  className="lightbox-image"
                  unoptimized
                />
              )}
            </div>

            <div className="lightbox-footer">
              <span className="lightbox-counter">
                {currentImage + 1} / {images.length}
                {isHEICFile(resolveImageURL(images[currentImage])) && convertedImages.has(currentImage) && (
                  <span className="ml-2 text-sm text-green-400">(HEIC → JPEG)</span>
                )}
              </span>
              {!errorImages.has(currentImage) && (
                <a
                  href={convertedImages.get(currentImage) || resolveImageURL(images[currentImage])}
                  download={generateDownloadFilename(bookingNumber, currentImage)}
                  className="lightbox-download-btn"
                  title="Download"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .no-images {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          min-height: 100px;
        }

        .image-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
          width: 100%;
        }

        .image-item {
          position: relative;
          aspect-ratio: 1;
          width: 100%;
        }

        .image-preview-btn {
          position: relative;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .image-preview-btn:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        }

        .thumbnail-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }

        .image-loading-spinner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
          z-index: 1;
        }

        .image-error {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #fef2f2;
          border: 2px dashed #fca5a5;
          border-radius: 12px;
          padding: 8px;
          text-align: center;
        }

        .heic-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border: 2px dashed #60a5fa;
          border-radius: 12px;
          padding: 8px;
          text-align: center;
          gap: 2px;
        }

        .image-preview-btn:disabled {
          cursor: not-allowed;
          opacity: 0.9;
        }

        .image-preview-btn:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .booking-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
          border: 3px solid #e5e7eb;
          transition: all 0.3s ease;
          background: #f3f4f6;
        }

        .image-preview-btn:hover .booking-thumbnail {
          border-color: #3b82f6;
          transform: scale(1.05);
        }

        .more-images-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          backdrop-filter: blur(4px);
        }

        .icon-btn {
          position: absolute;
          right: -8px;
          bottom: -8px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: 2px solid white;
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          z-index: 10;
        }

        .icon-btn:hover {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          transform: translateY(-2px) scale(1.1);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
        }

        /* Lightbox Styles */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.97), rgba(15, 23, 42, 0.97));
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 40px;
          animation: fadeIn 0.3s ease;
          backdrop-filter: blur(8px);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .lightbox-content {
          position: relative;
          max-width: 1400px;
          max-height: 90vh;
          width: 100%;
        }

        .lightbox-close {
          position: absolute;
          top: -60px;
          right: 0;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          color: white;
          transition: all 0.3s;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .lightbox-close:hover {
          background: linear-gradient(135deg, rgba(220, 38, 38, 1), rgba(185, 28, 28, 1));
          transform: scale(1.1) rotate(90deg);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.6);
        }

        .lightbox-prev,
        .lightbox-next {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          color: white;
          transition: all 0.3s;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .lightbox-prev {
          left: 20px;
        }

        .lightbox-next {
          right: 20px;
        }

        .lightbox-prev:hover,
        .lightbox-next:hover {
          background: linear-gradient(135deg, rgba(37, 99, 235, 1), rgba(29, 78, 216, 1));
          transform: translateY(-50%) scale(1.15);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
        }

        .lightbox-image-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          max-height: calc(90vh - 120px);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          padding: 20px;
        }

        .lightbox-image {
          max-width: 100%;
          max-height: calc(90vh - 120px);
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .lightbox-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          padding: 40px;
        }

        .lightbox-footer {
          position: absolute;
          bottom: -70px;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        .lightbox-counter {
          color: white;
          font-weight: 700;
          font-size: 1.125rem;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .lightbox-download-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border-radius: 10px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.3s;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .lightbox-download-btn:hover {
          background: linear-gradient(135deg, #059669, #047857);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.6);
        }

        @media (max-width: 768px) {
          .image-gallery {
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }

          .lightbox-overlay {
            padding: 16px;
          }

          .lightbox-content {
            max-height: 85vh;
          }

          .lightbox-close {
            top: -45px;
            padding: 8px;
          }

          .lightbox-close svg {
            width: 20px;
            height: 20px;
          }

          .lightbox-prev,
          .lightbox-next {
            padding: 10px;
          }

          .lightbox-prev svg,
          .lightbox-next svg {
            width: 24px;
            height: 24px;
          }

          .lightbox-prev {
            left: 8px;
          }

          .lightbox-next {
            right: 8px;
          }

          .lightbox-image-wrapper {
            max-height: calc(85vh - 100px);
            padding: 12px;
            border-radius: 12px;
          }

          .lightbox-image {
            max-height: calc(85vh - 100px);
            border-radius: 8px;
          }

          .lightbox-footer {
            bottom: -55px;
            padding: 10px 12px;
            flex-direction: column;
            gap: 10px;
          }

          .lightbox-counter {
            font-size: 0.9rem;
            padding: 6px 12px;
          }

          .lightbox-download-btn {
            padding: 8px 16px;
            font-size: 0.875rem;
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .image-gallery {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .icon-btn {
            padding: 5px;
            right: -4px;
            bottom: -4px;
          }

          .icon-btn svg {
            width: 14px;
            height: 14px;
          }

          .lightbox-overlay {
            padding: 12px;
          }

          .lightbox-close {
            top: -40px;
            right: 0;
          }

          .lightbox-prev {
            left: 4px;
            padding: 8px;
          }

          .lightbox-next {
            right: 4px;
            padding: 8px;
          }

          .lightbox-counter {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </>
  );
}
